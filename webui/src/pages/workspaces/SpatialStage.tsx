import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { LOCATION_VISUALS, MAX_SPATIAL_LOCATIONS, spatialLayers, spatialLocationKind, spatialStatusOrder, type SpatialNode } from './spatialModel'
import { mapLabel } from '../../util/mapLabel'
import type { createSpatialRenderer } from './spatialRenderer'
import { useTheme } from '../../theme/ThemeContext'
import { Icon } from '../../components/Icon'
import { useGlobeLayout } from '../../hooks/useGlobeLayout'
import { useGlobeZoom } from '../../hooks/useGlobeZoom'
import { setGlobeAutoRotate, useGlobeAutoRotate } from '../../hooks/useGlobeAutoRotate'
import { useGlobeOrientation } from '../../hooks/useGlobeOrientation'
import { MAX_GLOBE_ZOOM, MIN_GLOBE_ZOOM } from './globeZoom'
import { globePositionsForNodes, type GlobePositions } from './globeLayout'

const MOVE_DIRECTIONS = [
  { label: 'Left', icon: 'ArrowLeft', x: -1, y: 0 },
  { label: 'Up', icon: 'ArrowUp', x: 0, y: 1 },
  { label: 'Down', icon: 'ArrowDown', x: 0, y: -1 },
  { label: 'Right', icon: 'ArrowRight', x: 1, y: 0 },
] as const

