export function createBooleanPreference(key: string, eventName: string) {
  let temporaryChoice: boolean | undefined
  function read() {
    if (temporaryChoice !== undefined) return temporaryChoice
    try { return localStorage.getItem(key) === '1' } catch { return false }
  }
  function subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) {
        temporaryChoice = undefined
        onChange()
      }
    }
    window.addEventListener(eventName, onChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener(eventName, onChange)
      window.removeEventListener('storage', onStorage)
    }
  }
  function set(enabled: boolean) {
    temporaryChoice = enabled
    try {
      localStorage.setItem(key, enabled ? '1' : '0')
      temporaryChoice = undefined
    } catch {
      // A storage-restricted browser can still switch for the current session.
    }
    window.dispatchEvent(new Event(eventName))
  }
  return { read, subscribe, set }
}
