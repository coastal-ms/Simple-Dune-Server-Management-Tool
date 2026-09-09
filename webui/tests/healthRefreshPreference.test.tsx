// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  HEALTH_REFRESH_KEY,
  setHealthRefreshPreset,
  useHealthRefreshPreset,
} from '../src/hooks/useHealthRefresh'

function Preference() {
  const preset = useHealthRefreshPreset()
  return <button onClick={() => setHealthRefreshPreset('focused')}>
    {preset.id}:{preset.statusIntervalMs}:{preset.mapPlayersIntervalMs}
  </button>
}

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Server Health refresh preference', () => {
  it('preserves the 10-second/30-second default and persists allowlisted presets', () => {
    render(<Preference />)
    expect(screen.getByText('standard:10000:30000')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('focused:10000:10000')).toBeInTheDocument()
    expect(localStorage.getItem(HEALTH_REFRESH_KEY)).toBe('focused')
  })

  it('falls back from malformed storage and follows cross-tab changes', () => {
    localStorage.setItem(HEALTH_REFRESH_KEY, 'instant')
    window.dispatchEvent(new StorageEvent('storage', { key: HEALTH_REFRESH_KEY }))
    render(<Preference />)
    expect(screen.getByText('standard:10000:30000')).toBeInTheDocument()
    act(() => {
      localStorage.setItem(HEALTH_REFRESH_KEY, 'minimal')
      window.dispatchEvent(new StorageEvent('storage', { key: HEALTH_REFRESH_KEY }))
    })
    expect(screen.getByText('minimal:60000:120000')).toBeInTheDocument()
  })
})
