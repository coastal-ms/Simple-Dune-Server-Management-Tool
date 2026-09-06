export const GLOBE_ZOOM_KEY = 'dst.spatial.globe-zoom.v1'
export const MIN_GLOBE_ZOOM = .5
export const MAX_GLOBE_ZOOM = 3

export function clampGlobeZoom(value: number) {
  if (!Number.isFinite(value)) throw new RangeError('Globe zoom must be finite')
  return Math.max(MIN_GLOBE_ZOOM, Math.min(MAX_GLOBE_ZOOM, Math.round(value * 100) / 100))
}

export function parseGlobeZoom(raw: string) {
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
    || !('zoom' in value) || typeof value.zoom !== 'number' || !Number.isFinite(value.zoom)
    || value.zoom < MIN_GLOBE_ZOOM || value.zoom > MAX_GLOBE_ZOOM) throw new Error('Invalid saved globe zoom')
  return clampGlobeZoom(value.zoom)
}
