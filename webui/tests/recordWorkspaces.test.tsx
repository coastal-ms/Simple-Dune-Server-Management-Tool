import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BasesTab } from '../src/pages/gameplay/BasesTab'
import { MarketTab } from '../src/pages/gameplay/MarketTab'
import VehiclesWorkspace from '../src/pages/workspaces/VehiclesWorkspace'
import {
  getBases, getMarketItems, getMarketStats, getMarketCategories, getMarketListings, getMarketSales,
  getVehicleFleet, getVehicleDeletionQueue, queueVehicleDeletion, destroyClaim,
} from '../src/api/gameplay'
import { COMMAND_DECK_KEY } from '../src/hooks/useCommandDeck'

vi.mock('../src/hooks/useStatus', () => ({ useStatus: () => ({ status: { bg: { state: 'running' } } }) }))
vi.mock('../src/api/gameplay', async importOriginal => ({
  ...await importOriginal<typeof import('../src/api/gameplay')>(),
  getBases: vi.fn(), getMarketItems: vi.fn(), getMarketStats: vi.fn(), getMarketCategories: vi.fn(), getMarketListings: vi.fn(), getMarketSales: vi.fn(),
  getVehicleFleet: vi.fn(), getVehicleDeletionQueue: vi.fn(), queueVehicleDeletion: vi.fn(), destroyClaim: vi.fn(),
}))
beforeEach(() => {
  localStorage.setItem(COMMAND_DECK_KEY, '1')
  vi.mocked(getBases).mockResolvedValue({ source: 'live', bases: [{ id: 1, name: 'North base', owner: 'Aster', pieces: 40, placeables: 12, totemId: 11 }] })
  vi.mocked(getMarketItems).mockResolvedValue({ source: 'live', total: 1, page: 0, limit: 50, items: [{
    template_id: 'TestItem', quality: 0, display_name: 'Test item', category: 'items/resources', tier: 1, rarity: 'common', lowest_price: 25, total_stock: 10, bot_stock: 0, listing_count: 1, icon: '',
  }] })
  vi.mocked(getMarketStats).mockResolvedValue({ source: 'live', stats: { total_listings: 1, bot_listings: 0, player_listings: 1, total_stock: 10, bot_stock: 0, player_stock: 10, unique_items: 1 } })
  vi.mocked(getMarketCategories).mockResolvedValue({ categories: ['items/resources'] })
  vi.mocked(getMarketListings).mockResolvedValue({ source: 'live', listings: [] })
  vi.mocked(getMarketSales).mockResolvedValue({ source: 'live', sales: [] })
  vi.mocked(getVehicleFleet).mockResolvedValue({ source: 'live', total: 1, vehicles: [{ id: 7, class: 'Buggy', vehicle_name: 'Scout', owners: 'Aster', map: 'Survival_1', actor_state: 'Active' }] })
  vi.mocked(getVehicleDeletionQueue).mockResolvedValue({ entries: [], history: [], running: false })
})
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/') })

describe('Record-focused gameplay workspaces', () => {
  it('opens a keyboard-operable base dossier without weakening the stopped-battlegroup release guard', async () => {
    const user = userEvent.setup()
    render(<BasesTab />)
    const inspect = await screen.findByRole('button', { name: 'Inspect base North base' })
    expect(screen.getByRole('button', { name: 'Release claim' })).toBeDisabled()
    inspect.focus()
    await user.keyboard('{Enter}')
    const dialog = screen.getByRole('dialog', { name: 'North base' })
    expect(within(dialog).getByText('Aster')).toBeInTheDocument()
    expect(destroyClaim).not.toHaveBeenCalled()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(inspect).toHaveFocus()
  })
  it('opens market details accessibly and reports failed reads rather than empty successful data', async () => {
    vi.mocked(getMarketListings).mockRejectedValue(new Error('Listings unavailable'))
    const user = userEvent.setup()
    render(<MarketTab />)
    const inspect = await screen.findByRole('button', { name: 'Inspect Test item' })
    inspect.focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('dialog', { name: 'Test item' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Listings unavailable')
    expect(screen.queryByText('No active listings.')).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    expect(inspect).toHaveFocus()
  })
  it('filters and inspects vehicles before reaching the existing typed removal confirmation', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    render(<VehiclesWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Scout' }))
    const dialog = screen.getByRole('dialog', { name: 'Scout' })
    expect(within(dialog).getByText('Buggy')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Queue removal' }))
    expect(window.prompt).toHaveBeenCalledOnce()
    expect(queueVehicleDeletion).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Close detail panel' }))
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search vehicle fleet' }), { target: { value: 'absent' } })
    expect(screen.queryByRole('button', { name: 'Inspect Scout' })).not.toBeInTheDocument()
    expect(screen.queryByText('Demo Data')).not.toBeInTheDocument()
  })
  it('labels demo vehicles honestly and prevents their deletion', async () => {
    vi.mocked(getVehicleFleet).mockResolvedValue({ source: 'demo', total: 1, vehicles: [{ id: 7, class: 'Buggy', vehicle_name: 'Scout' }] })
    render(<VehiclesWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Scout' }))
    expect(screen.getByRole('button', { name: 'Queue removal' })).toBeDisabled()
    await waitFor(() => expect(screen.queryByText('1 live vehicle')).not.toBeInTheDocument())
  })
  it('shows a removal failure inside the open vehicle panel and retains it after closing', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('DELETE 7')
    vi.mocked(queueVehicleDeletion).mockRejectedValueOnce(new Error('Removal queue unavailable'))
    render(<VehiclesWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Scout' }))
    const dialog = screen.getByRole('dialog', { name: 'Scout' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Queue removal' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Removal queue unavailable')
    expect(queueVehicleDeletion).toHaveBeenCalledWith(7, 'DELETE 7')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close detail panel' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Removal queue unavailable')
  })
  it('shows a mismatched removal confirmation inside the open vehicle panel', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('wrong')
    render(<VehiclesWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Scout' }))
    const dialog = screen.getByRole('dialog', { name: 'Scout' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Queue removal' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('confirmation did not match DELETE 7')
    expect(queueVehicleDeletion).not.toHaveBeenCalled()
  })
  it('shows successful removal queuing inside the open vehicle panel', async () => {
    vi.spyOn(window, 'prompt').mockReturnValue('DELETE 7')
    vi.mocked(queueVehicleDeletion).mockResolvedValueOnce({
      ok: true,
      message: 'Removal queued',
      entry: { id: 'queue-7', vehicle_id: 7, status: 'queued', attempts: 0, created_at: '2026-09-05T23:00:00Z' },
    })
    render(<VehiclesWorkspace />)
    fireEvent.click(await screen.findByRole('button', { name: 'Inspect Scout' }))
    const dialog = screen.getByRole('dialog', { name: 'Scout' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Queue removal' }))
    expect(await within(dialog).findByRole('status')).toHaveTextContent('Removal queued')
  })
})
