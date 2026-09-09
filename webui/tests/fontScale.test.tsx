// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppearanceCard } from '../src/pages/settings/AppearanceCard'
import { ThemeProvider } from '../src/theme/ThemeContext'
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

  it('applies the selected percentage once at the document root', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    const commandDeckCss = readFileSync(resolve(process.cwd(), 'src/layout/commandDeck.css'), 'utf8')
    const signalCss = readFileSync(resolve(process.cwd(), 'src/theme/signal.css'), 'utf8')
    const spatialCss = readFileSync(resolve(process.cwd(), 'src/pages/workspaces/spatial.css'), 'utf8')
    const scaleBlock = css.match(/\[data-dst-font-scale\]\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
    expect(scaleBlock).toContain('--text-sm: calc(0.875rem * var(--dst-font-scale))')
    expect(scaleBlock).not.toMatch(/\bfont-size\s*:/)
    expect(css).toMatch(/body\s*\{[\s\S]*font-size:\s*var\(--text-base\)/)
    expect(commandDeckCss).toMatch(/\.deck-home-heading h1\s*\{[^}]*--dst-font-scale/)
    expect(signalCss).toMatch(/\.deck-home-heading h1\s*\{[^}]*--dst-font-scale/)
    expect(spatialCss).toMatch(/\.spatial-world-title h1\s*\{[^}]*--dst-font-scale/)
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

  it('uses native radio keyboard behavior for the appearance picker', async () => {
    const user = userEvent.setup()
    act(() => setFontScale('default'))
    render(<ThemeProvider><AppearanceCard /></ThemeProvider>)
    await user.click(screen.getByRole('button', { name: /Appearance/ }))

    const defaultRadio = screen.getByRole('radio', { name: /^Default/ })
    const mediumRadio = screen.getByRole('radio', { name: /^Medium/ })
    expect(defaultRadio).toBeChecked()

    defaultRadio.focus()
    await user.keyboard('{ArrowRight}')

    expect(mediumRadio).toHaveFocus()
    expect(mediumRadio).toBeChecked()
    expect(localStorage.getItem(FONT_SCALE_KEY)).toBe('medium')
  })
})
