// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import {
  FONT_SCALE_KEY,
  setFontScale,
  useDocumentFontScale,
  useFontScale,
} from '../src/hooks/useFontScale'

function ScalePicker() {
  const scale = useFontScale()
  return <button data-dst-font-scale={scale} onClick={() => setFontScale(scale === 'default' ? 'medium' : 'large')}>
    {scale}
  </button>
}

function DocumentScale() {
  const scale = useFontScale()
  useDocumentFontScale(scale)
  return null
}

beforeEach(() => {
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('font scale preference', () => {
  it('defaults safely, persists valid choices, and synchronizes consumers', () => {
    render(<><DocumentScale /><ScalePicker /><ScalePicker /></>)
    expect(screen.getAllByText('default')).toHaveLength(2)
    expect(document.documentElement).toHaveAttribute('data-dst-font-scale', 'default')
    fireEvent.click(screen.getAllByText('default')[0])
    expect(screen.getAllByText('medium')).toHaveLength(2)
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBe('medium')
    expect(document.documentElement).toHaveAttribute('data-dst-font-scale', 'medium')
    act(() => {
      localStorage.setItem(FONT_SCALE_KEY, 'large')
      window.dispatchEvent(new StorageEvent('storage', { key: FONT_SCALE_KEY }))
    })
    expect(screen.getAllByText('large')).toHaveLength(2)
    expect(document.documentElement).toHaveAttribute('data-dst-font-scale', 'large')
  })

  it('rejects malformed stored values and still switches when storage is blocked', () => {
    localStorage.setItem(FONT_SCALE_KEY, 'enormous')
    window.dispatchEvent(new StorageEvent('storage', { key: FONT_SCALE_KEY }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ScalePicker />)
    expect(screen.getByText('default')).toHaveAttribute('data-dst-font-scale', 'default')
    fireEvent.click(screen.getByText('default'))
    expect(screen.getByText('medium')).toHaveAttribute('data-dst-font-scale', 'medium')
  })
})
