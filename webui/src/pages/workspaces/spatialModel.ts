import type { BgGameServer } from '../../api/types'

export type SpatialLocationKind = 'hagga' | 'deep-desert' | 'arrakeen' | 'harko' | 'overland' | 'dungeon' | 'story' | 'unknown'
  | 'hephaestus' | 'carthag' | 'quarry' | 'broodworks' | 'fallen-light' | 'arsunt' | 'tyche'
  | 'cavern' | 'smugglers-run' | 'tsimpo' | 'wind-pass' | 'station24' | 'station89' | 'station136' | 'station152' | 'station195'
export type SpatialNode = { id: string; map: string; title: string; phase: string; ready: string; players: string; age?: string; layoutId?: string; reported?: boolean }
export const MAX_SPATIAL_LOCATIONS = 13
const MAIN_MAP_SILHOUETTES = [
  ['hagga', 'Survival_1'],
  ['deep-desert', 'DeepDesert_1'],
  ['arrakeen', 'SH_Arrakeen'],
  ['harko', 'SH_HarkoVillage'],
] as const satisfies readonly (readonly [SpatialLocationKind, string])[]

// Technical IDs cross-checked against map-name tables; visual references are linked per entry.
const NAMED_LOCATION_KINDS: Record<string, SpatialLocationKind> = {
  CB_Dungeon_Hephaestus: 'hephaestus',
  CB_Dungeon_OldCarthag: 'carthag',
  CB_Dungeon_ThePit: 'quarry',
  CB_Story_BanditFortress01: 'broodworks',
  Story_HeighlinerDungeon: 'fallen-light',
  Story_Faction_Outpost_Atre: 'arsunt',
  Story_Faction_Outpost_Hark: 'arsunt',
  CB_Overland_M_01: 'tyche',
  CB_Overland_S_04: 'cavern',
  CB_Overland_S_06: 'smugglers-run',
  CB_Overland_S_07: 'tsimpo',
  CB_Overland_S_08: 'wind-pass',
  CB_Ecolab_Bronze_Green_024: 'station24',
  CB_Ecolab_Bronze_Green_089: 'station89',
  CB_Ecolab_Bronze_Green_136: 'station136',
  CB_Ecolab_Bronze_Green_152: 'station152',
  CB_Ecolab_Bronze_Green_195: 'station195',
}

export function spatialLocationKind(map: string): SpatialLocationKind {
  if (Object.hasOwn(NAMED_LOCATION_KINDS, map)) return NAMED_LOCATION_KINDS[map]
  if (/^Survival(?:_|$)/i.test(map)) return 'hagga'
  if (/^DeepDesert(?:_|$)/i.test(map)) return 'deep-desert'
  if (/^SH_Arrakeen(?:_|$)/i.test(map)) return 'arrakeen'
  if (/^SH_HarkoVillage(?:_|$)/i.test(map)) return 'harko'
  if (/^Overmap(?:_|$)/i.test(map)) return 'overland'
  if (/Dungeon/i.test(map)) return 'dungeon'
  if (/^(?:CB_|DLC_)?Story_/i.test(map)) return 'story'
  return 'unknown'
}

export const LOCATION_VISUALS: Record<SpatialLocationKind, { label: string; description: string; reference: string }> = {
  hagga: { label: 'Hagga Basin', description: 'Region marker / caprock and stone pillars', reference: 'Hagga_Basin' },
  'deep-desert': { label: 'Deep Desert', description: 'Region marker / terraced desert ridge', reference: 'Deep_Desert' },
  arrakeen: { label: 'Arrakeen', description: 'Settlement marker / stepped city and citadel', reference: 'Arrakeen' },
  harko: { label: 'Harko Village', description: 'Settlement marker / industrial towers', reference: 'Harko_Village' },
  overland: { label: 'Overmap', description: 'Login map / world entry', reference: 'Overland_Locations' },
  dungeon: { label: 'Dungeon', description: 'Dungeon category marker / individual model not yet mapped', reference: 'Overland_Locations#Dungeons' },
  story: { label: 'Story location', description: 'Story category marker / individual model not yet mapped', reference: 'Overland_Locations#Story_Locations' },
  unknown: { label: 'Unmapped location', description: 'Neutral locator / no matching location model', reference: 'Overland_Locations' },
  hephaestus: { label: 'Wreck of the Hephaestus', description: 'Story location / broken freighter hull', reference: 'Wreck_of_the_Hephaestus' },
  carthag: { label: 'Ruins of Old Carthag', description: 'Story location / ruined city spires', reference: 'Ruins_of_Old_Carthag' },
  quarry: { label: 'The Old Quarry', description: 'Dungeon / terraced excavation', reference: 'The_Old_Quarry' },
  broodworks: { label: 'The Broodworks', description: 'Landmark / elevated bandit stronghold', reference: 'The_Broodworks' },
  'fallen-light': { label: 'Fallen Light', description: 'Story location / fallen heighliner ribs', reference: 'Fallen_Light' },
  arsunt: { label: 'Arsunt Garrison', description: 'Landmark / stepped military outpost', reference: 'Arsunt_Garrison' },
  tyche: { label: 'Wreck of the Tyche', description: 'Landmark / grounded ship hull', reference: 'Wreck_of_the_Tyche' },
  cavern: { label: 'Blushing Cavern', description: 'Landmark / crystal-studded rock island', reference: 'Blushing_Cavern' },
  'smugglers-run': { label: "Smuggler's Run", description: 'Landmark / winding rock formations', reference: 'Smuggler%27s_Run' },
  tsimpo: { label: 'The Ruins of Tsimpo', description: 'Landmark / village among rock pillars', reference: 'The_Ruins_of_Tsimpo' },
  'wind-pass': { label: 'Wind Pass', description: 'Landmark / split canyon settlement', reference: 'Wind_Pass' },
  station24: { label: 'Testing Station 24', description: 'Dungeon / dark testing-station entrance', reference: 'Testing_Station_24' },
  station89: { label: 'Testing Station 89', description: 'Dungeon / radiation testing station', reference: 'Testing_Station_89' },
  station136: { label: 'Testing Station 136', description: 'Dungeon / fire testing station', reference: 'Testing_Station_136' },
  station152: { label: 'Testing Station 152', description: 'Dungeon / electrical testing station', reference: 'Testing_Station_152' },
  station195: { label: 'Testing Station 195', description: 'Dungeon / overgrown testing station', reference: 'Testing_Station_195' },
}

