import { useState } from 'react'
import { clampGlobeZoom, GLOBE_ZOOM_KEY, parseGlobeZoom } from '../pages/workspaces/globeZoom'

export function useGlobeZoom() {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(GLOBE_ZOOM_KEY)
      return { value: raw ? parseGlobeZoom(raw) : 1, error: '' }
    } catch {
      return { value: 1, error: 'Saved globe zoom could not be read. Using Fit; choose a zoom to save again.' }
    }
  })
  return {
    ...state,
    set(value: number) {
      const next = clampGlobeZoom(value)
      try {
        localStorage.setItem(GLOBE_ZOOM_KEY, JSON.stringify({ version: 1, zoom: next }))
      } catch {
        setState({ value: next, error: 'Zoom changed for this view only. Browser storage is unavailable.' })
        return
      }
      setState({ value: next, error: '' })
    },
  }
}
