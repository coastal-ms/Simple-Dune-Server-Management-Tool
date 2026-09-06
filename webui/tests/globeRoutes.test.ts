import { describe, expect, it } from 'vitest'
import { createGlobeRoute, globeSignalColor, routeEndpointColors, ROUTE_CORE_RADIUS, ROUTE_HEAD_SCALE } from '../src/pages/workspaces/globeRoutes'
import { ARRAKIS_RADIUS, globeNormal, GlobeArc } from '../src/pages/workspaces/arrakisGlobe'
import { Color } from 'three'

describe('Directional readiness pulses', () => {
  it('keeps pastel theme status colors visibly green and red against sand', () => {
    const green = new Color(globeSignalColor('#9ddbb8'))
    const red = new Color(globeSignalColor('#ffaaaa'))
    expect(green.g).toBeGreaterThan(green.r * 2)
    expect(red.r).toBeGreaterThan(red.g * 2)
  })
  it('uses independent endpoint readiness, including reverse and unknown states', () => {
    expect(routeEndpointColors('Ready', 'Not ready', 'green', 'red', 'gray')).toEqual({ start: 'green', end: 'red' })
    expect(routeEndpointColors('Not ready', 'Ready', 'green', 'red', 'gray')).toEqual({ start: 'red', end: 'green' })
    expect(routeEndpointColors('Ready', 'Ready', 'green', 'red', 'gray')).toEqual({ start: 'green', end: 'green' })
    expect(routeEndpointColors('Not ready', 'Not ready', 'green', 'red', 'gray')).toEqual({ start: 'red', end: 'red' })
    expect(routeEndpointColors(undefined, 'Ready', 'green', 'red', 'gray')).toEqual({ start: 'gray', end: 'green' })
  })
  it('creates a continuous surface arc with source-to-destination pulse coordinates', () => {
    const route = createGlobeRoute(new GlobeArc(globeNormal(-5, 3), globeNormal(6, -6), ARRAKIS_RADIUS), .2)
    const uv = route.mesh.geometry.attributes.uv
    expect(uv.getX(0)).toBe(0)
    expect(uv.getX(uv.count - 1)).toBe(1)
    expect(route.material.uniforms.head.value).toBe(.2)
    expect(route.material.fragmentShader).toContain('mix(startColor, endColor')
    expect(route.mesh.geometry.parameters.radius).toBe(.032)
    expect(route.backing.geometry.parameters.radius).toBe(.05)
    expect(route.backing.material.depthTest).toBe(true)
    expect(route.backing.material.depthWrite).toBe(false)
    expect(route.backing.castShadow).toBe(false)
    expect(route.material.uniforms.headExpansion.value + ROUTE_CORE_RADIUS).toBeCloseTo(ROUTE_CORE_RADIUS * ROUTE_HEAD_SCALE)
    expect(ROUTE_HEAD_SCALE).toBe(1.3)
    expect(route.material.vertexShader).toContain('position + normal * (headExpansion * bulb)')
    route.mesh.geometry.dispose()
    route.backing.geometry.dispose()
    route.backing.material.dispose()
    route.material.dispose()
  })
})
