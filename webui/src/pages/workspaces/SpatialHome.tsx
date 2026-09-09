import { useCallback, useMemo, useState } from 'react'
import { Link } from '../../router'
import { useStatus } from '../../hooks/useStatus'
import { mapLabel } from '../../util/mapLabel'
import { statusLabel } from '../../util/statusLabel'
import { Icon } from '../../components/Icon'
import SpatialFrame from '../../layout/SpatialFrame'
import SpatialStage from './SpatialStage'
import SpatialMapDetails from './SpatialMapDetails'
import { spatialLayers, spatialLocationKind, spatialNodes, spatialStatusOrder } from './spatialModel'
import { HealthRefreshControl } from '../../components/HealthRefreshControl'
import './spatial.css'
import './spatialDashboard.css'

export default function SpatialHome({ onDetails, startEnabled = false }: { onDetails: () => void; startEnabled?: boolean }) {
  const { status, error, loading, refresh } = useStatus()
  const [selection, setSelection] = useState('')
  const select = useCallback((id: string) => setSelection(id), [])
  const [refreshError, setRefreshError] = useState('')
  const nodes = useMemo(() => spatialStatusOrder(spatialNodes(status?.bg?.gameServers ?? [], mapLabel)), [status?.bg?.gameServers])
  const { worlds, locations } = spatialLayers(nodes)
  const active = nodes.find(node => node.id === selection) ?? locations.find(node => spatialLocationKind(node.map) === 'hagga') ?? worlds[0] ?? locations[0]
  const hasSelection = nodes.some(node => node.id === selection)
  const observation = status?.bg?.observedAt || status?.ts
  const stamp = observation ? new Date(observation) : null
  const knownStamp = stamp && Number.isFinite(stamp.getTime()) ? stamp.toLocaleString() : 'Not reported'
  const shortStamp = stamp && Number.isFinite(stamp.getTime()) ? stamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not reported'
  const stale = !!(error || refreshError)
  const summary = [
    ['VM', status?.vm?.state || 'Not reported'],
    ['Battlegroup', status?.bg?.state || 'Not reported'],
    ['Database', status?.bg?.info?.database || 'Not reported'],
    ['Gateway', status?.bg?.info?.gateway || 'Not reported'],
  ]
  const roster = <aside className="spatial-dashboard-roster" aria-label="Map status roster">
    <ul>
      {nodes.map(node => {
        const duplicateName = nodes.filter(other => other.title === node.title).length > 1
        const name = duplicateName ? `${node.title} (${node.map}, instance ${Number(node.id.slice(node.id.lastIndexOf(':') + 1)) + 1})` : node.title
        const statusText = statusLabel(node.ready === 'Ready' ? 'Ready' : ['running', 'unknown'].includes(node.phase.toLowerCase()) ? node.ready : node.phase)
        return <li key={node.id}><button type="button" aria-pressed={hasSelection && selection === node.id}
          aria-label={spatialLocationKind(node.map) === 'overland' ? `Inspect Overmap: ${node.phase}, ${node.ready}, ${node.players} players` : `Select ${name}: ${node.phase}, ${node.ready}, ${node.players} players`}
          onClick={() => select(node.id)} title={`${name} - ${statusText} - ${node.players}`}>
          <span className="spatial-roster-line" data-ready={node.ready}>{name} - {statusText} - {node.players}</span>
        </button></li>
      })}
    </ul>
    {!nodes.length && <p>No map instances reported.</p>}
    {stale && <p className="spatial-roster-stale">Last available status</p>}
  </aside>
  const instances = nodes.filter(node => node.map === active?.map).length
  const details = <aside className="spatial-dashboard-inspector" aria-label="Selected map details" hidden={!hasSelection}>
    <header><h2>{active?.title || 'Map details'}</h2><button type="button" onClick={() => select('')} aria-label="Close map details"><Icon name="X" size={18} /></button></header>
    <div className="spatial-dashboard-inspector-body">
      <dl>
        {active && active.title !== mapLabel(active.map) && <div><dt>Location</dt><dd>{mapLabel(active.map)}</dd></div>}
        <div><dt>Map</dt><dd>{active?.map || 'Not reported'}</dd></div>
        <div><dt>Phase</dt><dd>{statusLabel(active?.phase || 'Unknown')}</dd></div>
        <div><dt>Readiness</dt><dd>{statusLabel(active?.ready || 'Unknown')}</dd></div>
        <div><dt>Reported players</dt><dd>{active?.players ?? 'Unknown'}</dd></div>
        <div><dt>Server age</dt><dd>{active?.age || 'Not reported'}</dd></div>
      </dl>
      <SpatialMapDetails
        node={active}
        selected={hasSelection}
        instances={instances}
        observedAt={knownStamp}
        stale={stale}
      />
      <Link to="/map" className="spatial-primary">Open map workspace<Icon name="ArrowUpRight" size={16} /></Link>
      <Link to="/pods" className="spatial-secondary">Inspect workloads<Icon name="ArrowUpRight" size={15} /></Link>
    </div>
  </aside>
  return <SpatialFrame dashboard onDetails={onDetails}>
    <div className="spatial-dashboard-content">
      <section className="spatial-dashboard-summary" aria-label="Server status summary">
        <dl>{summary.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{statusLabel(value)}</dd></div>)}</dl>
        <HealthRefreshControl />
        <div className="spatial-dashboard-observation">
          <span title={knownStamp}>{stale ? 'Last available' : loading ? 'Refreshing' : 'Observed'} {shortStamp}</span>
          <button type="button" disabled={loading} onClick={() => {
            setRefreshError('')
            void refresh().catch(reason => setRefreshError(reason instanceof Error ? reason.message : 'Refresh failed'))
          }} aria-label="Refresh snapshot"><Icon name="RefreshCw" size={15} /></button>
        </div>
      </section>
      {stale && <p className="spatial-dashboard-error" role="status">{refreshError || error}. Displaying the last available observation.</p>}
      <section className="spatial-dashboard-surface" aria-label="World workspace">
        <SpatialStage nodes={nodes} selected={active?.id ?? ''} onSelect={select} showLabel={hasSelection}
          initiallyEnabled={startEnabled} onExit={startEnabled ? onDetails : undefined} observedAt={knownStamp}
          stale={stale} fitViewport roster={roster} details={details} />
      </section>
    </div>
  </SpatialFrame>
}
