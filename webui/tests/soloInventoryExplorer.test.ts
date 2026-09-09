import { describe, expect, it } from 'vitest'
import {
  buildSoloInventoryGroups,
  filterSoloInventoryItemsByLocation,
} from '../src/components/solo/SoloInventoryExplorer'

describe('Solo inventory explorer', () => {
  it('groups matching templates across Solo inventory locations', () => {
    const items = [
      {
        inventoryId: 1,
        destinationKey: 'inventory:1',
        destinationLabel: 'Backpack',
        destinationKind: 'backpack',
        templateId: 'Copper',
        displayName: 'Copper Ore',
        totalQuantity: 10,
        occurrenceCount: 1,
        minQuality: 0,
        maxQuality: 0,
      },
      {
        inventoryId: 2,
        destinationKey: 'inventory:2',
        destinationLabel: 'Storage Container #1',
        destinationKind: 'storage',
        templateId: 'copper',
        displayName: 'Copper Ore',
        totalQuantity: 25,
        occurrenceCount: 2,
        minQuality: 1,
        maxQuality: 2,
      },
      {
        inventoryId: 35,
        destinationKey: 'inventory:35',
        destinationLabel: 'Bank Storage',
        destinationKind: 'bank',
        templateId: 'copper',
        displayName: 'Copper Ore',
        totalQuantity: 5,
        occurrenceCount: 1,
        minQuality: 0,
        maxQuality: 0,
      },
    ]
    const groups = buildSoloInventoryGroups(items)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      groupKey: 'copper',
      totalQuantity: 40,
      occurrenceCount: 4,
      locationCount: 3,
      quality: { min: 0, max: 2, mixed: true },
    })
    expect(filterSoloInventoryItemsByLocation(items, 'inventory:2')).toEqual([items[1]])
    expect(filterSoloInventoryItemsByLocation(items, 'inventory:35')).toEqual([items[2]])
    expect(filterSoloInventoryItemsByLocation(items, '')).toEqual(items)
  })
})
