import { useSyncExternalStore } from 'react'
import { createBooleanPreference } from './booleanPreference'

export const REDUCED_ROUTINE_UI_STORAGE = 'dst.appearance.reduced-routine-ui.v1'
const preference = createBooleanPreference(REDUCED_ROUTINE_UI_STORAGE, 'dst:reduced-routine-ui-changed')

export const setReducedRoutineUi = preference.set
export const isReducedRoutineUi = preference.read

export function useReducedRoutineUi() {
  return useSyncExternalStore(preference.subscribe, preference.read, () => false)
}

export function confirmRoutineAction(message: string) {
  return isReducedRoutineUi() || window.confirm(message)
}

export function showRoutineSuccess(notify: (kind: 'ok', message: string) => void, message: string) {
  if (!isReducedRoutineUi()) notify('ok', message)
}
