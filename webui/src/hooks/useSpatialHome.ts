import { useSyncExternalStore } from 'react'
import { createBooleanPreference } from './booleanPreference'

export const SPATIAL_HOME_KEY = 'dst.home.spatial.v1'
const preference = createBooleanPreference(SPATIAL_HOME_KEY, 'dst:home-view-changed')
export const setSpatialHome = preference.set

export function useSpatialHome() {
  return useSyncExternalStore(preference.subscribe, preference.read, () => false)
}
