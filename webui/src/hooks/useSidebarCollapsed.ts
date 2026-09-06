import { useCallback, useEffect, useState } from 'react'

const KEY = 'dst.sidebar.collapsed'

// Persists the sidebar collapsed/expanded state across reloads. When collapsed
// the sidebar shrinks to an icon rail; when expanded it shows the full nav.
export function useSidebarCollapsed(key = KEY, initiallyCollapsed = false) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? initiallyCollapsed : saved === '1'
    } catch { return initiallyCollapsed }
  })
  useEffect(() => {
    try { localStorage.setItem(key, collapsed ? '1' : '0') } catch { /* ignore */ }
  }, [collapsed, key])
  const toggle = useCallback(() => setCollapsed(v => !v), [])
  return { collapsed, setCollapsed, toggle }
}
