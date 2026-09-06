// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import SpatialMapHealth from '../src/pages/workspaces/SpatialMapHealth'

afterEach(cleanup)
describe('Map health list', () => {
  it('keeps starting maps visible and shows per-instance counts without inventing heartbeat data', () => {
    const select = vi.fn()
    render(<SpatialMapHealth nodes={[
      { id: 'Survival_1:0', map: 'Survival_1', title: 'Northern Watch', phase: 'Running', ready: 'Ready', players: '0', age: '2h' },
      { id: 'DeepDesert_1:0', map: 'DeepDesert_1', title: 'Deep Desert', phase: 'Starting', ready: 'Not ready', players: 'Unknown' },
    ]} selected="Survival_1:0" onSelect={select} observedAt="12:00" stale />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('2h')).toBeInTheDocument()
    expect(screen.getByText('Starting')).toBeInTheDocument()
    expect(screen.getByText(/last known observations/)).toBeInTheDocument()
    expect(screen.getByText(/not a per-map heartbeat/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Inspect health for Deep Desert' }))
    expect(select).toHaveBeenCalledWith('DeepDesert_1:0')
  })
})
