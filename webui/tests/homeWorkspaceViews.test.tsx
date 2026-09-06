// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { ReactNode } from 'react'
import HomeWorkspace from '../src/pages/workspaces/HomeWorkspace'
import { SPATIAL_HOME_KEY } from '../src/hooks/useSpatialHome'

const mode = vi.hoisted(() => ({ themed: true }))
vi.mock('../src/hooks/useCommandDeck', () => ({ useCommandDeck: () => mode.themed }))
vi.mock('../src/pages/Dashboard', () => ({ Dashboard: () => <h1>Server health dashboard</h1> }))
vi.mock('../src/layout/SpatialFrame', () => ({ default: ({ children }: { children: ReactNode }) => <div data-testid="themed-frame">{children}</div> }))
vi.mock('../src/pages/workspaces/SpatialHome', () => ({
  default: ({ onDetails, startEnabled }: { onDetails: () => void; startEnabled: boolean }) =>
    <section aria-label="Spatial home" data-start-enabled={startEnabled}><button onClick={onDetails}>Dashboard</button></section>,
}))
beforeEach(() => {
  mode.themed = true
  localStorage.clear()
  window.dispatchEvent(new StorageEvent('storage', { key: null }))
})
afterEach(cleanup)

describe('Themed home view choice', () => {
  it('defaults to the real health dashboard inside the themed frame, without a globe splash', async () => {
    render(<HomeWorkspace />)
    await screen.findByRole('heading', { name: 'Server health dashboard' })
    expect(screen.getByTestId('themed-frame')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Spatial home' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('persists explicit spatial choice and returns to the themed dashboard', async () => {
    const first = render(<HomeWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Spatial view' }))
    expect(await screen.findByRole('region', { name: 'Spatial home' })).toHaveAttribute('data-start-enabled', 'true')
    expect(localStorage.getItem(SPATIAL_HOME_KEY)).toBe('1')
    first.unmount()
    render(<HomeWorkspace />)
    await screen.findByRole('region', { name: 'Spatial home' })
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    await screen.findByRole('heading', { name: 'Server health dashboard' })
    expect(localStorage.getItem(SPATIAL_HOME_KEY)).toBe('0')
  })
  it('keeps classic layout on the dashboard regardless of saved spatial choice', async () => {
    mode.themed = false
    localStorage.setItem(SPATIAL_HOME_KEY, '1')
    render(<HomeWorkspace />)
    await screen.findByRole('heading', { name: 'Server health dashboard' })
    expect(screen.queryByTestId('themed-frame')).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Spatial home' })).not.toBeInTheDocument()
  })
})
