import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { globeNormal } from '../src/pages/workspaces/arrakisGlobe'
import { conformGlobeLandmark, globeEmblemDensityScale, globeSurfaceRadius } from '../src/pages/workspaces/globeEmblems'

describe('Rigid, grounded globe emblems', () => {
  it('grows a small active set and shrinks progressively as maps are added', () => {
    expect(globeEmblemDensityScale(0)).toBe(1)
    expect(globeEmblemDensityScale(1)).toBe(2)
    expect(globeEmblemDensityScale(5)).toBe(2)
    expect(globeEmblemDensityScale(6)).toBeLessThan(globeEmblemDensityScale(5))
    expect(globeEmblemDensityScale(9)).toBeLessThan(globeEmblemDensityScale(6))
    expect(globeEmblemDensityScale(13)).toBeLessThan(globeEmblemDensityScale(9))
    expect(() => globeEmblemDensityScale(-1)).toThrow(RangeError)
  })
  it('plants bottom vertices on the curved surface without changing footprint or height', () => {
    const template = new T.Group()
    const material = new T.MeshBasicMaterial()
    const original = new T.BoxGeometry(2, 2, 2).translate(0, 1, 0)
    template.add(new T.Mesh(original, material))
    const normal = globeNormal(-5, 3)
    const scale = .48 * globeEmblemDensityScale(5)
    const model = conformGlobeLandmark(template, normal, scale)
    const mount = new T.Group()
    mount.position.copy(normal).multiplyScalar(globeSurfaceRadius(normal))
    mount.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal)
    mount.scale.setScalar(scale)
    mount.add(model)
    const world = new T.Group()
    world.add(mount)
    world.updateMatrixWorld(true)
    const mesh = model.children[0] as T.Mesh<T.BufferGeometry>
    const positions = mesh.geometry.attributes.position
    for (let i = 0; i < positions.count; i++) {
      expect(positions.getX(i)).toBe(original.attributes.position.getX(i))
      expect(positions.getZ(i)).toBe(original.attributes.position.getZ(i))
      if (original.attributes.position.getY(i) !== 0) continue
      const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      expect(Math.abs(point.length() - globeSurfaceRadius(point.clone().normalize()))).toBeLessThan(.02)
    }
    const local = mount.quaternion.clone()
    world.rotation.set(.4, 1.2, -.2)
    world.updateMatrixWorld(true)
    expect(mount.quaternion.equals(local)).toBe(true)
    const up = new T.Vector3(0, 1, 0).applyQuaternion(mount.getWorldQuaternion(new T.Quaternion()))
    const radial = mount.getWorldPosition(new T.Vector3()).normalize()
    expect(up.distanceTo(radial)).toBeLessThan(.00001)
    mesh.geometry.dispose()
    original.dispose()
    material.dispose()
  })
})
