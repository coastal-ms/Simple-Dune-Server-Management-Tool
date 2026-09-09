import { useSyncExternalStore } from 'react'
import { createEnumPreference } from './enumPreference'

export type HealthRefreshPreset = 'focused' | 'standard' | 'reduced' | 'minimal'

export const HEALTH_REFRESH_KEY = 'dst.server-health.refresh.v1'
export const HEALTH_REFRESH_PRESETS = {
  focused: {
    label: 'Focused',
    statusIntervalMs: 10_000,
    mapPlayersIntervalMs: 10_000,
    detail: 'Status every 10s; selected-map names every 10s.',
  },
  standard: {
    label: 'Standard',
    statusIntervalMs: 10_000,
    mapPlayersIntervalMs: 30_000,
    detail: 'Status every 10s; selected-map names every 30s.',
  },
  reduced: {
    label: 'Reduced',
    statusIntervalMs: 30_000,
    mapPlayersIntervalMs: 60_000,
    detail: 'Status every 30s; selected-map names every minute.',
  },
  minimal: {
    label: 'Minimal',
    statusIntervalMs: 60_000,
    mapPlayersIntervalMs: 120_000,
    detail: 'Status every minute; selected-map names every two minutes.',
  },
} as const satisfies Record<HealthRefreshPreset, {
  label: string
  statusIntervalMs: number
  mapPlayersIntervalMs: number
  detail: string
}>

export const HEALTH_REFRESH_OPTIONS = Object.keys(HEALTH_REFRESH_PRESETS) as HealthRefreshPreset[]

const preference = createEnumPreference(
  HEALTH_REFRESH_KEY,
  'dst:health-refresh-changed',
  HEALTH_REFRESH_OPTIONS,
  'standard',
)

export const setHealthRefreshPreset = preference.set

export function useHealthRefreshPreset() {
  const id = useSyncExternalStore(preference.subscribe, preference.read, () => 'standard' as HealthRefreshPreset)
  return { id, ...HEALTH_REFRESH_PRESETS[id] }
}