export function spatialLayers(nodes: SpatialNode[]) {
  return {
    worlds: nodes.filter(node => spatialLocationKind(node.map) === 'overland'),
    locations: nodes.filter(node => spatialLocationKind(node.map) !== 'overland'),
  }
}

export function spatialStatusOrder(nodes: readonly SpatialNode[]) {
  const rank = (node: SpatialNode) => {
    const kind = spatialLocationKind(node.map)
    return kind === 'overland' ? 0 : kind === 'hagga' ? 1 : kind === 'deep-desert' ? 2
      : kind === 'arrakeen' || kind === 'harko' ? 3 : 4
  }
  return [...nodes].sort((a, b) => rank(a) - rank(b)
    || a.map.localeCompare(b.map, 'en', { numeric: true })
    || (a.layoutId ?? a.id).localeCompare(b.layoutId ?? b.id, 'en', { numeric: true })
    || a.id.localeCompare(b.id, 'en', { numeric: true }))
}

export function spatialNodes(servers: BgGameServer[], label: (map: string) => string): SpatialNode[] {
  const occurrences = new Map<string, number>()
  // Row order is not an instance identity. Named sietches keep separate layouts;
  // indistinguishable duplicates cannot safely retain a placement.
  const layoutKeys = servers.map(server => JSON.stringify([server.map, server.sietchName || null]))
  const keyCounts = new Map<string, number>()
  layoutKeys.forEach(key => keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1))
  return servers.map((server, row) => {
    const index = occurrences.get(server.map) ?? 0
    occurrences.set(server.map, index + 1)
    const kind = spatialLocationKind(server.map)
    return {
      id: `${server.map}:${index}`, map: server.map,
      layoutId: keyCounts.get(layoutKeys[row]) === 1 ? layoutKeys[row] : undefined,
      title: server.sietchName || (['unknown', 'dungeon', 'story'].includes(kind) ? label(server.map) : LOCATION_VISUALS[kind].label),
      phase: server.phase || 'Unknown',
      ready: server.ready?.toLowerCase() === 'true' ? 'Ready'
        : server.ready?.toLowerCase() === 'false' ? 'Not ready' : 'Unknown',
      players: server.players || 'Unknown',
      age: server.age || 'Unknown',
      reported: true,
    }
  })
}

export function spatialGlobeNodes(nodes: SpatialNode[]) {
  const present = new Set(nodes.map(node => spatialLocationKind(node.map)))
  const silhouettes = MAIN_MAP_SILHOUETTES
    .filter(([kind]) => !present.has(kind))
    .map(([kind, map]): SpatialNode => ({
      id: `dormant:${kind}`,
      map,
      title: LOCATION_VISUALS[kind].label,
      phase: 'Dormant',
      ready: 'Dormant',
      players: 'Unknown',
      age: 'Not reported',
      layoutId: JSON.stringify([map, null]),
      reported: false,
    }))
  return spatialStatusOrder([...nodes, ...silhouettes])
}

export function locationScale(map: string) {
  const kind = spatialLocationKind(map)
  return kind === 'deep-desert' ? 1.45 : kind === 'hagga' ? 1 : kind === 'arrakeen' || kind === 'harko' ? .68 : .48
}

export function spatialSceneLayout(nodes: SpatialNode[]) {
  const locations = spatialLayers(nodes).locations
    .map(node => ({ node, scale: locationScale(node.map) }))
    .sort((a, b) => b.scale - a.scale || a.node.id.localeCompare(b.node.id))
  const used = new Map<SpatialLocationKind, number>()
  let otherIndex = 0
  const placements = locations.map(item => {
    const kind = spatialLocationKind(item.node.map)
    const instance = used.get(kind) ?? 0
    used.set(kind, instance + 1)
    const spacing = item.scale * 5.4 + 1
    // Preserve the supplied composition; additional core instances extend outward.
    if (kind === 'deep-desert') return { ...item, x: -5 - instance * spacing, z: -6 }
    if (kind === 'hagga') return { ...item, x: -5 - instance * spacing, z: 3 }
    if (kind === 'harko') return { ...item, x: -5 - instance * spacing, z: 10 }
    if (kind === 'arrakeen') return { ...item, x: 6 + instance * spacing, z: -6 }
    const slot = otherIndex++
    return { ...item, x: 3.5 + slot % 3 * 3.6, z: 3 + Math.floor(slot / 3) * 3.6 }
  })
  return {
    width: Math.max(24, ...placements.map(item => (Math.abs(item.x) + item.scale * 2.7 + 1) * 2)),
    depth: Math.max(28, ...placements.map(item => (Math.abs(item.z) + item.scale * 2.7 + 1) * 2)),
    placements,
  }
}

export function spatialConnections(placements: ReturnType<typeof spatialSceneLayout>['placements']) {
  const reported = placements.filter(item => item.node.reported !== false)
  const hub = reported.find(item => spatialLocationKind(item.node.map) === 'hagga')
  return hub ? reported.filter(item => item.node.id !== hub.node.id).map(to => ({ from: hub, to })) : []
}
