import * as T from 'three'
import { ARRAKIS_RADIUS } from './arrakisGlobe'
import { terrainFieldGrid, TERRAIN_COLUMNS, TERRAIN_EDGE_FRACTION, TERRAIN_LEVELS, TERRAIN_MAX_HEIGHT, TERRAIN_ROWS } from './globeTerrain'
import { GLOBE_MATERIAL_BRIGHTNESS, GLOBE_RIDGE_COLOR, GLOBE_SURFACE_COLOR } from './globePalette'

type Vertex = { u: number; v: number; height: number }
const DARK_AREA_TARGET = .6

function clip(polygon: Vertex[], threshold: number, above: boolean) {
  const result: Vertex[] = []
  for (let index = 0; index < polygon.length; index++) {
    const a = polygon[index], b = polygon[(index + 1) % polygon.length]
    const aInside = above ? a.height >= threshold : a.height <= threshold
    const bInside = above ? b.height >= threshold : b.height <= threshold
    if (aInside) result.push(a)
    if (aInside !== bInside) {
      const t = (threshold - a.height) / (b.height - a.height)
      result.push({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t, height: threshold })
    }
  }
  return result
}

function direction(vertex: Pick<Vertex, 'u' | 'v'>) {
  const theta = vertex.v * Math.PI, phi = vertex.u * Math.PI * 2
  return new T.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
}

export function createGlobeTopography() {
  const positions: number[] = [], normals: number[] = [], shades: number[] = []
  const faces: { area: number; shade: number }[] = []
  function triangle(a: T.Vector3, b: T.Vector3, c: T.Vector3, shade: [number, number, number], faceOut?: T.Vector3) {
    const face = b.clone().sub(a).cross(c.clone().sub(a))
    const area = face.length() / 2
    if (area < 1e-10) return
    if (face.dot(faceOut ?? a) < 0) { [b, c] = [c, b]; [shade[1], shade[2]] = [shade[2], shade[1]]; face.negate() }
    face.normalize()
    for (const [index, point] of [a, b, c].entries()) {
      const normal = faceOut ? face : point.clone().normalize()
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      shades.push(shade[index])
    }
    faces.push({ area, shade: Math.min(...shade) })
  }
  const shadeOf = (vertex: Vertex) => Math.max(0, (vertex.height - TERRAIN_EDGE_FRACTION) / (1 - TERRAIN_EDGE_FRACTION))
  function addCell(vertices: Vertex[]) {
    const minimum = Math.min(...vertices.map(vertex => vertex.height))
    const maximum = Math.max(...vertices.map(vertex => vertex.height))
    if (maximum <= TERRAIN_EDGE_FRACTION) return
    const first = Math.max(1, Math.ceil(minimum * TERRAIN_LEVELS - 1e-9))
    const last = Math.min(TERRAIN_LEVELS, Math.ceil(maximum * TERRAIN_LEVELS - 1e-9))
    for (let level = first; level <= last; level++) {
      const lower = Math.max(TERRAIN_EDGE_FRACTION, (level - 1) / TERRAIN_LEVELS), upper = level / TERRAIN_LEVELS
      const polygon = clip(clip(vertices, lower, true), upper, false)
      if (polygon.length < 3 || !polygon.some(vertex => vertex.height > lower + 1e-10)) continue
      const radius = ARRAKIS_RADIUS + upper * TERRAIN_MAX_HEIGHT
      const points = polygon.map(vertex => direction(vertex).multiplyScalar(radius))
      for (let index = 1; index + 1 < polygon.length; index++) {
        triangle(points[0], points[index], points[index + 1], [shadeOf(polygon[0]), shadeOf(polygon[index]), shadeOf(polygon[index + 1])])
      }
      for (let index = 0; index < polygon.length; index++) {
        const next = (index + 1) % polygon.length, a = polygon[index], b = polygon[next]
        if (Math.abs(a.height - lower) > 1e-9 || Math.abs(b.height - lower) > 1e-9) continue
        const bottom = ARRAKIS_RADIUS + (level === 1 ? -.025 : (level - 1) / TERRAIN_LEVELS * TERRAIN_MAX_HEIGHT)
        const lowA = direction(a).multiplyScalar(bottom), lowB = direction(b).multiplyScalar(bottom)
        const middle = { u: (a.u + b.u) / 2, v: (a.v + b.v) / 2 }
        const out = direction({ u: middle.u + (b.v - a.v) * .001, v: middle.v - (b.u - a.u) * .001 }).sub(direction(middle))
        const shade = shadeOf(a)
        triangle(lowA, lowB, points[next], [shade, shade, shade], out)
        triangle(lowA, points[next], points[index], [shade, shade, shade], out)
      }
    }
  }
  const grid = terrainFieldGrid()
  for (let row = 0; row < TERRAIN_ROWS; row++) {
    for (let column = 0; column < TERRAIN_COLUMNS; column++) {
      const vertex = (x: number, y: number): Vertex => ({ u: x / TERRAIN_COLUMNS, v: y / TERRAIN_ROWS, height: grid[y * (TERRAIN_COLUMNS + 1) + x] })
      const b = vertex(column, row), a = vertex(column + 1, row), c = vertex(column, row + 1), d = vertex(column + 1, row + 1)
      addCell([b, a, d])
      addCell([b, d, c])
    }
  }
  // Count every mesh face (even partly buried boundary skirts) in the denominator;
  // only fully dark faces count in the numerator, giving a conservative area bound.
  const totalArea = faces.reduce((sum, face) => sum + face.area, 0)
  let accumulated = 0, darkThreshold = 1
  for (const face of [...faces].sort((a, b) => b.shade - a.shade)) {
    accumulated += face.area
    darkThreshold = face.shade
    if (accumulated >= totalArea * DARK_AREA_TARGET) break
  }
  darkThreshold = Math.max(1e-6, darkThreshold - 1e-7)
  const darkArea = faces.reduce((sum, face) => sum + (face.shade >= darkThreshold ? face.area : 0), 0)
  const base = new T.Color(GLOBE_SURFACE_COLOR), rock = new T.Color(GLOBE_RIDGE_COLOR), color = new T.Color()
  const colors: number[] = []
  shades.forEach(shade => {
    color.copy(base).lerp(rock, T.MathUtils.smoothstep(shade, 0, darkThreshold))
    colors.push(color.r, color.g, color.b)
  })
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new T.Float32BufferAttribute(normals, 3))
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3))
  geometry.computeBoundingSphere()
  const mesh = new T.Mesh(geometry, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }))
  mesh.material.color.setScalar(GLOBE_MATERIAL_BRIGHTNESS)
  mesh.userData.decoration = 'shield-wall-topography'
  mesh.userData.darkAreaFraction = darkArea / totalArea
  mesh.userData.darkThreshold = darkThreshold
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}
