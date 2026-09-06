import * as T from 'three'
import { spatialLocationKind, type SpatialNode } from './spatialModel'
import { normalizeGlobePosition, type GlobePositions } from './globeLayout'
import { globeTerrainHeight } from './globeTerrain'
import { noise3d as noise } from './terrainNoise'

export const ARRAKIS_REFERENCE_RADIUS = 6.5
export const ARRAKIS_GLOBE_SCALE = .75
export const ARRAKIS_RADIUS = ARRAKIS_REFERENCE_RADIUS * ARRAKIS_GLOBE_SCALE
export const ARRAKIS_VIEW_SIZE = ARRAKIS_REFERENCE_RADIUS * 2 + 2.5

function latitudeLongitude(latitude: number, longitude: number) {
  const lat = T.MathUtils.degToRad(latitude), lon = T.MathUtils.degToRad(longitude)
  return new T.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon))
}

export function arrangeGlobeLocations<TPlacement extends { node: SpatialNode }>(placements: readonly TPlacement[], saved: GlobePositions = {}) {
  const primary = {
    hagga: latitudeLongitude(0, 0),
    'deep-desert': latitudeLongitude(50, -70),
    harko: latitudeLongitude(-55, -55),
    arrakeen: latitudeLongitude(35, 85),
  }
  const assigned = new Map<string, T.Vector3>()
  const usedKinds = new Set<string>()
  for (const placement of placements) {
    if (Object.hasOwn(saved, placement.node.id)) assigned.set(placement.node.id, new T.Vector3(...normalizeGlobePosition(saved[placement.node.id])))
  }
  for (const placement of placements) {
    const kind = spatialLocationKind(placement.node.map)
    if (kind !== 'hagga' && kind !== 'deep-desert' && kind !== 'harko' && kind !== 'arrakeen') continue
    if (usedKinds.has(kind)) continue
    if (!assigned.has(placement.node.id)) assigned.set(placement.node.id, primary[kind])
    usedKinds.add(kind)
  }
  const candidates = Array.from({ length: 256 }, (_, index) => {
    const y = 1 - 2 * (index + .5) / 256
    const radius = Math.sqrt(1 - y * y)
    const angle = index * 2.399963229728653
    return new T.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  })
  for (const placement of placements) {
    if (assigned.has(placement.node.id)) continue
    if (assigned.size === 0) {
      assigned.set(placement.node.id, new T.Vector3(0, 0, 1))
      continue
    }
    let best = candidates[0], bestSeparation = -Infinity
    for (const candidate of candidates) {
      let separation = Infinity
      for (const normal of assigned.values()) separation = Math.min(separation, 1 - candidate.dot(normal))
      if (separation > bestSeparation) { best = candidate; bestSeparation = separation }
    }
    assigned.set(placement.node.id, best.clone())
  }
  return placements.map(placement => {
    const normal = assigned.get(placement.node.id)
    if (!normal) throw new Error(`No globe placement for ${placement.node.id}`)
    return { ...placement, normal }
  })
}

const LANDFORMS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  [[-.63, .05], [-.61, .36], [-.56, .56], [-.45, .66], [-.2, .65], [.08, .72], [.24, .78], [.34, .7], [.29, .55], [.2, .43], [-.03, .4], [-.23, .42], [-.4, .33], [-.49, .18]],
  [[.55, -.48], [.61, -.24], [.66, .02], [.68, .19], [.74, .33], [.86, .46], [.94, .42], [.9, .19], [.87, -.02], [.77, -.23], [.66, -.4]],
  [[-.93, -.1], [-.8, -.23], [-.67, -.26], [-.51, -.24], [-.41, -.35], [-.47, -.53], [-.58, -.69], [-.55, -.82], [-.67, -.77], [-.8, -.6], [-.89, -.4], [-.94, -.24]],
]
const LAND_BOUNDS = LANDFORMS.map(points => ({
  minX: Math.min(...points.map(point => point[0])) - .06,
  maxX: Math.max(...points.map(point => point[0])) + .06,
  minY: Math.min(...points.map(point => point[1])) - .06,
  maxY: Math.max(...points.map(point => point[1])) + .06,
}))

export function arrangedLandforms(x: number, y: number, z: number) {
  if (z <= 0) return 0
  let result = 0
  LANDFORMS.forEach((points, index) => {
    const bounds = LAND_BOUNDS[index]
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) return
    let inside = false, distanceSquared = Infinity
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const [ax, ay] = points[j], [bx, by] = points[i]
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside
      const dx = bx - ax, dy = by - ay
      const t = T.MathUtils.clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
      distanceSquared = Math.min(distanceSquared, (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2)
    }
    const signedDistance = Math.sqrt(distanceSquared) * (inside ? 1 : -1)
    result = Math.max(result, T.MathUtils.smoothstep(signedDistance, -.06, .06))
  })
  return result * T.MathUtils.smoothstep(z, 0, .25)
}

