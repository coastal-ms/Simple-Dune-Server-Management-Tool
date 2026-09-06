import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { createSpatialLandmark } from '../src/pages/workspaces/spatialLandmarks'
import { LOCATION_VISUALS, type SpatialLocationKind } from '../src/pages/workspaces/spatialModel'

describe('Authored location markers', () => {
  it('builds distinct bounded geometry without textures and at most three meshes per marker', () => {
    const material = new T.MeshBasicMaterial()
    const extents = new Map<string, T.Vector3>()
    for (const kind of Object.keys(LOCATION_VISUALS) as SpatialLocationKind[]) {
      if (kind === 'overland') {
        expect(() => createSpatialLandmark(kind, material, material)).toThrow('containing world')
        continue
      }
      const group = createSpatialLandmark(kind, material, material)
      expect(group.children.length).toBeLessThanOrEqual(3)
      let triangles = 0
      group.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        const geometry = object.geometry
        triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3
        expect(Array.from(geometry.attributes.position.array).every(Number.isFinite)).toBe(true)
      })
      expect(triangles).toBeGreaterThan(0)
      expect(triangles).toBeLessThan(6000)
      const size = new T.Box3().setFromObject(group).getSize(new T.Vector3())
      expect(Math.max(size.x, size.y, size.z)).toBeLessThan(6)
      extents.set(kind, size)
      group.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose() })
    }
    expect(extents.get('hagga')!.y).toBeGreaterThan(extents.get('deep-desert')!.y * 2)
    expect(extents.get('deep-desert')!.x).toBeGreaterThan(extents.get('deep-desert')!.y * 2)
    expect(extents.get('arrakeen')).not.toEqual(extents.get('harko'))
    material.dispose()
  })
})
