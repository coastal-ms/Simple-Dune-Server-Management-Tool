import { useEffect, useSyncExternalStore } from 'react'
import { createEnumPreference } from './enumPreference'

export type FontScale = 'default' | 'medium' | 'large'

export const FONT_SCALE_KEY = 'dst.appearance.font-scale.v1'
export const FONT_SCALE_OPTIONS: readonly FontScale[] = ['default', 'medium', 'large']

const preference = createEnumPreference(
  FONT_SCALE_KEY,
  'dst:font-scale-changed',
  FONT_SCALE_OPTIONS,
  'default',
)

export const setFontScale = preference.set

export function useFontScale() {
  return useSyncExternalStore(preference.subscribe, preference.read, () => 'default' as FontScale)
}

export function useDocumentFontScale(scale: FontScale) {
  useEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-dst-font-scale')
    root.setAttribute('data-dst-font-scale', scale)
    return () => {
      if (previous === null) root.removeAttribute('data-dst-font-scale')
      else root.setAttribute('data-dst-font-scale', previous)
    }
  }, [scale])
}
