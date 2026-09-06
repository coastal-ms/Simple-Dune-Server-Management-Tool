import { useRef, useState } from 'react'
import { GLOBE_LAYOUT_STORAGE_KEY, mergeGlobePositions, parseGlobeLayout, type GlobeLayout, type GlobePositions } from '../pages/workspaces/globeLayout'

function readLayout(): { layout: GlobeLayout; notice: string; failed: boolean } {
  try {
    const raw = localStorage.getItem(GLOBE_LAYOUT_STORAGE_KEY)
    return { layout: raw ? parseGlobeLayout(raw) : { version: 1, positions: {} }, notice: '', failed: false }
  } catch {
    return {
      layout: { version: 1, positions: {} },
      notice: 'Saved layout could not be read. Default positions are shown. Move a map or reset the layout to save again.',
      failed: true,
    }
  }
}

export function useGlobeLayout() {
  const [state, setState] = useState(readLayout)
  const current = useRef(state.layout)
  function save(layout: GlobeLayout) {
    current.current = layout
    try {
      localStorage.setItem(GLOBE_LAYOUT_STORAGE_KEY, JSON.stringify(layout))
    } catch {
      setState({ layout, notice: 'Layout changed for this view only. Browser storage is unavailable; it will not survive a reload.', failed: true })
      return
    }
    setState({ layout, notice: Object.keys(layout.positions).length ? 'Layout saved in this browser.' : 'Default layout restored in this browser.', failed: false })
  }
  return {
    ...state,
    move: (positions: GlobePositions) => save({
      version: 1, positions: mergeGlobePositions(current.current.positions, positions),
    }),
    reset: () => save({ version: 1, positions: {} }),
  }
}
