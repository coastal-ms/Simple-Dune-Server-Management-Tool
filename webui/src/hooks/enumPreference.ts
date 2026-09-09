export function createEnumPreference<const T extends string>(
  key: string,
  eventName: string,
  values: readonly T[],
  defaultValue: T,
) {
  const allowed = new Set<string>(values)
  let temporaryChoice: T | undefined

  function read(): T {
    if (temporaryChoice !== undefined) return temporaryChoice
    try {
      const stored = localStorage.getItem(key)
      return stored && allowed.has(stored) ? stored as T : defaultValue
    } catch {
      return defaultValue
    }
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

  function set(value: T) {
    if (!allowed.has(value)) return
    temporaryChoice = value
    try {
      localStorage.setItem(key, value)
      temporaryChoice = undefined
    } catch {
      // A storage-restricted browser can still switch for the current session.
    }
    window.dispatchEvent(new Event(eventName))
  }

  return { read, subscribe, set }
}
