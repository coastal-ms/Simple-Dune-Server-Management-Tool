import { describe, expect, it } from 'vitest'
import { spatialNodes, spatialSceneLayout, spatialStatusOrder } from '../src/pages/workspaces/spatialModel'

describe('Map status presentation order', () => {
  it('orders by canonical identity, preserving renamed and multiple instances', () => {
    const rows = [
      { map: 'CB_Dungeon_Hephaestus', sietchName: '' },
      { map: 'SH_HarkoVillage', sietchName: '' },
      { map: 'DeepDesert_2', sietchName: '' },
      { map: 'Survival_2', sietchName: 'Zulu' },
      { map: 'Overmap', sietchName: '' },
      { map: 'Survival_1', sietchName: 'Not a Hagga name' },
      { map: 'SH_Arrakeen', sietchName: '' },
      { map: 'DeepDesert_1', sietchName: '' },
      { map: 'Future_Map', sietchName: '' },
    ].map(row => ({ ...row, phase: 'Running', ready: 'True', players: '0', age: '1m' }))
    const nodes = spatialNodes(rows, value => value)
    const ordered = spatialStatusOrder(nodes)
    expect(ordered.map(node => node.map)).toEqual([
      'Overmap', 'Survival_1', 'Survival_2', 'DeepDesert_1', 'DeepDesert_2', 'SH_Arrakeen', 'SH_HarkoVillage', 'CB_Dungeon_Hephaestus', 'Future_Map',
    ])
    expect(spatialStatusOrder([...nodes].reverse())).toEqual(ordered)
    expect(spatialSceneLayout(ordered)).toEqual(spatialSceneLayout(nodes))
    expect(nodes[0].map).toBe('CB_Dungeon_Hephaestus')
  })
  it('keeps same-map named instances stable when source rows are shuffled', () => {
    const rows = ['South', 'North'].map(sietchName => ({ map: 'Survival_1', sietchName, phase: '', ready: '', players: '', age: '' }))
    const first = spatialStatusOrder(spatialNodes(rows, value => value))
    const reversed = spatialStatusOrder(spatialNodes([...rows].reverse(), value => value))
    expect(first.map(node => node.layoutId)).toEqual(reversed.map(node => node.layoutId))
    expect(first).toHaveLength(2)
  })
})
