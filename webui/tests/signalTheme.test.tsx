// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme, THEME_STORAGE_KEY, computeResolved } from '../src/theme/ThemeContext'
import { DEFAULT_PRESET_ID, getPreset } from '../src/theme/presets'
import { TOKEN_KEYS } from '../src/theme/tokens'

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(pair => {
    const channel = parseInt(pair, 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722
}
function contrast(a: string, b: string) {
  const pair = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (pair[0] + .05) / (pair[1] + .05)
}

afterEach(() => { cleanup(); localStorage.clear(); document.documentElement.removeAttribute('data-dst-theme') })

describe('Signal visual system', () => {
  it.each(['world-control', 'daylight'])('provides a complete readable %s palette', id => {
    const tokens = getPreset(id)!.tokens
    expect(Object.keys(tokens).sort()).toEqual([...TOKEN_KEYS].sort())
    for (const surface of ['--color-base', '--color-surface', '--color-surface-2', '--color-surface-3']) {
      for (const text of ['--color-text', '--color-text-muted', '--color-text-dim']) {
        expect(contrast(tokens[text], tokens[surface]), `${id}: ${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const accent of ['--color-accent', '--color-accent-bright']) {
      expect(contrast(tokens['--color-accent-fg'], tokens[accent])).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('provides every shared token and keeps the existing default', () => {
    const preset = getPreset('signal')!
    expect(DEFAULT_PRESET_ID).toBe('eyes-of-ibad')
    expect(Object.keys(preset.tokens).sort()).toEqual([...TOKEN_KEYS].sort())
    expect(computeResolved('signal', { '--color-accent': '#123456' })['--color-accent']).toBe('#123456')
  })
  it('keeps normal text and primary button labels at AA contrast', () => {
    const tokens = getPreset('signal')!.tokens
    for (const surface of ['--color-base', '--color-surface', '--color-surface-2', '--color-surface-3']) {
      for (const text of ['--color-text', '--color-text-muted', '--color-text-dim']) {
        expect(contrast(tokens[text], tokens[surface]), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
    for (const accent of ['--color-accent', '--color-accent-bright']) {
      expect(contrast(tokens['--color-accent-fg'], tokens[accent])).toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(tokens['--color-base'], tokens['--color-success'])).toBeGreaterThanOrEqual(4.5)
  })
  it('switches the shared skin, persists it, and restores classic styling', () => {
    function Picker() {
      const theme = useTheme()
      return <><button onClick={() => theme.setPreset('signal')}>Signal</button><button onClick={theme.resetToDefault}>Default</button></>
    }
    render(<ThemeProvider><Picker /></ThemeProvider>)
    fireEvent.click(screen.getByText('Signal'))
    expect(document.documentElement.dataset.dstTheme).toBe('signal')
    expect(document.documentElement.style.getPropertyValue('--color-base')).toBe('#08090c')
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).presetId).toBe('signal')
    fireEvent.click(screen.getByText('Default'))
    expect(document.documentElement.dataset.dstTheme).toBe(DEFAULT_PRESET_ID)
    expect(document.documentElement.style.getPropertyValue('--color-base')).toBe('#0c0a09')
  })
})
