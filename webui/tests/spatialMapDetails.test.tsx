// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import type { Player, PlayersResponse } from '../src/api/gameplay'
import SpatialMapDetails, { connectedMapUsers } from '../src/pages/workspaces/SpatialMapDetails'

const state = vi.hoisted(() => ({ data: null as PlayersResponse | null, loading: false, error: null as string | null, refresh: vi.fn() }))
const useApi = vi.hoisted(() => vi.fn())
vi.mock('../src/hooks/useApi', () => ({ useApi }))
const node = { id: 'Survival_1:0', map: 'Survival_1', title: 'Custom sietch name', phase: 'Running', ready: 'Ready', players: '1' }
const player: Player = { id: 1, account_id: 1, controller_id: 1, name: 'Example player', class: 'Player', map: 'Hagga Basin', faction_id: 0, faction_name: '', online_status: 'Online' }
beforeEach(() => {
  state.data = { players: [player], total: 1, source: 'live' }
  state.loading = false
  state.error = null
  useApi.mockImplementation(() => state)
  vi.clearAllMocks()
})
afterEach(cleanup)

describe('Selected map connections', () => {
  it('matches technical and friendly map names and excludes offline or other-map users', () => {
    const users = [player, { ...player, id: 2, map: 'Survival_1' }, { ...player, id: 3, map: 'Deep Desert' }, { ...player, id: 4, online_status: 'Offline' }]
    expect(connectedMapUsers(users, 'Survival_1').map(user => user.id)).toEqual([1, 2])
  })
  it('loads only after selection and never claims an unreported heartbeat', () => {
    const view = render(<SpatialMapDetails node={node} selected={false} instances={1} observedAt="12:00" stale={false} />)
    expect(useApi).toHaveBeenLastCalledWith('/api/gameplay/players', { enabled: false, intervalMs: 30_000 })
    expect(screen.queryByText('Example player')).not.toBeInTheDocument()
    view.rerender(<SpatialMapDetails node={node} selected instances={1} observedAt="12:00" stale={false} refreshIntervalMs={10_000} />)
    expect(useApi).toHaveBeenLastCalledWith('/api/gameplay/players', { enabled: true, intervalMs: 10_000 })
    expect(screen.getByText('Example player')).toBeInTheDocument()
    expect(screen.getByText('Not reported')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh users' }))
    expect(state.refresh).toHaveBeenCalledOnce()
  })
  it('discloses stale, sample and multi-instance data rather than assigning players to the wrong server', () => {
    state.data = { players: [player], total: 1, source: 'demo', liveError: 'Database unavailable' }
    render(<SpatialMapDetails node={node} selected instances={2} observedAt="12:00" stale />)
    expect(screen.getByText('Sample users')).toBeInTheDocument()
    expect(screen.getByText(/not live connections/)).toBeInTheDocument()
    expect(screen.getByText(/Names are map-wide across 2 instances/)).toBeInTheDocument()
    expect(screen.getByText(/status refresh failed/)).toBeInTheDocument()
  })
})
