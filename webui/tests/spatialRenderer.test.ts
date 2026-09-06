// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as T from 'three'
import { createSpatialRenderer } from '../src/pages/workspaces/spatialRenderer'
import { spatialGlobeNodes, spatialNodes } from '../src/pages/workspaces/spatialModel'
import { globeSurfaceRadius } from '../src/pages/workspaces/globeEmblems'
import { GLOBE_MATERIAL_BRIGHTNESS, GLOBE_SURFACE_COLOR } from '../src/pages/workspaces/globePalette'

const state = vi.hoisted(() => ({ render: vi.fn(), frame: null as FrameRequestCallback | null, reducedMotion: false, resize: () => {} }))
vi.mock('three', async importOriginal => ({
  ...await importOriginal<typeof import('three')>(),
  WebGLRenderer: class {
    info = { render: { frame: 0, calls: 0, triangles: 0 } }
    shadowMap = { enabled: false, type: 0, autoUpdate: true, needsUpdate: false }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    render(scene: T.Scene, camera: T.Camera) { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); state.render(scene, camera) }
    dispose() {}
    forceContextLoss() {}
  },
}))
vi.mock('../src/pages/workspaces/arrakisGlobe', async importOriginal => ({
  ...await importOriginal<typeof import('../src/pages/workspaces/arrakisGlobe')>(),
  createDesertTexture: () => new T.Texture(),
}))

let canvas: HTMLCanvasElement
let engine: ReturnType<typeof createSpatialRenderer>
const moved = vi.fn(), selected = vi.fn(), label = vi.fn(), dragging = vi.fn(), labels = vi.fn()
const nodes = spatialNodes(['Survival_1', 'DeepDesert_1', 'SH_Arrakeen'].map(map => ({ map, phase: 'Running', ready: 'True', players: '0', age: '1m' })), value => value)
function draw() { const callback = state.frame; state.frame = null; callback?.(performance.now()) }
function world(): T.Group { return state.render.mock.lastCall![0].children.find((object: T.Object3D) => object instanceof T.Group) }
function emblem(id = 'Survival_1:0') { return world().children.find(object => object.userData.nodeId === id)! }
function pointer(type: string, x: number, y: number, pointerId = 1, button = 0) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true })
  Object.defineProperties(event, { pointerId: { value: pointerId }, isPrimary: { value: true } })
  canvas.dispatchEvent(event)
  draw()
}
beforeEach(() => {
  vi.clearAllMocks()
  state.frame = null
  state.reducedMotion = false
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { state.frame = callback; return 1 })
  vi.stubGlobal('cancelAnimationFrame', () => { state.frame = null })
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { state.resize = callback }
    observe() { state.resize() }
    disconnect() {}
  })
  vi.stubGlobal('IntersectionObserver', class { observe() {}; disconnect() {} })
  vi.stubGlobal('matchMedia', () => ({ get matches() { return state.reducedMotion }, addEventListener() {}, removeEventListener() {} }))
  canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 800, bottom: 800, width: 800, height: 800, toJSON() {} })
  const captures = new Set<number>()
  canvas.setPointerCapture = id => { captures.add(id) }
  canvas.hasPointerCapture = id => captures.has(id)
  canvas.releasePointerCapture = id => { captures.delete(id) }
  document.body.append(canvas)
  engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, onDragChange: dragging, onMapLabelPositions: labels })
  draw()
})
afterEach(() => { engine.dispose(); canvas.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers() })

