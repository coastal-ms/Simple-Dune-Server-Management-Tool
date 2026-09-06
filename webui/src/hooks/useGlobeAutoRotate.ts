import { useSyncExternalStore } from 'react'
import { createBooleanPreference } from './booleanPreference'

export const GLOBE_AUTO_ROTATE_KEY = 'dst.globe.auto-rotate.v1'
const preference = createBooleanPreference(GLOBE_AUTO_ROTATE_KEY, 'dst:globe-auto-rotate-changed')
export const setGlobeAutoRotate = preference.set

export function useGlobeAutoRotate() {
  return useSyncExternalStore(preference.subscribe, preference.read, () => false)
}
