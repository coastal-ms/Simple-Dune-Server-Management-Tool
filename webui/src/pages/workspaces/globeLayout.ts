export const GLOBE_LAYOUT_STORAGE_KEY = 'dst.spatial.globe-layout.v1'
export const MAX_SAVED_GLOBE_POSITIONS = 256
export type GlobePosition = readonly [number, number, number]
export type GlobePositions = Readonly<Record<string, GlobePosition>>
export type GlobeLayout = { version: 1; positions: GlobePositions }
export type GlobeLabelPosition = { id: string; x: number; y: number; visible: boolean }

export function mergeGlobePositions(current: GlobePositions, next: GlobePositions): GlobePositions {
  return Object.fromEntries([
    ...Object.entries(current).filter(([id]) => !Object.hasOwn(next, id)),
    ...Object.entries(next).map(([id, position]) => [id, normalizeGlobePosition(position)] as const),
  ].slice(-MAX_SAVED_GLOBE_POSITIONS))
}

export function globePositionsForNodes(nodes: readonly { id: string; layoutId?: string }[], positions: GlobePositions): GlobePositions {
  return Object.fromEntries(nodes.flatMap(node => node.layoutId && Object.hasOwn(positions, node.layoutId) ? [[node.id, positions[node.layoutId]]] : []))
}

export function normalizeGlobePosition(value: unknown): GlobePosition {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(item => typeof item === 'number' && Number.isFinite(item))) {
    throw new Error('A globe position must contain three finite numbers')
  }
  const length = Math.hypot(value[0], value[1], value[2])
  if (!Number.isFinite(length) || length < .000001) throw new Error('A globe position must have a direction')
  return [value[0] / length, value[1] / length, value[2] / length]
}

export function parseGlobeLayout(raw: string): GlobeLayout {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
    || !('positions' in value) || !value.positions || typeof value.positions !== 'object' || Array.isArray(value.positions)) {
    throw new Error('Unrecognized globe layout format')
  }
  const entries = Object.entries(value.positions)
  if (entries.length > MAX_SAVED_GLOBE_POSITIONS) throw new Error('The saved globe layout is too large')
  return { version: 1, positions: Object.fromEntries(entries.map(([id, position]) => {
    if (id.length > 1024) throw new Error('Invalid map identity in globe layout')
    const identity: unknown = JSON.parse(id)
    if (!Array.isArray(identity) || identity.length !== 2 || typeof identity[0] !== 'string' || !identity[0]
      || (identity[1] !== null && typeof identity[1] !== 'string')) throw new Error('Invalid map identity in globe layout')
    return [id, normalizeGlobePosition(position)]
  })) }
}