describe('Globe renderer placement interaction', () => {
  it('restores tilt and heading before drawing and preserves them through non-reset controls', () => {
    engine.dispose()
    const changed = vi.fn()
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, {
      positions: {}, onMove: moved, orientation: { pitch: .7, yaw: -1.2 }, onOrientationChange: changed,
    })
    draw()
    expect(world().rotation.x).toBe(.7)
    expect(world().rotation.y).toBe(-1.2)
    engine.fit()
    engine.select(nodes[0].id)
    engine.status(nodes)
    engine.palette()
    engine.moveMaps(true)
    engine.moveMaps(false)
    state.resize()
    draw()
    expect(world().rotation.x).toBe(.7)
    expect(world().rotation.y).toBe(-1.2)
    expect(changed).not.toHaveBeenCalled()
    engine.reset()
    draw()
    expect(changed).toHaveBeenLastCalledWith({ pitch: 0, yaw: 0 })
    expect(world().rotation.x).toBe(0)
    expect(world().rotation.y).toBe(0)
  })
  it('persists drag axes, checkpoints automatic rotation, and flushes the last orientation on exit', () => {
    engine.dispose()
    let now = 100
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const changed = vi.fn()
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, onOrientationChange: changed })
    draw()
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 470, 360)
    pointer('pointerup', 470, 360)
    expect(changed.mock.lastCall![0].pitch).toBeCloseTo(-.24)
    expect(changed.mock.lastCall![0].yaw).toBeCloseTo(.42)
    engine.spin(true)
    now += 2100
    draw()
    expect(changed).toHaveBeenCalledTimes(2)
    expect(changed.mock.lastCall![0].pitch).toBeCloseTo(-.24)
    expect(changed.mock.lastCall![0].yaw).toBeGreaterThan(.42)
    engine.spin(true)
    now += 100
    draw()
    window.dispatchEvent(new Event('pagehide'))
    expect(changed).toHaveBeenCalledTimes(3)
    expect(changed.mock.lastCall![0].yaw).toBeCloseTo(world().rotation.y)
    engine.spin(true)
    now += 100
    draw()
    const yaw = world().rotation.y
    engine.dispose()
    expect(changed).toHaveBeenCalledTimes(4)
    expect(changed.mock.lastCall![0].yaw).toBeCloseTo(yaw)
    window.dispatchEvent(new Event('pagehide'))
    expect(changed).toHaveBeenCalledTimes(4)
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, orientation: changed.mock.lastCall![0] })
    draw()
    expect(world().rotation.y).toBeCloseTo(yaw)
    expect(world().rotation.x).toBeCloseTo(-.24)
  })
  it('uses a completely smooth, undisplaced base sphere with no noise texture or bump map', () => {
    const planet = world().children.find((object): object is T.Mesh<T.SphereGeometry, T.MeshStandardMaterial> => object instanceof T.Mesh
      && object.geometry instanceof T.SphereGeometry && object.material instanceof T.MeshStandardMaterial)!
    expect(planet.material.map).toBeNull()
    expect(planet.material.bumpMap).toBeNull()
    expect(planet.material.color.toArray()).toEqual(new T.Color(GLOBE_SURFACE_COLOR).multiplyScalar(GLOBE_MATERIAL_BRIGHTNESS).toArray())
    const positions = planet.geometry.attributes.position
    const normal = new T.Vector3()
    for (let index = 0; index < positions.count; index++) {
      expect(normal.fromBufferAttribute(positions, index).length()).toBeCloseTo(4.875, 5)
    }
  })
  it('fits protruding map geometry to short and narrow plot areas without changing world scale or rotation', () => {
    engine.dispose()
    let width = 1000, height = 420
    canvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} })
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, fitViewport: true })
    draw()
    const orientation = world().quaternion.clone()
    for (const dimensions of [[1000, 420], [740, 330], [360, 280]]) {
      ;[width, height] = dimensions
      state.resize()
      draw()
      const camera = state.render.mock.lastCall![1] as T.Camera
      const point = new T.Vector3()
      world().traverse(object => {
        if (!(object instanceof T.Mesh) || typeof object.userData.nodeId !== 'string') return
        const positions = object.geometry.attributes.position
        for (let index = 0; index < positions.count; index++) {
          point.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld).project(camera)
          expect(Math.abs(point.x)).toBeLessThanOrEqual(1)
          expect(Math.abs(point.y)).toBeLessThanOrEqual(1)
        }
      })
      expect(world().scale.toArray()).toEqual([1, 1, 1])
      expect(world().quaternion.equals(orientation)).toBe(true)
      expect(canvas.dataset.viewportFit).toBe('true')
    }
  })
  it('does not count dormant silhouettes against the reported-map safety limit', () => {
    engine.dispose()
    const reported = spatialNodes(Array.from({ length: 13 }, (_, index) => ({
      map: `Other_${index}`, phase: 'Running', ready: 'True', players: '0', age: '1m',
    })), value => value)
    const globe = spatialGlobeNodes(reported)

    expect(() => {
      engine = createSpatialRenderer(canvas, globe, selected, vi.fn(), label, { positions: {}, onMove: moved })
      draw()
    }).not.toThrow()
    expect(canvas.dataset.reportedEmblems).toBe('13')
    expect(canvas.dataset.dormantEmblems).toBe('4')
    const dormantMaterials: T.MeshStandardMaterial[] = []
    emblem('dormant:harko').traverse(object => {
      if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial) dormantMaterials.push(object.material)
    })
    expect(dormantMaterials.some(material => material.color.getHexString() === 'd5d1dc' && material.opacity === .72)).toBe(true)
  })
  it('spins normally without moving or saving maps', () => {
    const original = emblem().position.clone()
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 470, 360)
    pointer('pointerup', 470, 360)
    expect(world().rotation.y).not.toBe(0)
    expect(emblem().position.equals(original)).toBe(true)
    expect(moved).not.toHaveBeenCalled()
  })
  it('drags the selected map on the sphere, regrounds its mesh and updates Hagga routes', () => {
    engine.moveMaps(true)
    const original = emblem().position.clone()
    const routes = world().children.filter((object): object is T.Mesh<T.TubeGeometry> => object instanceof T.Mesh && object.geometry instanceof T.TubeGeometry)
    const routeGeometry = routes.map(route => route.geometry)
    const disposed = vi.fn()
    routeGeometry.forEach(geometry => geometry.addEventListener('dispose', disposed))
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 470, 360)
    expect(moved).not.toHaveBeenCalled()
    pointer('pointerup', 470, 360)
    expect(world().rotation.y).toBe(0)
    expect(moved).toHaveBeenCalledOnce()
    const normal = emblem().position.clone().normalize()
    expect(normal.x).toBeGreaterThan(0)
    expect(normal.y).toBeGreaterThan(0)
    expect(emblem().position.equals(original)).toBe(false)
    expect(emblem().position.length()).toBeCloseTo(globeSurfaceRadius(normal))
    expect(new T.Vector3(0, 1, 0).applyQuaternion(emblem().quaternion).distanceTo(normal)).toBeLessThan(1e-6)
    expect(new T.Vector3(...moved.mock.lastCall![0]['Survival_1:0']).distanceTo(normal)).toBeLessThan(1e-12)
    expect(routes.every((route, index) => route.geometry !== routeGeometry[index])).toBe(true)
    expect(disposed).toHaveBeenCalled()
    expect(label.mock.lastCall![0].visible).toBe(true)
  })
  it('drags a nonselected rim marker without a dropdown selection or inspector change', () => {
    engine.moveMaps(true)
    const id = 'DeepDesert_1:0'
    const object = emblem(id)
    let marker: T.Object3D | undefined
    object.traverse(part => { if (part instanceof T.Mesh && part.geometry instanceof T.OctahedronGeometry) marker = part })
    const point = marker!.getWorldPosition(new T.Vector3()).project(state.render.mock.lastCall![1])
    const x = (point.x + 1) * 400, y = (1 - point.y) * 400
    const original = object.position.clone()
    pointer('pointerdown', x, y)
    expect(dragging).toHaveBeenLastCalledWith(id)
    pointer('pointermove', x + 75, y + 65)
    expect(object.position.distanceTo(original)).toBeGreaterThan(.1)
    expect(selected).not.toHaveBeenCalled()
    expect(moved).not.toHaveBeenCalled()
    expect(label.mock.lastCall![0].visible).toBe(true)
    pointer('pointerup', x + 75, y + 65)
    expect(selected).not.toHaveBeenCalled()
    expect(moved).toHaveBeenCalledOnce()
    expect(dragging).toHaveBeenLastCalledWith(null)
  })
  it('right-drags over an emblem to rotate inside Move maps without moving or saving it', () => {
    engine.moveMaps(true)
    const original = emblem().position.clone()
    const menu = new MouseEvent('contextmenu', { cancelable: true })
    canvas.dispatchEvent(menu)
    expect(menu.defaultPrevented).toBe(true)
    const elsewhere = new MouseEvent('contextmenu', { cancelable: true })
    document.body.dispatchEvent(elsewhere)
    expect(elsewhere.defaultPrevented).toBe(false)
    pointer('pointerdown', 400, 400, 1, 2)
    pointer('pointermove', 470, 360, 1, 2)
    pointer('pointerup', 470, 360, 1, 2)
    expect(world().rotation.y).not.toBe(0)
    expect(emblem().position.equals(original)).toBe(true)
    expect(moved).not.toHaveBeenCalled()
    expect(selected).not.toHaveBeenCalled()
    engine.moveMaps(false)
    const normalMenu = new MouseEvent('contextmenu', { cancelable: true })
    canvas.dispatchEvent(normalMenu)
    expect(normalMenu.defaultPrevented).toBe(false)
  })
  it('cancels an unfinished drag on Escape or pointer cancellation', () => {
    engine.moveMaps(true)
    const original = emblem().position.clone()
    for (const cancel of ['escape', 'pointercancel']) {
      pointer('pointerdown', 400, 400)
      pointer('pointermove', 470, 360)
      if (cancel === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      else pointer('pointercancel', 470, 360)
      draw()
      expect(emblem().position.distanceTo(original)).toBeLessThan(1e-6)
      expect(canvas.hasPointerCapture(1)).toBe(false)
    }
    expect(moved).not.toHaveBeenCalled()
  })
  it('keeps an off-planet drag on the sphere instead of dropping the icon', () => {
    engine.moveMaps(true)
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 790, 790)
    pointer('pointerup', 790, 790)
    expect(moved).toHaveBeenCalledOnce()
    expect(emblem().position.length()).toBeCloseTo(globeSurfaceRadius(emblem().position.clone().normalize()))
  })
  it('does not let another pointer finish the active drag', () => {
    engine.moveMaps(true)
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 470, 360)
    pointer('pointerup', 470, 360, 2)
    pointer('pointercancel', 470, 360, 2)
    expect(moved).not.toHaveBeenCalled()
    pointer('pointerup', 470, 360)
    expect(moved).toHaveBeenCalledOnce()
  })
  it('nudges relative to the current view, saves all displayed positions, and resets without saving implicitly', () => {
    engine.moveMaps(true)
    engine.spin(true)
    engine.nudge('Survival_1:0', 1, 0)
    draw()
    expect(canvas.dataset.rotation).toBe('paused')
    expect(moved).toHaveBeenCalledOnce()
    expect(Object.keys(moved.mock.lastCall![0])).toHaveLength(3)
    expect(emblem().position.x).toBeGreaterThan(0)
    engine.layout({})
    draw()
    expect(emblem().position.x).toBeCloseTo(0)
    expect(moved).toHaveBeenCalledOnce()
  })
  it('keeps saved far-side emblems occluded and never rotates toward a selected map', () => {
    engine.layout({ 'Survival_1:0': [0, 0, -1] })
    draw()
    expect(label.mock.lastCall![0].visible).toBe(false)
    pointer('pointerdown', 400, 400)
    pointer('pointerup', 400, 400)
    expect(selected).toHaveBeenLastCalledWith('')
    const rotation = world().quaternion.clone()
    engine.select('Survival_1:0')
    draw()
    expect(label.mock.lastCall![0].visible).toBe(false)
    expect(world().quaternion.equals(rotation)).toBe(true)
    engine.select('DeepDesert_1:0')
    draw()
    expect(world().quaternion.equals(rotation)).toBe(true)
  })
  it('projects every label from its top beacon, follows live dragging, and hides the far side', () => {
    const current = () => labels.mock.lastCall![0] as { id: string; x: number; y: number; visible: boolean }[]
    expect(current()).toHaveLength(3)
    const before = current().find(item => item.id === 'DeepDesert_1:0')!
    let marker: T.Object3D | undefined
    emblem('DeepDesert_1:0').traverse(object => { if (object instanceof T.Mesh && object.geometry instanceof T.OctahedronGeometry) marker = object })
    const projected = marker!.getWorldPosition(new T.Vector3()).project(state.render.mock.lastCall![1])
    expect(before.x).toBeCloseTo((projected.x + 1) / 2)
    expect(before.y).toBeCloseTo((1 - projected.y) / 2)
    engine.moveMaps(true)
    pointer('pointerdown', 400, 400)
    pointer('pointermove', 450, 350)
    expect(current().find(item => item.id === 'Survival_1:0')!.x).toBeGreaterThan(.5)
    expect(moved).not.toHaveBeenCalled()
    pointer('pointerup', 450, 350)
    engine.layout({ 'DeepDesert_1:0': [0, 0, -1] })
    draw()
    expect(current().find(item => item.id === 'DeepDesert_1:0')!.visible).toBe(false)
  })
  it('holds camera zoom and position through selection, rotation and resize, with bounded canvas wheel zoom', () => {
    engine.dispose()
    const onZoomChange = vi.fn()
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, fitViewport: true, onZoomChange })
    engine.zoom(1.8)
    draw()
    const camera = state.render.mock.lastCall![1] as T.OrthographicCamera
    const frustum = [camera.left, camera.right, camera.top, camera.bottom]
    expect(world().position.x).toBe(0)
    const rotation = world().quaternion.clone()
    engine.select('DeepDesert_1:0')
    draw()
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual(frustum)
    expect(camera.zoom).toBe(1.8)
    expect(world().quaternion.equals(rotation)).toBe(true)
    expect(world().scale.toArray()).toEqual([1, 1, 1])
    pointer('pointerdown', 30, 400)
    pointer('pointermove', 80, 420)
    pointer('pointerup', 80, 420)
    expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual(frustum)
    expect(camera.zoom).toBe(1.8)
    state.resize()
    draw()
    expect(camera.zoom).toBe(1.8)
    const browserZoom = new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, cancelable: true })
    canvas.dispatchEvent(browserZoom)
    expect(browserZoom.defaultPrevented).toBe(false)
    expect(camera.zoom).toBe(1.8)
    const sceneZoom = new WheelEvent('wheel', { deltaY: -120, cancelable: true })
    canvas.dispatchEvent(sceneZoom)
    expect(sceneZoom.defaultPrevented).toBe(true)
    expect(camera.zoom).toBeGreaterThan(1.8)
    expect(onZoomChange).toHaveBeenCalledWith(camera.zoom)
    engine.zoom(100)
    expect(camera.zoom).toBe(3)
    const orientation = world().quaternion.clone()
    engine.fit()
    draw()
    expect(camera.zoom).toBe(1)
    expect(world().quaternion.equals(orientation)).toBe(true)
    expect(world().position.x).toBe(0)
  })
  it('does not snap a rim selection while Auto rotate continues normally', () => {
    const clock = vi.spyOn(performance, 'now').mockReturnValue(5000)
    engine.spin(true)
    draw()
    const before = world().quaternion.clone()
    engine.select('SH_Arrakeen:0')
    draw()
    expect(world().quaternion.equals(before)).toBe(true)
    expect(canvas.dataset.rotation).toBe('running')
    clock.mockReturnValue(5042)
    engine.status(nodes)
    draw()
    expect(world().rotation.y).toBeCloseTo(.042 * .085)
    expect(world().rotation.x).toBe(0)
  })
  it('recovers an axis gesture and zoom without discarding placements, then remains draggable', () => {
    engine.dispose()
    engine = createSpatialRenderer(canvas, nodes, selected, vi.fn(), label, { positions: {}, onMove: moved, fitViewport: true })
    engine.moveMaps(true)
    engine.nudge('Survival_1:0', 1, 1)
    draw()
    const placed = emblem().position.clone()
    engine.zoom(2.7)
    pointer('pointerdown', 40, 300, 1, 2)
    pointer('pointermove', 700, 700, 1, 2)
    pointer('pointerup', 700, 700, 1, 2)
    pointer('pointerdown', 40, 300, 1, 2)
    expect(canvas.hasPointerCapture(1)).toBe(true)
    engine.reset()
    draw()
    const camera = state.render.mock.lastCall![1] as T.OrthographicCamera
    expect(canvas.hasPointerCapture(1)).toBe(false)
    expect(camera.zoom).toBe(1)
    expect(world().rotation.x).toBe(0)
    expect(world().rotation.y).toBe(0)
    expect(emblem().position.distanceTo(placed)).toBeLessThan(1e-6)
    let marker: T.Object3D | undefined
    emblem().traverse(object => { if (object instanceof T.Mesh && object.geometry instanceof T.OctahedronGeometry) marker = object })
    const point = marker!.getWorldPosition(new T.Vector3()).project(camera)
    const x = (point.x + 1) * 400, y = (1 - point.y) * 400
    const count = moved.mock.calls.length
    pointer('pointerdown', x, y)
    pointer('pointermove', x + 20, y + 10)
    pointer('pointerup', x + 20, y + 10)
    expect(moved).toHaveBeenCalledTimes(count + 1)
    engine.zoom(1.9)
    engine.layout({})
    draw()
    expect(camera.zoom).toBe(1.9)
    expect(emblem().position.clone().normalize().toArray()).toEqual([0, 0, 1])
  })
  it('shares the bounded scheduler for simulated travel and hides it under reduced motion', () => {
    engine.flights(true)
    draw()
    const travel = world().children.find(object => object.userData.decoration === 'simulated-travel')!
    expect(travel.visible).toBe(true)
    expect(canvas.dataset.simulatedTravel).toBe('running')
    state.reducedMotion = true
    document.dispatchEvent(new Event('visibilitychange'))
    draw()
    expect(travel.visible).toBe(false)
    expect(canvas.dataset.simulatedTravel).toBe('paused')
    state.reducedMotion = false
    engine.flights(false)
    draw()
    expect(travel.visible).toBe(false)
    expect(canvas.dataset.simulatedTravel).toBe('paused')
  })
  it('lights from screen top-right with fixed dimensional icon lighting and shadows', () => {
    const scene = state.render.mock.lastCall![0] as T.Scene
    const sun = scene.children.find(object => object instanceof T.DirectionalLight && object.castShadow) as T.DirectionalLight
    const original = sun.position.clone()
    const projected = sun.position.clone().project(state.render.mock.lastCall![1])
    expect(projected.x).toBeGreaterThan(0)
    expect(projected.y).toBeGreaterThan(0)
    const meshes: T.Mesh[] = []
    emblem().traverse(object => { if (object instanceof T.Mesh && object.material instanceof T.MeshStandardMaterial) meshes.push(object) })
    expect(meshes.some(mesh => mesh.castShadow && mesh.receiveShadow)).toBe(true)
    expect(meshes.some(mesh => mesh.material instanceof T.MeshStandardMaterial && mesh.material.color.getHexString() === '4e6c66')).toBe(true)
    engine.select('DeepDesert_1:0')
    draw()
    expect(sun.position.equals(original)).toBe(true)
    pointer('pointerdown', 40, 400)
    pointer('pointermove', 110, 440)
    pointer('pointerup', 110, 440)
    expect(sun.position.equals(original)).toBe(true)
    expect(canvas.dataset.lighting).toBe('fixed-top-right')
  })
})