export function shieldWallElevation(x: number, y: number, z: number) {
  return globeTerrainHeight(x, y, z)
}

export function desertSurface(x: number, y: number, z: number) {
  const mass = noise(x * 3 + 8, y * 3, z * 3) * .6 + noise(x * 8, y * 8 + 3, z * 8) * .28 + noise(x * 23, y * 23, z * 23) * .12
  const province = noise(x * 2.2 - 3, y * 2.2 + 5, z * 2.2)
  const arranged = arrangedLandforms(x, y, z)
  const proceduralStrength = .45 + .55 * (1 - T.MathUtils.smoothstep(z, -.2, .2))
  const plateau = Math.max(arranged, T.MathUtils.smoothstep(province * .7 + mass * .3, .43, .7) * proceduralStrength)
  const basin = (1 - T.MathUtils.smoothstep(Math.abs(noise(x * 2.8, y * 2.8 - 6, z * 2.8 + 4) - .5), .04, .24)) * (1 - arranged * .8)
  const dunes = Math.sin(x * 93 + z * 57 + mass * 27 + Math.sin(y * 21) * 3)
  return { mass, dunes, plateau, basin, elevation: plateau * .13 - basin * .16 + (dunes + 1) * .006 }
}

export function globeNormal(x: number, z: number) {
  const longitude = (x + 5) * 7
  const wrap = Math.floor(Math.abs(longitude) / 300)
  const latitude = T.MathUtils.clamp((3 - z) * 5.7 - wrap * 30, -72, 72)
  const lat = T.MathUtils.degToRad(latitude), lon = T.MathUtils.degToRad(longitude)
  return new T.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon))
}

export function createDesertTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')
  if (!context) throw new Error('A canvas context is required for the desert surface')
  const image = context.createImageData(canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    const latitude = (.5 - y / (canvas.height - 1)) * Math.PI
    const c = Math.cos(latitude), ny = Math.sin(latitude)
    for (let x = 0; x < canvas.width; x++) {
      const longitude = x / (canvas.width - 1) * Math.PI * 2
      const nx = -Math.cos(longitude) * c, nz = Math.sin(longitude) * c
      const sample = desertSurface(nx, ny, nz)
      const rock = T.MathUtils.clamp((sample.mass - .52) * 3 + sample.plateau * .55 + sample.basin * .18, 0, 1)
      const grain = noise(nx * 90, ny * 90, nz * 90)
      const shade = .97 + sample.dunes * .004 + grain * .015 - sample.basin * .025
      const offset = (y * canvas.width + x) * 4
      image.data[offset] = (225 - rock * 28) * shade
      image.data[offset + 1] = (220 - rock * 29) * shade
      image.data[offset + 2] = (234 - rock * 24) * shade
      image.data[offset + 3] = 255
    }
  }
  context.putImageData(image, 0, 0)
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapS = T.RepeatWrapping
  return texture
}

export class GlobeArc extends T.Curve<T.Vector3> {
  private from: T.Vector3
  private to: T.Vector3
  private radius: number

  constructor(from: T.Vector3, to: T.Vector3, radius: number) {
    super()
    this.from = from
    this.to = to
    this.radius = radius
  }

  getPoint(t: number, target = new T.Vector3()) {
    const dot = T.MathUtils.clamp(this.from.dot(this.to), -1, 1)
    const angle = Math.acos(dot)
    if (angle < .0001) target.copy(this.from)
    else if (dot < -.999) {
      const perpendicular = new T.Vector3().crossVectors(this.from, Math.abs(this.from.y) < .9 ? new T.Vector3(0, 1, 0) : new T.Vector3(1, 0, 0)).normalize()
      target.copy(this.from).multiplyScalar(Math.cos(Math.PI * t)).addScaledVector(perpendicular, Math.sin(Math.PI * t))
    } else {
      target.copy(this.from).multiplyScalar(Math.sin((1 - t) * angle) / Math.sin(angle))
        .addScaledVector(this.to, Math.sin(t * angle) / Math.sin(angle))
    }
    target.normalize()
    const ground = this.radius + shieldWallElevation(target.x, target.y, target.z)
    return target.multiplyScalar(Math.max(this.radius + .15, ground + .14) + Math.sin(Math.PI * t) * .38)
  }
}
