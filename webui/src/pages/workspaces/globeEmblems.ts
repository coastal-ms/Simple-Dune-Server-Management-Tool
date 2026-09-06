import * as T from 'three'
import { ARRAKIS_RADIUS, shieldWallElevation } from './arrakisGlobe'

export function globeEmblemDensityScale(activeMapCount: number) {
  if (!Number.isInteger(activeMapCount) || activeMapCount < 0) throw new RangeError('Map count must be a non-negative integer')
  if (activeMapCount === 0) return 1
  // Allocate more surface area per icon in small sets, without letting the
  // tallest landmarks grow beyond the fixed camera framing.
  return Math.min(2, 2 * Math.sqrt(5 / activeMapCount))
}

export function globeSurfaceRadius(normal: T.Vector3) {
  return ARRAKIS_RADIUS + shieldWallElevation(normal.x, normal.y, normal.z)
}

export function conformGlobeLandmark(template: T.Group, normal: T.Vector3, scale: number) {
  const result = template.clone()
  const bottom = new T.Box3().setFromObject(template).min.y
  const orientation = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), normal)
  const anchorRadius = globeSurfaceRadius(normal)
  const floors = new Map<string, number>()
  const tangent = new T.Vector3(), direction = new T.Vector3()
  result.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    object.geometry = object.geometry.clone()
    const positions = object.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      const key = `${x}:${z}`
      let floor = floors.get(key)
      if (floor === undefined) {
        tangent.set(x * scale, 0, z * scale).applyQuaternion(orientation)
        const lateralSquared = tangent.lengthSq()
        let radius = anchorRadius
        for (let pass = 0; pass < 8; pass++) {
          const along = Math.sqrt(Math.max(0, radius * radius - lateralSquared))
          direction.copy(normal).multiplyScalar(along).add(tangent).normalize()
          radius = globeSurfaceRadius(direction)
        }
        // A tiny inset closes gaps against the finite-resolution planet mesh.
        floor = (Math.sqrt(Math.max(0, radius * radius - lateralSquared)) - anchorRadius - .01) / scale
        floors.set(key, floor)
      }
      positions.setY(i, positions.getY(i) - bottom + floor)
    }
    positions.needsUpdate = true
    object.geometry.computeVertexNormals()
    object.geometry.computeBoundingSphere()
  })
  return result
}
