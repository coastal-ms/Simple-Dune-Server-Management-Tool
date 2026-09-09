// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REDUCED_ROUTINE_UI_STORAGE,
  confirmRoutineAction,
  setReducedRoutineUi,
  showRoutineSuccess,
  useReducedRoutineUi,
} from '../src/hooks/useReducedRoutineUi'

function Preference() {
  const reduced = useReducedRoutineUi()
  return <button onClick={() => setReducedRoutineUi(!reduced)}>{reduced ? 'Reduced' : 'Protected'}</button>
}

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('reduced routine UI preference', () => {
  it('defaults off, persists, and synchronizes consumers', () => {
    render(<><Preference /><Preference /></>)
    expect(screen.getAllByText('Protected')).toHaveLength(2)
    fireEvent.click(screen.getAllByText('Protected')[0])
    expect(screen.getAllByText('Reduced')).toHaveLength(2)
    expect(localStorage.getItem(REDUCED_ROUTINE_UI_STORAGE)).toBe('1')
  })

  it('skips only callers that explicitly opt into the routine allowlist', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(confirmRoutineAction('Routine action?')).toBe(false)
    expect(confirm).toHaveBeenCalledOnce()

    act(() => setReducedRoutineUi(true))
    expect(confirmRoutineAction('Routine action?')).toBe(true)
    expect(confirm).toHaveBeenCalledOnce()

    expect(window.confirm('Protected destructive action?')).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(2)
  })

  it('suppresses allowlisted success notices but never alters error reporting', () => {
    const notify = vi.fn()
    showRoutineSuccess(notify, 'Saved.')
    expect(notify).toHaveBeenCalledWith('ok', 'Saved.')
    setReducedRoutineUi(true)
    showRoutineSuccess(notify, 'Saved again.')
    expect(notify).toHaveBeenCalledOnce()
  })
})
