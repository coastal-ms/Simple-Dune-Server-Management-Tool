import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { ARRAKIS_RADIUS, GlobeArc } from '../src/pages/workspaces/arrakisGlobe'
import { createGlobeTopography } from '../src/pages/workspaces/globeTopography'
import { globeSurfaceRadius } from '../src/pages/workspaces/globeEmblems'
import { createGlobeFlights, FLIGHT_TRAIL_RADIUS } from '../src/pages/workspaces/globeFlights'
import { TERRAIN_MAX_HEIGHT } from '../src/pages/workspaces/globeTerrain'

function normal(latitude: number, longitude: number) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180
  return new T.Vector3(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon))
}

function checkSegments(curve: T.Curve<T.Vector3>, segments: number, thickness: number) {
  let minimum = Infinity
  for (let index = 0; index < segments; index++) {
    const point = curve.getPoint(index / segments).lerp(curve.getPoint((index + 1) / segments), .5)
    const clearance = point.length() - globeSurfaceRadius(point.clone().normalize()) - thickness
    minimum = Math.min(minimum, clearance)
  }
  expect(minimum).toBeGreaterThan(0)
}

describe('Raised terrace surface support', () => {
  it('supports landmarks at the rendered terrain rather than the old smooth height field', () => {
    const mesh = createGlobeTopography()
    mesh.updateMatrixWorld(true)
    const ray = new T.Raycaster()
    for (const latitude of [-47, -13, 23, 59]) {
      for (const longitude of [-131, -53, 31, 117]) {
        const direction = normal(latitude, longitude)
        ray.set(direction.clone().multiplyScalar(ARRAKIS_RADIUS + TERRAIN_MAX_HEIGHT + 1), direction.clone().negate())
        const hit = ray.intersectObject(mesh, false)[0]
        const rendered = Math.max(ARRAKIS_RADIUS, hit?.point.length() ?? ARRAKIS_RADIUS)
        const support = globeSurfaceRadius(direction)
        expect(support - rendered).toBeGreaterThan(-.001)
        expect(support - rendered).toBeLessThan(.012)
      }
    }
    mesh.geometry.dispose(); mesh.material.dispose()
  }, 15000)
  it('keeps the actual connecting and travel line segments clear of raised shelves', () => {
    const from = normal(0, 0)
    for (const to of [normal(50, -70), normal(-55, -55), normal(35, 85), normal(-10, 160)]) {
      checkSegments(new GlobeArc(from, to, ARRAKIS_RADIUS), 256, .05)
    }
    const travel = createGlobeFlights(ARRAKIS_RADIUS)
    travel.group.traverse(object => {
      if (!(object instanceof T.Mesh)) return
      if (object.geometry instanceof T.TubeGeometry) checkSegments(object.geometry.parameters.path, 512, FLIGHT_TRAIL_RADIUS)
      object.geometry.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.forEach(material => material.dispose())
    })
  })
})
