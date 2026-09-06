import { describe, expect, it } from 'vitest'
import * as T from 'three'
import { ARRAKIS_GLOBE_SCALE, ARRAKIS_RADIUS, ARRAKIS_REFERENCE_RADIUS, ARRAKIS_VIEW_SIZE, arrangeGlobeLocations, arrangedLandforms, desertSurface, globeNormal, GlobeArc } from '../src/pages/workspaces/arrakisGlobe'
import { spatialNodes, spatialSceneLayout } from '../src/pages/workspaces/spatialModel'

describe('Arrakis globe geometry', () => {
  it('spreads the current set across the sphere instead of leaving every map in one hemisphere', () => {
    const rows = ['Survival_1', 'DeepDesert_1', 'SH_HarkoVillage', 'SH_Arrakeen', 'CB_Dungeon_Hephaestus']
      .map(map => ({ map, phase: 'Running', ready: 'True', players: '0', age: '1m' }))
    const placements = spatialSceneLayout(spatialNodes(rows, value => value)).placements
    const arranged = arrangeGlobeLocations(placements)
    const directions = [new T.Vector3(1, 0, 0), new T.Vector3(-1, 0, 0), new T.Vector3(0, 1, 0), new T.Vector3(0, -1, 0), new T.Vector3(0, 0, 1), new T.Vector3(0, 0, -1)]
    for (const direction of directions) expect(arranged.some(item => item.normal.dot(direction) > .2)).toBe(true)
    expect(arranged.find(item => item.node.map === 'Survival_1')!.normal.toArray()).toEqual([0, 0, 1])
    const thirteen = spatialSceneLayout(spatialNodes([...rows, ...Array.from({ length: 8 }, (_, i) => ({ ...rows[0], map: `Other_${i}` }))], value => value)).placements
    const expanded = arrangeGlobeLocations(thirteen)
    for (const map of ['Survival_1', 'DeepDesert_1', 'SH_HarkoVillage', 'SH_Arrakeen']) {
      expect(expanded.find(item => item.node.map === map)!.normal.toArray()).toEqual(arranged.find(item => item.node.map === map)!.normal.toArray())
    }
    expect(new Set(expanded.map(item => item.normal.toArray().join(','))).size).toBe(13)
  })
  it('places broad landforms around an open central Hagga basin', () => {
    expect(arrangedLandforms(-.2, .55, .8)).toBeGreaterThan(.9)
    expect(arrangedLandforms(.78, .05, .6)).toBeGreaterThan(.9)
    expect(arrangedLandforms(-.7, -.42, .55)).toBeGreaterThan(.9)
    expect(arrangedLandforms(0, 0, 1)).toBe(0)
    expect(arrangedLandforms(-.2, .55, -.8)).toBe(0)
    expect(globeNormal(-5, 3).x).toBeCloseTo(0)
    expect(globeNormal(-5, 3).y).toBeCloseTo(0)
  })
  it('reduces only globe diameter by 25 percent with the original camera framing', () => {
    expect(ARRAKIS_GLOBE_SCALE).toBe(.75)
    expect(ARRAKIS_RADIUS / ARRAKIS_REFERENCE_RADIUS).toBe(.75)
    expect(ARRAKIS_VIEW_SIZE).toBe(15.5)
    const elevation = desertSurface(0, 0, 1).elevation
    expect((ARRAKIS_RADIUS + elevation * ARRAKIS_GLOBE_SCALE) / (ARRAKIS_REFERENCE_RADIUS + elevation)).toBeCloseTo(.75, 10)
  })
  it('keeps generated desert relief bounded and deterministic over the full sphere', () => {
    for (let latitude = -90; latitude <= 90; latitude += 15) {
      for (let longitude = -180; longitude <= 180; longitude += 20) {
        const lat = T.MathUtils.degToRad(latitude), lon = T.MathUtils.degToRad(longitude)
        const point = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)] as const
        const sample = desertSurface(...point)
        expect(sample).toEqual(desertSurface(...point))
        expect(sample.elevation).toBeGreaterThanOrEqual(-.16)
        expect(sample.elevation).toBeLessThan(.15)
      }
    }
  })
  it('includes both raised terrain and basins without adding map objects', () => {
    const heights: number[] = []
    for (let i = 0; i < 200; i++) {
      const y = 1 - 2 * (i + .5) / 200
      const r = Math.sqrt(1 - y * y)
      const angle = i * 2.39996323
      heights.push(desertSurface(r * Math.cos(angle), y, r * Math.sin(angle)).elevation)
    }
    expect(Math.max(...heights)).toBeGreaterThan(.04)
    expect(Math.min(...heights)).toBeLessThan(-.1)
  })
  it('preserves the relative placement when projected onto the initial visible hemisphere', () => {
    const dd = globeNormal(-5, -6), hagga = globeNormal(-5, 3), harko = globeNormal(-5, 10), arrakeen = globeNormal(6, -6)
    expect(dd.y).toBeGreaterThan(hagga.y)
    expect(hagga.y).toBeGreaterThan(harko.y)
    expect(arrakeen.x).toBeGreaterThan(hagga.x)
    for (const point of [dd, hagga, harko, arrakeen]) {
      expect(point.length()).toBeCloseTo(1)
      expect(point.z).toBeGreaterThan(0)
    }
  })
  it('keeps Hagga arcs outside the planet, including coincident and opposite endpoints', () => {
    const from = globeNormal(-5, 3)
    for (const to of [globeNormal(-5, -6), globeNormal(6, -6), from.clone(), from.clone().negate()]) {
      const arc = new GlobeArc(from, to, ARRAKIS_RADIUS)
      for (let i = 0; i <= 20; i++) {
        const point = arc.getPoint(i / 20)
        expect(point.length()).toBeGreaterThan(ARRAKIS_RADIUS)
        expect(point.toArray().every(Number.isFinite)).toBe(true)
      }
      expect(arc.getPoint(0).normalize().distanceTo(from)).toBeLessThan(.0001)
      expect(arc.getPoint(1).normalize().distanceTo(to)).toBeLessThan(.0001)
    }
  })
})