export default function SpatialStage({ nodes, selected, onSelect, showLabel = false, onActiveChange, initiallyEnabled = false, onExit, observedAt = 'Not reported', stale = false, fitViewport = false, roster, details }: {
  nodes: SpatialNode[]; selected: string; onSelect: (id: string) => void; showLabel?: boolean; onActiveChange?: (active: boolean) => void; initiallyEnabled?: boolean; onExit?: () => void; observedAt?: string; stale?: boolean; fitViewport?: boolean; roster?: ReactNode; details?: ReactNode
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const engine = useRef<ReturnType<typeof createSpatialRenderer> | null>(null)
  const label = useRef<HTMLDivElement>(null)
  const mapLabels = useRef(new Map<string, HTMLDivElement>())
  const restoreControls = useRef<HTMLButtonElement>(null)
  const hideControls = useRef<HTMLButtonElement>(null)
  const [enabled, setEnabled] = useState(initiallyEnabled)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [runners, setRunners] = useState(true)
  const [flights, setFlights] = useState(true)
  const rotating = useGlobeAutoRotate()
  const [movingMaps, setMovingMaps] = useState(false)
  const [controlsHidden, setControlsHidden] = useState(false)
  const saved = useGlobeLayout()
  const zoom = useGlobeZoom()
  const orientation = useGlobeOrientation()
  const currentOrientation = useRef(orientation)
  const currentZoom = useRef(zoom)
  const layoutHelpId = useId()
  const { revision } = useTheme()
  const currentRunners = useRef(runners)
  const currentFlights = useRef(flights)
  const currentRotating = useRef(rotating)
  const callback = useRef(onSelect)
  const currentSelection = useRef(selected)
  const currentNodes = useRef(nodes)
  const currentLayout = useRef(saved.layout)
  const savePositions = useRef(saved.move)
  const currentMovingMaps = useRef(movingMaps)
  useEffect(() => { callback.current = onSelect }, [onSelect])
  useEffect(() => { currentSelection.current = selected }, [selected])
  useEffect(() => { currentRunners.current = runners }, [runners])
  useEffect(() => { currentFlights.current = flights }, [flights])
  useEffect(() => { currentRotating.current = rotating }, [rotating])
  useEffect(() => { currentNodes.current = nodes }, [nodes])
  useEffect(() => { currentLayout.current = saved.layout; savePositions.current = saved.move }, [saved.layout, saved.move])
  useEffect(() => { currentMovingMaps.current = movingMaps }, [movingMaps])
  useEffect(() => { currentZoom.current = zoom }, [zoom])
  useEffect(() => { currentOrientation.current = orientation }, [orientation])
  // Status updates must not rebuild geometry; the scene represents identity only.
  const { worlds, locations } = spatialLayers(nodes)
  const overLimit = locations.length > MAX_SPATIAL_LOCATIONS
  const active = nodes.find(node => node.id === selected)
  const hasConnections = locations.length > 1 && locations.some(node => spatialLocationKind(node.map) === 'hagga')
  const locationKind = spatialLocationKind(active?.map ?? '')
  const locationLabel = ['unknown', 'dungeon', 'story'].includes(locationKind) ? mapLabel(active?.map) : LOCATION_VISUALS[locationKind].label
  const ids = JSON.stringify([...worlds, ...locations].map(node => [node.id, node.map, node.layoutId]).sort((a, b) => a[0]!.localeCompare(b[0]!)))
  const canMove = !!active?.layoutId && locationKind !== 'overland'
  useEffect(() => { onActiveChange?.(enabled && ready && !overLimit) }, [enabled, ready, overLimit, onActiveChange])
  useEffect(() => {
    if (!enabled || overLimit || !canvas.current) return
    let cancelled = false
    const target = canvas.current
    import('./spatialRenderer').then(({ createSpatialRenderer }) => {
      if (cancelled) return
      const identities = currentNodes.current.map(node => ({ ...node, title: '', phase: '', ready: '', players: '' }))
      engine.current = createSpatialRenderer(target, identities,
        id => callback.current(id),
        () => { setError('Graphics connection lost. The object list and tools remain available.'); setEnabled(false) },
        position => {
          if (!label.current) return
          label.current.style.setProperty('--map-x', `${position.x * 100}%`)
          label.current.style.setProperty('--map-y', `${position.y * 100}%`)
          label.current.style.visibility = position.visible ? 'visible' : 'hidden'
        }, {
          fitViewport,
          orientation: currentOrientation.current.read(),
          onOrientationChange: value => currentOrientation.current.save(value),
          onZoomChange: value => currentZoom.current.set(value),
          labelSize: () => ({
            width: Math.max(80, ...[...mapLabels.current.values()].map(element => element.offsetWidth)),
            height: Math.max(28, ...[...mapLabels.current.values()].map(element => element.offsetHeight)),
          }),
          positions: globePositionsForNodes(identities, currentLayout.current.positions),
          onMove: (positions: GlobePositions) => {
            savePositions.current(Object.fromEntries(identities.flatMap(node => node.layoutId && positions[node.id] ? [[node.layoutId, positions[node.id]]] : [])))
          },
          onMapLabelPositions: positions => positions.forEach(position => {
            const element = mapLabels.current.get(position.id)
            if (!element) return
            element.style.setProperty('--map-x', `${position.x * 100}%`)
            element.style.setProperty('--map-y', `${position.y * 100}%`)
            element.style.visibility = position.visible ? 'visible' : 'hidden'
          }),
        })
      engine.current.select(currentSelection.current)
      engine.current.status(currentNodes.current)
      engine.current.motion(currentRunners.current)
      engine.current.flights(currentFlights.current)
      engine.current.spin(currentRotating.current)
      engine.current.moveMaps(currentMovingMaps.current)
      engine.current.zoom(currentZoom.current.value)
      setReady(true)
    }).catch(() => {
      if (!cancelled) {
        setError('3D could not start on this device. The object list and tools remain available.')
        setEnabled(false)
      }
    })
    return () => { cancelled = true; engine.current?.dispose(); engine.current = null }
  }, [enabled, overLimit, ids, fitViewport])
  useEffect(() => { engine.current?.select(selected) }, [selected, ready, ids, showLabel])
  useEffect(() => { engine.current?.palette() }, [revision, ready])
  useEffect(() => { engine.current?.motion(runners) }, [runners, ready])
  useEffect(() => { engine.current?.flights(flights) }, [flights, ready])
  useEffect(() => { engine.current?.spin(rotating) }, [rotating, ready])
  useEffect(() => { engine.current?.status(nodes) }, [nodes, ready])
  useEffect(() => { engine.current?.zoom(zoom.value) }, [zoom.value, ready, ids])
  useEffect(() => { engine.current?.moveMaps(movingMaps) }, [movingMaps, ready])
  useEffect(() => { engine.current?.layout(globePositionsForNodes(currentNodes.current, saved.layout.positions)) }, [saved.layout, ready, ids])
  return (
    <div className={`spatial-stage${fitViewport ? ' spatial-stage-fit' : ''}${overLimit || !enabled ? ' spatial-stage-overflow' : ''}${movingMaps && enabled ? ' spatial-stage-editing' : ''}`}>
      <div className="spatial-globe-viewport">
      <div className="spatial-scene">
      <div className="spatial-globe-caption"><h1>Arrakis</h1><span>{locations.length} reported location{locations.length === 1 ? '' : 's'}</span></div>
      {enabled && !overLimit && <canvas key={ids} ref={canvas} aria-label={movingMaps ? 'Move maps: hold and drag any location with the left button; hold and drag the right button to rotate the globe' : 'Rotatable Arrakis globe; use Select map for keyboard selection'} />}
      {enabled && !overLimit && <div className="spatial-map-names" role="list" aria-label="Globe map labels">
        {locations.map(node => <div key={node.id} role="listitem" data-map-id={node.id} className="spatial-map-name"
          ref={element => { if (element) mapLabels.current.set(node.id, element); else mapLabels.current.delete(node.id) }}
          style={{ visibility: 'hidden' }}>
          <strong>{node.title}</strong><span>{node.players === 'Unknown' ? 'Player count unknown' : `${node.players} player${node.players === '1' ? '' : 's'}`}</span>
        </div>)}
      </div>}
      {enabled && !overLimit && !fitViewport && showLabel && active && <div className="spatial-detail-label-layer"><div ref={label} className="spatial-map-label" role="status" aria-label="Selected map card" style={{ visibility: 'hidden' }}>
        <strong>{active.title}</strong>
        {active.title !== locationLabel && <span className="spatial-map-label-location">{locationLabel}</span>}
        <div><span>{active.phase}</span><span data-ready={active.ready}>{active.ready}</span></div>
        <p><Icon name="Users" size={14} /><b>{active.players}</b> connected players</p>
        <dl><div><dt>Server age</dt><dd>{active.age || 'Unknown'}</dd></div><div><dt>Map latency</dt><dd>Not reported</dd></div></dl>
        <small>{stale ? 'Last available observation' : 'Observed'}: {observedAt}</small>
      </div></div>}
      {(!enabled || overLimit) && (
        <div className="spatial-stage-rest">
          {!overLimit && <p>Map health and selection are available in 2D.</p>}
          {overLimit && <><h2>2D map view</h2><p>{`3D is paused above ${MAX_SPATIAL_LOCATIONS} map instances. Every map remains selectable in the list.`}</p></>}
          {!overLimit && <button className="spatial-primary" onClick={() => { setError(''); setReady(false); setEnabled(true) }}>Enter spatial view <span aria-hidden="true">↗</span></button>}
          <small>{overLimit ? 'No maps are hidden. Connected-user details remain available.' : '3D globe on demand. All tools remain available in 2D.'}</small>
        </div>
      )}
      {enabled && !overLimit && <p className="spatial-interaction-hint">{ready ? movingMaps ? 'Left-drag a location. Right-drag to rotate. Release to save.' : 'Drag to spin · Select a map' : 'Preparing globe...'}</p>}
      {error && <p className="spatial-stage-error" role="status">{error}</p>}
      <span className="spatial-schematic-label">ILLUSTRATIVE ARRAKIS / NOT SURVEYED GEOGRAPHY</span>
      {roster}
      {details}
      </div>
      </div>
      {enabled && !overLimit && <div className="spatial-stage-controls">
        {controlsHidden ? <button ref={restoreControls} aria-label="Show globe controls" onClick={() => {
          setControlsHidden(false)
          window.requestAnimationFrame(() => hideControls.current?.focus())
        }}>Show controls{movingMaps && <span> · Moving maps</span>}</button> : <>
        <div className="spatial-control-list">
        <div className="spatial-zoom-controls" role="group" aria-label="Globe zoom">
          <button type="button" aria-label="Zoom out" disabled={!ready || zoom.value <= MIN_GLOBE_ZOOM} onClick={() => zoom.set(zoom.value - .1)}><Icon name="Minus" size={15} /></button>
          <output aria-label="Globe zoom level" title="Saved zoom relative to the fitted view">{Math.round(zoom.value * 100)}%</output>
          <button type="button" aria-label="Zoom in" disabled={!ready || zoom.value >= MAX_GLOBE_ZOOM} onClick={() => zoom.set(zoom.value + .1)}><Icon name="Plus" size={15} /></button>
          <button type="button" disabled={!ready} onClick={() => { zoom.set(1); engine.current?.fit() }}>Fit</button>
        </div>
        <button disabled={!ready} onClick={() => { zoom.set(1); setGlobeAutoRotate(false); engine.current?.reset() }} title="Release any gesture and restore fitted camera orientation and zoom; keep map placements">Reset view</button>
        <button disabled={!ready} onClick={saved.reset} title="Restore default icon positions without changing the camera">Reset map positions</button>
        <select aria-label="Select map" value={selected} onChange={event => onSelect(event.target.value)}>
          {!nodes.length && <option value="">No maps reported</option>}
          {spatialStatusOrder(nodes).map(node => <option key={node.id} value={node.id}>{node.title} / {node.players} players</option>)}
        </select>
        <button disabled={!ready || !locations.length} aria-pressed={movingMaps} onClick={() => setMovingMaps(value => !value)}>{movingMaps ? 'Done moving' : 'Move maps'}</button>
        <button disabled={!ready || !hasConnections} aria-pressed={runners && hasConnections} title={hasConnections ? 'Hagga connections: green is ready, red is not ready. Pulses are decorative, not traffic; respects reduced motion.' : 'Connections require a reported Hagga instance and another map.'} onClick={() => setRunners(value => !value)}>Signal runners</button>
        <button disabled={!ready} aria-pressed={flights} title="Simulated travel dots and trails, not actual players or measured traffic. Respects reduced motion." onClick={() => setFlights(value => !value)}>Simulated travel</button>
        <button disabled={!ready || movingMaps} aria-pressed={rotating && !movingMaps} title="Slow globe rotation. Paused while moving maps. Respects reduced motion." onClick={() => setGlobeAutoRotate(!rotating)}>Auto rotate</button>
        <button onClick={() => { setEnabled(false); setReady(false); onExit?.() }}>Disable 3D</button>
        </div>
        <button ref={hideControls} aria-label="Hide globe controls" title="Hide controls without changing the current globe mode" onClick={() => {
          setControlsHidden(true)
          window.requestAnimationFrame(() => restoreControls.current?.focus())
        }}><Icon name="EyeOff" size={15} /></button>
        </>}
      </div>}
      {enabled && !overLimit && movingMaps && !controlsHidden && <section className="spatial-layout-editor" aria-label="Globe layout">
        <div>
          <strong>Keyboard positioning</strong>
          <p className={fitViewport ? 'sr-only' : undefined} id={layoutHelpId}>{canMove ? `Left-drag any location; right-drag to rotate. Selected: ${active.title}. These buttons or arrow keys are an alternative to dragging. Escape cancels a drag.` : locationKind === 'overland' ? 'Overmap is the login context, not a globe location.' : 'This map has no unique instance identity. Its position cannot be saved safely.'}</p>
        </div>
        <div className="spatial-layout-nudges" role="group" aria-label="Move selected map" aria-describedby={layoutHelpId} onKeyDown={event => {
          const steps: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }
          if (canMove && steps[event.key]) { event.preventDefault(); engine.current?.nudge(selected, ...steps[event.key]) }
        }}>
          {MOVE_DIRECTIONS.map(direction => <button key={direction.label} disabled={!ready || !canMove} aria-label={`Move map ${direction.label.toLowerCase()}`} onClick={() => engine.current?.nudge(selected, direction.x, direction.y)}><Icon name={direction.icon} size={18} /></button>)}
        </div>
        <small className={fitViewport ? 'sr-only' : undefined}>Visual layout only. Saved in this browser; game locations never change.</small>
      </section>}
      {saved.notice && <p className="spatial-layout-notice" role="status" data-error={saved.failed}>{saved.notice}</p>}
      {zoom.error && <p className="spatial-layout-notice" role="status" data-error="true">{zoom.error}</p>}
      {orientation.error && <p className="spatial-layout-notice" role="status" data-error="true">{orientation.error}</p>}
    </div>
  )
}
