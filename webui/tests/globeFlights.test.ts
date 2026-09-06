import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { createGlobeFlights, FLIGHT_COLOR, FLIGHT_DOT_RADIUS, FLIGHT_TAIL_FRACTION, FLIGHT_TRAIL_RADIUS } from '../src/pages/workspaces/globeFlights'
import { ARRAKIS_RADIUS } from '../src/pages/workspaces/arrakisGlobe'

describe('Simulated globe travel', () => {
  it('uses three small light-blue dots and very long fading tails, not aircraft or solid orbit rings', () => {
    const travel = createGlobeFlights(ARRAKIS_RADIUS)
    expect(travel.group.visible).toBe(false)
    travel.update(0, true)
    const dots = travel.group.children.filter((object): object is T.Mesh<T.SphereGeometry, T.MeshBasicMaterial> => object instanceof T.Mesh && object.geometry instanceof T.SphereGeometry)
    const trails = travel.group.children.filter((object): object is T.Mesh<T.TubeGeometry, T.ShaderMaterial> => object instanceof T.Mesh && object.geometry instanceof T.TubeGeometry)
    expect(dots).toHaveLength(3)
    expect(trails).toHaveLength(3)
    expect(FLIGHT_TAIL_FRACTION).toBeGreaterThan(.65)
    dots.forEach(dot => {
      expect(dot.material.color.getHexString()).toBe(FLIGHT_COLOR.slice(1))
      expect(dot.position.length()).toBeGreaterThan(ARRAKIS_RADIUS)
      expect(dot.geometry.parameters.radius).toBe(.037 * 2)
      expect(dot.material.toneMapped).toBe(false)
    })
    trails.forEach(trail => {
      expect(trail.geometry.parameters.radius).toBe(.0175 * 2)
      expect(trail.material.uniforms.tail.value).toBe(FLIGHT_TAIL_FRACTION)
      expect(trail.material.depthTest).toBe(true)
      expect(trail.material.depthWrite).toBe(false)
      expect(trail.material.fragmentShader).toContain('fade * 0.35 + core * 0.45')
      expect(trail.material.toneMapped).toBe(false)
      expect(trail.material.blending).toBe(T.NormalBlending)
    })
    expect(FLIGHT_TRAIL_RADIUS).toBe(.035)
    expect(FLIGHT_DOT_RADIUS).toBe(.074)
    travel.color('#61bdce')
    dots.forEach(dot => expect(dot.material.color.getHexString()).toBe('61bdce'))
    trails.forEach(trail => expect(trail.material.uniforms.color.value.getHexString()).toBe('61bdce'))
    const initial = dots.map(dot => dot.position.clone())
    travel.update(10, true)
    expect(dots.every((dot, index) => dot.position.distanceTo(initial[index]) > 1)).toBe(true)
    travel.update(20, false)
    expect(travel.group.visible).toBe(false)
    travel.group.traverse(object => {
      if (object instanceof T.Mesh) { object.geometry.dispose(); object.material.dispose() }
    })
  })
})
