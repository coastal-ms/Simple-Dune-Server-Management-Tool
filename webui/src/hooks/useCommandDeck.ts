import { useSyncExternalStore } from 'react'
import { createBooleanPreference } from './booleanPreference'

export const COMMAND_DECK_KEY = 'dst.experience.command-deck.v1'
const preference = createBooleanPreference(COMMAND_DECK_KEY, 'dst:experience-changed')
export const setCommandDeck = preference.set

export function useCommandDeck() {
  return useSyncExternalStore(preference.subscribe, preference.read, () => false)
}
