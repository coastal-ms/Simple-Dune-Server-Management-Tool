import { useRef, useState } from 'react'

export const GLOBE_ORIENTATION_KEY = 'dst.globe.orientation.v1'
export type GlobeOrientation = { pitch: number; yaw: number }

export function useGlobeOrientation() {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(GLOBE_ORIENTATION_KEY)
      if (!raw) return { value: { pitch: 0, yaw: 0 }, error: '' }
      const value: unknown = JSON.parse(raw)
      if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1
        || !('pitch' in value) || typeof value.pitch !== 'number' || !Number.isFinite(value.pitch)
        || !('yaw' in value) || typeof value.yaw !== 'number' || !Number.isFinite(value.yaw)
        || Math.abs(value.pitch) > 1.35 || Math.abs(value.yaw) > Math.PI) {
        throw new Error('Invalid globe orientation')
      }
      return { value: { pitch: value.pitch, yaw: value.yaw }, error: '' }
    } catch {
      return { value: { pitch: 0, yaw: 0 }, error: 'Saved globe orientation could not be read. Rotate the globe or use Reset view to save again.' }
    }
  })
  const orientation = useRef<GlobeOrientation>(initial.value)
  const [error, setError] = useState(initial.error)
  return {
    error,
    read: () => orientation.current,
    save(value: GlobeOrientation) {
      orientation.current = value
      try {
        localStorage.setItem(GLOBE_ORIENTATION_KEY, JSON.stringify({ version: 1, ...value }))
      } catch {
        setError('Globe orientation changed for this view only. Browser storage is unavailable.')
        return
      }
      setError('')
    },
  }
}
