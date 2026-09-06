import * as T from 'three'
import { MAX_SPATIAL_LOCATIONS, spatialConnections, spatialSceneLayout, spatialLayers, spatialLocationKind, type SpatialLocationKind, type SpatialNode } from './spatialModel'
import { createSpatialLandmark } from './spatialLandmarks'
import { ARRAKIS_RADIUS, ARRAKIS_VIEW_SIZE, arrangeGlobeLocations, GlobeArc } from './arrakisGlobe'
import { createGlobeRoute, globeSignalColor, routeColor, routeEndpointColors } from './globeRoutes'
import { conformGlobeLandmark, globeEmblemDensityScale, globeSurfaceRadius } from './globeEmblems'
import { type GlobeLabelPosition, type GlobePositions } from './globeLayout'
import { createGlobeFlights } from './globeFlights'
import { createGlobeTopography } from './globeTopography'
import { GLOBE_MATERIAL_BRIGHTNESS, GLOBE_SURFACE_COLOR } from './globePalette'
import { TERRAIN_MAX_HEIGHT } from './globeTerrain'
import { clampGlobeZoom } from './globeZoom'
import type { GlobeOrientation } from '../../hooks/useGlobeOrientation'

export function createSpatialRenderer(
  canvas: HTMLCanvasElement,
  nodes: SpatialNode[],
  onSelect: (id: string) => void,
  onFailure: () => void,
  onLabelPosition?: (position: { x: number; y: number; visible: boolean }) => void,
  placement?: {
    fitViewport?: boolean
    labelSize?: () => { width: number; height: number }
    onZoomChange?: (zoom: number) => void
    orientation?: GlobeOrientation
    onOrientationChange?: (orientation: GlobeOrientation) => void
    positions: GlobePositions
    onMove: (positions: GlobePositions) => void
    onDragChange?: (id: string | null) => void
    onMapLabelPositions?: (positions: GlobeLabelPosition[]) => void
  },
) {
  const { worlds, locations } = spatialLayers(nodes)
  if (locations.length > MAX_SPATIAL_LOCATIONS) throw new Error('Too many map instances for 3D; use the complete 2D map list')
  const layout = spatialSceneLayout(nodes)
  const globeLocations = arrangeGlobeLocations(layout.placements, placement?.positions)
  const densityScale = globeEmblemDensityScale(locations.length)
  const links = spatialConnections(layout.placements)
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power', alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25))
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new T.Scene()
  const camera = new T.OrthographicCamera(-8, 8, 8, -8, .1, 100)
  camera.position.set(0, 0, 30)
  camera.lookAt(0, 0, 0)
  const ambient = new T.HemisphereLight(0xf2efff, 0x39333e, 1)
  scene.add(ambient)
  const sun = new T.DirectionalLight(0xfff4ef, 3.2)
  sun.position.set(12, 16, 14)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: .5, far: 50 })
  sun.shadow.normalBias = .012
  sun.shadow.bias = -.0001
  sun.shadow.camera.updateProjectionMatrix()
  scene.add(sun)
  const fill = new T.DirectionalLight(0xbfc9da, .35)
  fill.position.set(-8, 2, 10)
  scene.add(fill)
  const world = new T.Group()
  world.rotation.set(placement?.orientation?.pitch ?? 0, placement?.orientation?.yaw ?? 0, 0)
  scene.add(world)
  let savedOrientation = { pitch: world.rotation.x, yaw: world.rotation.y }
  let lastOrientationSave = performance.now()
  function saveOrientation(force = false) {
    const orientation = { pitch: world.rotation.x, yaw: Math.atan2(Math.sin(world.rotation.y), Math.cos(world.rotation.y)) }
    if (!force && orientation.pitch === savedOrientation.pitch && orientation.yaw === savedOrientation.yaw) return
    placement?.onOrientationChange?.(orientation)
    savedOrientation = orientation
    lastOrientationSave = performance.now()
  }

  const sphere = new T.SphereGeometry(ARRAKIS_RADIUS, 128, 80)
  sphere.computeBoundingSphere()
  const planet = new T.Mesh(sphere, new T.MeshStandardMaterial({ color: GLOBE_SURFACE_COLOR, roughness: 1, metalness: 0 }))
  planet.material.color.multiplyScalar(GLOBE_MATERIAL_BRIGHTNESS)
  planet.receiveShadow = true
  world.add(planet)
  const topography = createGlobeTopography()
  world.add(topography)
  world.add(new T.Mesh(new T.SphereGeometry(ARRAKIS_RADIUS * 1.012, 48, 32),
    new T.MeshBasicMaterial({ color: 0xd9d1e5, transparent: true, opacity: .1, side: T.BackSide, depthWrite: false })))
  // The planet is also an occlusion target: far-side markers cannot be clicked through it.
  const picks: T.Object3D[] = [planet, topography]
  const stone = new T.MeshStandardMaterial({ color: 0x4e6c66, roughness: .8, metalness: .05, flatShading: true })
  const strata = new T.MeshStandardMaterial({ color: 0x2e423f, roughness: .9, metalness: .05, flatShading: true })
  const baseMaterial = new T.MeshStandardMaterial({ color: 0x19232d, roughness: .5, metalness: .5, transparent: true, opacity: .28, depthWrite: false })
  const templates = new Map<SpatialLocationKind, T.Group>()
  const emblems = new Map<string, { group: T.Group; symbol: T.Group; landmark: T.Group; normal: T.Vector3; template: T.Group; scale: number }>()
  const anchors = new Map<string, { object: T.Object3D; normal: T.Vector3 }>()
  const rings = new Map<string, T.MeshBasicMaterial>()
  const normals = new Map<string, T.Vector3>()
  const highlights: T.MeshBasicMaterial[] = []
  const routes: (ReturnType<typeof createGlobeRoute> & { source: string; destination: string })[] = []
  const readiness = new Map(nodes.map(node => [node.id, node.ready]))
  const axis = new T.Vector3(0, 1, 0)
  globeLocations.forEach(({ node, scale, normal }) => {
    const emblemScale = scale * .48 * densityScale
    normals.set(node.id, normal)
    const group = new T.Group()
    group.position.copy(normal).multiplyScalar(globeSurfaceRadius(normal))
    group.quaternion.setFromUnitVectors(axis, normal)
    group.scale.setScalar(emblemScale)
    const base = new T.Mesh(new T.SphereGeometry(.16, 8, 6), baseMaterial)
    group.add(base)
    const kind = spatialLocationKind(node.map)
    let template = templates.get(kind)
    if (!template) {
      template = createSpatialLandmark(kind, stone, strata)
      templates.set(kind, template)
    }
    const landmark = conformGlobeLandmark(template, normal, emblemScale)
    landmark.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true } })
    const height = new T.Box3().setFromObject(landmark).max.y + .4
    const symbol = new T.Group()
    symbol.add(landmark)
    group.add(symbol)
    const ringMaterial = new T.MeshBasicMaterial({ color: 0x9edce5 })
    const ring = new T.Mesh(new T.TorusGeometry(.42, .035, 5, 32), ringMaterial)
    ring.rotation.x = Math.PI / 2
    group.add(ring)
    rings.set(node.id, ringMaterial)
    const beaconMaterial = new T.MeshBasicMaterial({ color: 0x9edce5 })
    const beacon = new T.Mesh(new T.CylinderGeometry(.02, .02, height, 5), beaconMaterial)
    beacon.position.y = height / 2
    symbol.add(beacon)
    const marker = new T.Mesh(new T.OctahedronGeometry(.14), beaconMaterial)
    marker.position.y = height
    symbol.add(marker)
    highlights.push(beaconMaterial)
    anchors.set(node.id, { object: marker, normal })
    group.traverse(object => { object.userData.nodeId = node.id })
    symbol.traverse(object => { object.userData.nodeId = node.id })
    world.add(group)
    emblems.set(node.id, { group, symbol, landmark, normal, template, scale: emblemScale })
    picks.push(base, marker)
  })
  function refreshPicks() {
    picks.length = 0
    picks.push(planet, topography)
    emblems.forEach(emblem => emblem.group.traverse(object => { if (object instanceof T.Mesh) picks.push(object) }))
  }
  refreshPicks()
  let fitRadius = ARRAKIS_VIEW_SIZE / 2
  world.updateMatrixWorld(true)
  const extentPoint = new T.Vector3()
  emblems.forEach(emblem => {
    const terrainAllowance = ARRAKIS_RADIUS + TERRAIN_MAX_HEIGHT - emblem.group.position.length()
    emblem.group.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      const positions = object.geometry.attributes.position
      for (let index = 0; index < positions.count; index++) {
        extentPoint.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld)
        fitRadius = Math.max(fitRadius, extentPoint.length() + terrainAllowance + .15)
      }
    })
  })
  links.forEach(({ from, to }, index) => {
    const fromNormal = normals.get(from.node.id)
    const toNormal = normals.get(to.node.id)
    if (!fromNormal || !toNormal) throw new Error('Map connection has no globe placement')
    const curve = new GlobeArc(fromNormal, toNormal, ARRAKIS_RADIUS)
    const route = createGlobeRoute(curve, index * .17)
    world.add(route.backing, route.mesh)
    routes.push({ ...route, source: from.node.id, destination: to.node.id })
  })
  const travel = createGlobeFlights(ARRAKIS_RADIUS)
  world.add(travel.group)

  let disposed = false, frame = 0, visible = true, motion = false, spinning = false, movingMaps = false, flights = false
  let motionTimer: ReturnType<typeof setTimeout> | undefined
  let selectedId = locations.find(node => spatialLocationKind(node.map) === 'hagga')?.id ?? worlds[0]?.id ?? ''
  let selectedColor = '#edc398', idleColor = '#668492', readyColor = '#4ade80', notReadyColor = '#f87171'
  let lastDraw = performance.now()
  let start: { x: number; y: number; yaw: number; pitch: number; pointerId: number; button: number; selection: string; moved: boolean; map?: { id: string; original: T.Vector3; surface: T.Vector3 } } | null = null
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const labelPoint = new T.Vector3(), facing = new T.Vector3()
  const ray = new T.Raycaster(), pointer = new T.Vector2()
  const dirtyRoutes = new Set<string>()
  const dirtyEmblems = new Set<string>()
  let shadowDirty = true, shadowRefreshes = 0
  function fitFrame() {
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    world.updateMatrixWorld(true)
    let extentX = ARRAKIS_RADIUS + TERRAIN_MAX_HEIGHT, extentY = extentX
    emblems.forEach(emblem => emblem.group.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      const positions = object.geometry.attributes.position
      for (let index = 0; index < positions.count; index++) {
        extentPoint.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).sub(world.position)
        extentX = Math.max(extentX, Math.abs(extentPoint.x))
        extentY = Math.max(extentY, Math.abs(extentPoint.y))
      }
    }))
    const labelSize = placement?.labelSize?.() ?? { width: 120, height: 32 }
    const horizontalPad = Math.min(labelSize.width / 2 + 10, width * .2)
    const topPad = Math.min(labelSize.height + 12, height * .2), bottomPad = Math.min(20, height * .08)
    const pixelsPerUnit = Math.min(Math.max(1, width - horizontalPad * 2) / (extentX * 2), Math.max(1, height - topPad - bottomPad) / (extentY * 2))
    camera.left = -width / (2 * pixelsPerUnit)
    camera.right = width / (2 * pixelsPerUnit)
    const offset = (topPad - bottomPad) / 2
    camera.top = (height / 2 + offset) / pixelsPerUnit
    camera.bottom = (-height / 2 + offset) / pixelsPerUnit
    camera.updateProjectionMatrix()
    if (!frame) requestDraw()
  }
  function positionMap(id: string, normal: T.Vector3) {
    const emblem = emblems.get(id)
    if (!emblem) throw new Error('Map has no globe emblem')
    emblem.normal.copy(normal).normalize()
    emblem.group.position.copy(emblem.normal).multiplyScalar(globeSurfaceRadius(emblem.normal))
    emblem.group.quaternion.setFromUnitVectors(axis, emblem.normal)
    dirtyEmblems.add(id)
    shadowDirty = true
    dirtyRoutes.add(id)
    requestDraw()
  }
  function commitMap(id: string) {
    if (!emblems.has(id)) throw new Error('Map has no globe emblem')
    placement?.onMove(Object.fromEntries([...emblems].map(([key, emblem]) => [key, [emblem.normal.x, emblem.normal.y, emblem.normal.z]])))
  }
  function stopTimer() { clearTimeout(motionTimer); motionTimer = undefined }
  function updateRings() {
    rings.forEach((material, id) => material.color.set(id === (start?.map?.id ?? selectedId) ? selectedColor : routeColor(readiness.get(id), readyColor, notReadyColor, idleColor)))
    routes.forEach(route => {
      const colors = routeEndpointColors(readiness.get(route.source), readiness.get(route.destination), readyColor, notReadyColor, idleColor)
      route.material.uniforms.startColor.value.set(colors.start)
      route.material.uniforms.endColor.value.set(colors.end)
    })
  }
  function palette() {
    const style = getComputedStyle(canvas)
    selectedColor = style.getPropertyValue('--color-accent').trim() || '#edc398'
    idleColor = style.getPropertyValue('--color-border-bright').trim() || '#668492'
    readyColor = globeSignalColor(style.getPropertyValue('--color-success').trim() || '#4ade80')
    notReadyColor = globeSignalColor(style.getPropertyValue('--color-danger').trim() || '#f87171')
    const highlight = style.getPropertyValue('--color-ibad').trim() || '#9edce5'
    baseMaterial.color.set(style.getPropertyValue('--color-surface-3').trim() || '#19232d')
    highlights.forEach(material => material.color.set(highlight))
    travel.color(highlight)
    updateRings()
    requestDraw()
  }
  function draw() {
    frame = 0
    stopTimer()
    const now = performance.now()
    const delta = Math.min((now - lastDraw) / 1000, .1)
    lastDraw = now
    if (disposed || !visible || document.hidden) return
    const animate = motion && routes.length > 0 && !reducedMotion.matches
    const rotate = spinning && !movingMaps && !reducedMotion.matches
    const simulatedTravel = flights && !reducedMotion.matches
    travel.update(now / 1000, simulatedTravel)
    if (rotate && !start) { world.rotation.y += delta * .085; shadowDirty = true }
    if (rotate && !start && now - lastOrientationSave >= 2000) saveOrientation()
    // Conform once per rendered frame, not once per pointer event.
    dirtyEmblems.forEach(id => {
      const emblem = emblems.get(id)!
      emblem.symbol.remove(emblem.landmark)
      emblem.landmark.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose() })
      emblem.landmark = conformGlobeLandmark(emblem.template, emblem.normal, emblem.scale)
      emblem.landmark.traverse(object => {
        object.userData.nodeId = id
        if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true }
      })
      emblem.symbol.add(emblem.landmark)
    })
    if (dirtyEmblems.size) refreshPicks()
    dirtyEmblems.clear()
    for (const route of routes) {
      if (dirtyRoutes.has(route.source) || dirtyRoutes.has(route.destination)) {
        route.setCurve(new GlobeArc(normals.get(route.source)!, normals.get(route.destination)!, ARRAKIS_RADIUS))
      }
      route.material.uniforms.moving.value = animate ? 1 : 0
      route.material.uniforms.head.value = (now / 5000 + route.offset) % 1
    }
    dirtyRoutes.clear()
    world.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const labelPositions = [...anchors].map(([id, anchor]) => {
      anchor.object.getWorldPosition(labelPoint).project(camera)
      facing.copy(anchor.normal).applyQuaternion(world.quaternion)
      return { id, x: (labelPoint.x + 1) / 2, y: (1 - labelPoint.y) / 2,
        visible: facing.z > .05 && Math.abs(labelPoint.x) < .96 && Math.abs(labelPoint.y) < .94 && Math.abs(labelPoint.z) <= 1 }
    })
    placement?.onMapLabelPositions?.(labelPositions)
    onLabelPosition?.(labelPositions.find(position => position.id === selectedId) ?? { x: .5, y: .5, visible: false })
    renderer.shadowMap.needsUpdate = shadowDirty
    if (renderer.shadowMap.needsUpdate) shadowRefreshes++
    renderer.render(scene, camera)
    shadowDirty = false
    Object.assign(canvas.dataset, {
      scene: 'arrakis-globe', motion: animate ? 'running' : 'paused', rotation: rotate ? 'running' : 'paused',
      locationCount: String(locations.length), worldMapCount: String(worlds.length),
      emblemDensityScale: String(densityScale),
      visibleEmblems: String([...emblems.values()].filter(emblem => facing.copy(emblem.normal).applyQuaternion(world.quaternion).z > 0).length),
      interaction: movingMaps ? 'move-maps' : 'spin',
      globeShiftPixels: '0',
      simulatedTravel: simulatedTravel ? 'running' : 'paused',
      terrain: 'shield-walls', shadowMapSize: '1024', shadowRefreshes: String(shadowRefreshes),
      lighting: 'fixed-top-right', darkTerrainArea: String(topography.userData.darkAreaFraction),
      viewportFit: String(!!placement?.fitViewport), fitRadius: String(fitRadius),
      zoom: String(camera.zoom),
      connectionHub: links[0]?.from.node.id ?? '', connectionCount: String(links.length),
      readyConnections: String(routes.filter(route => readiness.get(route.source) === 'Ready' && readiness.get(route.destination) === 'Ready').length),
      notReadyConnections: String(routes.filter(route => readiness.get(route.source) === 'Not ready' || readiness.get(route.destination) === 'Not ready').length),
      frames: String(renderer.info.render.frame), drawCalls: String(renderer.info.render.calls), triangles: String(renderer.info.render.triangles),
    })
    if (animate || rotate || simulatedTravel) motionTimer = setTimeout(requestDraw, 1000 / 24)
  }
  function requestDraw() { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
  const resize = new ResizeObserver(() => {
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    renderer.setSize(width, height, false)
    if (placement?.fitViewport) { fitFrame(); return }
    const aspect = width / height
    const frameHeight = ARRAKIS_VIEW_SIZE * Math.max(1, 1 / aspect)
    camera.left = -frameHeight * aspect / 2
    camera.right = frameHeight * aspect / 2
    camera.top = frameHeight / 2
    camera.bottom = -frameHeight / 2
    camera.updateProjectionMatrix()
    requestDraw()
  })
  resize.observe(canvas)
  const observer = new IntersectionObserver(entries => {
    visible = entries[0]?.isIntersecting ?? false
    if (visible) requestDraw()
    else stopTimer()
  })
  observer.observe(canvas)
  function pointRay(event: PointerEvent) {
    world.updateMatrixWorld(true)
    const rect = canvas.getBoundingClientRect()
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
    ray.setFromCamera(pointer, camera)
  }
  function pick(event: PointerEvent) {
    pointRay(event)
    const visiblePicks = picks.filter(object => {
      let current: T.Object3D | null = object
      while (current) {
        if (!current.visible) return false
        current = current.parent
      }
      return true
    })
    return ray.intersectObjects(visiblePicks, false)[0]
  }
  function surfacePoint(event: PointerEvent) {
    pointRay(event)
    const centre = world.getWorldPosition(new T.Vector3())
    const point = ray.ray.intersectSphere(new T.Sphere(centre, ARRAKIS_RADIUS), new T.Vector3())
    // Tall emblems can project beyond the planet's silhouette. Clamp the grab
    // to the rim so those visible icons are still directly draggable.
    const surface = point ?? ray.ray.closestPointToPoint(centre, new T.Vector3()).sub(centre).setLength(ARRAKIS_RADIUS).add(centre)
    return world.worldToLocal(surface).normalize()
  }
  function down(event: PointerEvent) {
    if (start || (event.button !== 0 && !(movingMaps && event.button === 2)) || !event.isPrimary) return
    const hit = pick(event)
    const id: unknown = hit?.object.userData.nodeId
    const surface = movingMaps && event.button === 0 ? surfacePoint(event) : null
    const movable = typeof id === 'string' && nodes.some(node => node.id === id && node.layoutId)
    start = {
      x: event.clientX, y: event.clientY, yaw: world.rotation.y, pitch: world.rotation.x,
      pointerId: event.pointerId, button: event.button, selection: selectedId, moved: false,
      map: movingMaps && movable && surface ? { id, original: emblems.get(id)!.normal.clone(), surface } : undefined,
    }
    if (start.map) {
      placement?.onDragChange?.(start.map.id)
      updateRings()
      requestDraw()
    }
    canvas.setPointerCapture(event.pointerId)
  }
  function move(event: PointerEvent) {
    if (!start || start.pointerId !== event.pointerId) return
    start.moved ||= Math.hypot(event.clientX - start.x, event.clientY - start.y) >= 6
    if (!start.moved) return
    if (start.map) {
      const normal = surfacePoint(event)
      // Preserve the grab offset so tall emblems do not jump under the pointer.
      const rotation = new T.Quaternion().setFromUnitVectors(start.map.surface, normal)
      positionMap(start.map.id, start.map.original.clone().applyQuaternion(rotation))
    } else if (!movingMaps || start.button === 2) {
      world.rotation.y = start.yaw + (event.clientX - start.x) * .006
      world.rotation.x = T.MathUtils.clamp(start.pitch + (event.clientY - start.y) * .006, -1.35, 1.35)
      shadowDirty = true
      requestDraw()
    }
  }
  function up(event: PointerEvent) {
    if (!start || start.pointerId !== event.pointerId) return
    move(event)
    const ended = start
    start = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    if (ended.map && ended.moved) {
      commitMap(ended.map.id)
      placement?.onDragChange?.(null)
      updateRings()
      requestDraw()
      return
    }
    placement?.onDragChange?.(null)
    if (ended.moved) saveOrientation()
    if (ended.moved || ended.button !== 0) return
    const hit = pick(event)
    onSelect(hit && typeof hit.object.userData.nodeId === 'string' ? hit.object.userData.nodeId : '')
  }
  function cancel(event?: PointerEvent) {
    if (event && start?.pointerId !== event.pointerId) return
    const cancelled = start
    start = null
    if (!cancelled) return
    if (cancelled.map && cancelled.moved) positionMap(cancelled.map.id, cancelled.map.original)
    if (!cancelled.map) saveOrientation()
    selectedId = cancelled.selection
    placement?.onDragChange?.(null)
    updateRings()
    requestDraw()
    if (canvas.hasPointerCapture(cancelled.pointerId)) canvas.releasePointerCapture(cancelled.pointerId)
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && start) { event.preventDefault(); cancel() }
  }
  function contextmenu(event: MouseEvent) { if (movingMaps) event.preventDefault() }
  function zoom(value: number) {
    camera.zoom = clampGlobeZoom(value)
    camera.updateProjectionMatrix()
    requestDraw()
  }
  function wheel(event: WheelEvent) {
    if (!placement?.fitViewport || event.ctrlKey || event.metaKey || !Number.isFinite(event.deltaY) || !event.deltaY) return
    event.preventDefault()
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1)
    zoom(camera.zoom * Math.exp(-pixels * .0015))
    placement.onZoomChange?.(camera.zoom)
  }
  function lost(event: Event) { event.preventDefault(); onFailure() }
  function saveOnPageHide() { saveOrientation() }
  function visibilityChange() { saveOrientation(); stopTimer(); lastDraw = performance.now(); requestDraw() }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', cancel)
  canvas.addEventListener('lostpointercapture', cancel)
  canvas.addEventListener('contextmenu', contextmenu)
  canvas.addEventListener('wheel', wheel, { passive: false })
  document.addEventListener('keydown', keydown)
  canvas.addEventListener('webglcontextlost', lost)
  document.addEventListener('visibilitychange', visibilityChange)
  window.addEventListener('pagehide', saveOnPageHide)
  reducedMotion.addEventListener('change', visibilityChange)
  palette()
  return {
    select(id: string) {
      selectedId = id
      updateRings()
      requestDraw()
    },
    palette,
    zoom,
    fit() { cancel(); zoom(1); if (placement?.fitViewport) fitFrame() },
    moveMaps(enabled: boolean) { cancel(); movingMaps = enabled; requestDraw() },
    layout(positions: GlobePositions) {
      cancel()
      arrangeGlobeLocations(layout.placements, positions).forEach(({ node, normal }) => {
        if (normal.distanceToSquared(emblems.get(node.id)!.normal) > 1e-12) positionMap(node.id, normal)
      })
    },
    nudge(id: string, horizontal: number, vertical: number) {
      if (!movingMaps || !nodes.some(node => node.id === id && node.layoutId)) return
      cancel()
      const normal = emblems.get(id)!.normal.clone().applyQuaternion(world.quaternion)
      normal.applyAxisAngle(new T.Vector3(0, 1, 0), horizontal * .07)
      normal.applyAxisAngle(new T.Vector3(1, 0, 0), -vertical * .07)
      normal.applyQuaternion(world.quaternion.clone().invert())
      positionMap(id, normal)
      commitMap(id)
    },
    status(next: SpatialNode[]) {
      readiness.clear()
      next.forEach(node => readiness.set(node.id, node.ready))
      updateRings()
      requestDraw()
    },
    motion(enabled: boolean) { motion = enabled; stopTimer(); requestDraw() },
    flights(enabled: boolean) { flights = enabled; stopTimer(); requestDraw() },
    spin(enabled: boolean) { if (!enabled) saveOrientation(); spinning = enabled; lastDraw = performance.now(); stopTimer(); requestDraw() },
    reset() {
      cancel()
      spinning = false
      stopTimer()
      world.rotation.set(0, 0, 0)
      saveOrientation(true)
      zoom(1)
      if (placement?.fitViewport) fitFrame()
      shadowDirty = true
      requestDraw()
    },
    dispose() {
      cancel()
      saveOrientation()
      disposed = true
      stopTimer()
      cancelAnimationFrame(frame)
      resize.disconnect()
      observer.disconnect()
      document.removeEventListener('visibilitychange', visibilityChange)
      window.removeEventListener('pagehide', saveOnPageHide)
      reducedMotion.removeEventListener('change', visibilityChange)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('lostpointercapture', cancel)
      canvas.removeEventListener('contextmenu', contextmenu)
      canvas.removeEventListener('wheel', wheel)
      document.removeEventListener('keydown', keydown)
      canvas.removeEventListener('webglcontextlost', lost)
      const geometries = new Set<T.BufferGeometry>()
      const materials = new Set<T.Material>([stone, strata, baseMaterial])
      scene.traverse(object => {
        if (object instanceof T.Mesh || object instanceof T.Line) {
          geometries.add(object.geometry)
          for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
        }
      })
      templates.forEach(template => template.traverse(object => {
        if (object instanceof T.Mesh) geometries.add(object.geometry)
      }))
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      sun.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
    },
  }
}
