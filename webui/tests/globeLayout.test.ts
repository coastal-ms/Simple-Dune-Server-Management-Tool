import { describe, expect, it } from 'vitest'
import { MAX_SAVED_GLOBE_POSITIONS, mergeGlobePositions, normalizeGlobePosition, parseGlobeLayout } from '../src/pages/workspaces/globeLayout'
import { arrangeGlobeLocations } from '../src/pages/workspaces/arrakisGlobe'
import { spatialNodes, spatialSceneLayout } from '../src/pages/workspaces/spatialModel'

describe('Saved globe layouts', () => {
  it('bounds retained old map identities without dropping current positions or writing unreadable data', () => {
    const old = Object.fromEntries(Array.from({ length: MAX_SAVED_GLOBE_POSITIONS }, (_, index) => [JSON.stringify([`Map_${index}`, null]), [0, 0, 1] as const]))
    const positions = mergeGlobePositions(old, { '["Map_0",null]': [1, 0, 0], '["New",null]': [0, 1, 0] })
    expect(Object.keys(positions)).toHaveLength(MAX_SAVED_GLOBE_POSITIONS)
    expect(positions['["Map_0",null]']).toEqual([1, 0, 0])
    expect(() => parseGlobeLayout(JSON.stringify({ version: 1, positions }))).not.toThrow()
  })
  it('stores directions independently of terrain radius and viewport size', () => {
    const layout = parseGlobeLayout(JSON.stringify({ version: 1, positions: { '["Survival_1","North"]': [0, 0, 12] } }))
    expect(layout.positions['["Survival_1","North"]']).toEqual([0, 0, 1])
    expect(normalizeGlobePosition([3, 4, 0])).toEqual([.6, .8, 0])
  })
  it.each(['null', '{"version":2,"positions":{}}', '{"version":1,"positions":[]}', '{"version":1,"positions":{"bad":[1,0,0]}}'])('rejects malformed or unsupported data: %s', raw => {
    expect(() => parseGlobeLayout(raw)).toThrow()
  })
  it.each([[0, 0, 0], [NaN, 0, 1], [Infinity, 1, 1], ['1', 0, 0], [1, 0], null])('rejects invalid directions %j', position => {
    expect(() => normalizeGlobePosition(position)).toThrow()
  })
  it('honors saved core and other locations without creating absent maps', () => {
    const nodes = spatialNodes(['Survival_1', 'DeepDesert_1', 'Other'].map(map => ({ map, phase: '', ready: '', players: '', age: '' })), value => value)
    const placements = spatialSceneLayout(nodes).placements
    const saved = { 'Survival_1:0': [0, 0, -1] as const, 'Other:0': [0, 1, 0] as const, 'Absent:0': [1, 0, 0] as const }
    const result = arrangeGlobeLocations(placements, saved)
    expect(result).toHaveLength(3)
    expect(result.find(item => item.node.id === 'Survival_1:0')!.normal.toArray()).toEqual([0, 0, -1])
    expect(result.find(item => item.node.id === 'Other:0')!.normal.toArray()).toEqual([0, 1, 0])
    expect(arrangeGlobeLocations(placements).find(item => item.node.id === 'Survival_1:0')!.normal.toArray()).toEqual([0, 0, 1])
  })
})
