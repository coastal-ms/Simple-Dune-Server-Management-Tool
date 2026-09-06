import { describe, expect, it } from 'vitest'
import { Buffer } from 'node:buffer'
import * as T from 'three'
import { createGlobeTopography } from '../src/pages/workspaces/globeTopography'
import { ARRAKIS_RADIUS } from '../src/pages/workspaces/arrakisGlobe'
import { globeSurfaceRadius } from '../src/pages/workspaces/globeEmblems'
import { globeTerrainHeight, TERRAIN_MAX_HEIGHT } from '../src/pages/workspaces/globeTerrain'
import { GLOBE_RIDGE_COLOR, GLOBE_SURFACE_COLOR } from '../src/pages/workspaces/globePalette'

describe('Fixed regional rocky terrain', () => {
  it('forms deterministic, bounded, shadow-casting regional geometry', () => {
    const first = createGlobeTopography(), second = createGlobeTopography()
    const firstPositions = first.geometry.attributes.position.array, secondPositions = second.geometry.attributes.position.array
    expect(Buffer.from(firstPositions.buffer, firstPositions.byteOffset, firstPositions.byteLength)
      .equals(Buffer.from(secondPositions.buffer, secondPositions.byteOffset, secondPositions.byteLength))).toBe(true)
    expect(first.geometry.attributes.position.count).toBeGreaterThan(1000)
    expect(first.geometry.attributes.position.count / 3).toBeLessThan(300000)
    expect(first.castShadow).toBe(true)
    expect(first.receiveShadow).toBe(true)
    expect(first.userData.nodeId).toBeUndefined()
    expect(first.material.roughness).toBe(1)
    first.geometry.dispose(); first.material.dispose()
    second.geometry.dispose(); second.material.dispose()
  })
  it('keeps the approved low height range with irregular coverage and smooth base between regions', () => {
    expect(TERRAIN_MAX_HEIGHT).toBe(.55125)
    const points = Array.from({ length: 512 }, (_, index) => {
      const y = 1 - 2 * (index + .5) / 512, r = Math.sqrt(1 - y * y), angle = index * 2.39996323
      return new T.Vector3(r * Math.cos(angle), y, r * Math.sin(angle))
    })
    const heights = points.map(normal => globeTerrainHeight(normal.x, normal.y, normal.z))
    expect(Math.max(...heights)).toBeLessThanOrEqual(TERRAIN_MAX_HEIGHT)
    expect(Math.max(...heights)).toBeGreaterThan(.04)
    expect(heights.filter(height => height === 0).length).toBeGreaterThan(30)
    expect(heights.filter(height => height > .005).length).toBeGreaterThan(100)
    points.forEach((normal, index) => expect(globeSurfaceRadius(normal)).toBeCloseTo(ARRAKIS_RADIUS + heights[index]))
  })
  it('covers more than half of actual rocky triangle area with the existing darkest shade', () => {
    const mesh = createGlobeTopography()
    const dark = new T.Color(GLOBE_RIDGE_COLOR)
    const positions = mesh.geometry.attributes.position, colors = mesh.geometry.attributes.color
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3()
    let darkArea = 0, totalArea = 0
    for (let index = 0; index < positions.count; index += 3) {
      a.fromBufferAttribute(positions, index)
      b.fromBufferAttribute(positions, index + 1).sub(a)
      c.fromBufferAttribute(positions, index + 2).sub(a)
      const area = b.cross(c).length() / 2
      totalArea += area
      if ([0, 1, 2].every(offset => Math.abs(colors.getX(index + offset) - dark.r) < 1e-6
        && Math.abs(colors.getY(index + offset) - dark.g) < 1e-6 && Math.abs(colors.getZ(index + offset) - dark.b) < 1e-6)) darkArea += area
    }
    expect(darkArea / totalArea).toBeGreaterThan(.5)
    expect(mesh.userData.darkAreaFraction).toBeGreaterThanOrEqual(.6)
    mesh.geometry.dispose(); mesh.material.dispose()
  })
  it('uses the exact shared sphere color at terrain boundaries', () => {
    const mesh = createGlobeTopography()
    const base = new T.Color(GLOBE_SURFACE_COLOR)
    const colors = mesh.geometry.attributes.color
    const matching = Array.from({ length: colors.count }, (_, index) => Math.abs(colors.getX(index) - base.r) < 1e-6
      && Math.abs(colors.getY(index) - base.g) < 1e-6 && Math.abs(colors.getZ(index) - base.b) < 1e-6)
    expect(matching.filter(Boolean).length).toBeGreaterThan(100)
    mesh.geometry.dispose(); mesh.material.dispose()
  })
})
