import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, registerOnlinePlayerConfirmationHandler } from '../src/api/client'
import type { Command, CommandsResponse } from '../src/api/types'
import type { PortalAccountRole } from '../src/auth/portalAccess'
import { COMMAND_DECK_KEY } from '../src/hooks/useCommandDeck'
import { Commands } from '../src/pages/Commands'

const state = vi.hoisted(() => ({
  local: true,
  role: null as PortalAccountRole,
  data: null as CommandsResponse | null,
  loading: false,
  error: null as string | null,
  refresh: vi.fn(async () => {}),
  forceRefresh: vi.fn(async () => {}),
  navigate: vi.fn(),
}))
vi.mock('../src/hooks/useStatus', () => ({ useStatus: () => ({ forceRefresh: state.forceRefresh }) }))
vi.mock('../src/hooks/useApi', () => ({ useApi: () => ({
  data: state.data, loading: state.loading, error: state.error, refresh: state.refresh,
}) }))
vi.mock('../src/util/viewer', () => ({ isLocalViewer: () => state.local }))
vi.mock('../src/auth/PortalAuthGate', () => ({ usePortalAuth: () => ({
  status: { account: state.role ? { role: state.role } : null },
}) }))
vi.mock('../src/router', () => ({ useNavigate: () => state.navigate }))
vi.mock('../src/api/client', async importOriginal => ({
  ...await importOriginal<typeof import('../src/api/client')>(),
  api: vi.fn(),
}))

function command(name: string, label: string, overrides: Partial<Command> = {}): Command {
  return {
    name, label, section: 'Battlegroup', key: '1', mode: 'Console', requires: 'running',
    external: true, desc: `Run the ${label.toLowerCase()} operation.`, available: true, reason: '',
    ...overrides,
  }
}

function fixture(): CommandsResponse {
  const commands = [
    command('start-vm', 'Start VM', { section: 'VM', requires: 'exists' }),
    command('reboot', 'Reboot VM', { section: 'VM' }),
    command('startup', 'Startup'),
    command('start', 'Start battlegroup'),
    command('restart', 'Restart battlegroup', { desc: 'Restart the game servers safely.' }),
    command('apply-inis', 'Apply INIs'),
    command('update', 'Update server'),
    command('delete-vm', 'Delete VM', { section: 'VM', requires: 'exists' }),
    command('inspect/logs', 'Inspect logs', { section: 'Tools', requires: 'none', mode: 'InApp' }),
    command('stop', 'Stop battlegroup', { available: false, reason: 'VM is not running.' }),
  ]
  return {
    state: {
      vmExists: true, vmRunning: true, bgState: 'running',
      vm: { exists: true, running: true, name: 'Test VM', state: 'Running', ip: null, uptime: 0 },
    },
    sectionNames: ['My VM', 'Game services', 'Tools'],
    sections: [
      ['start-vm', 'reboot', 'delete-vm'],
      ['startup', 'start', 'restart', 'apply-inis', 'update', 'stop'],
      ['inspect/logs'],
    ],
    commands,
  }
}

let unregisterGuard: (() => void) | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  vi.mocked(api).mockReset()
  vi.mocked(api).mockResolvedValue({ ok: true, name: 'restart', mode: 'Console', pid: null, started: '' })
  localStorage.setItem(COMMAND_DECK_KEY, '1')
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
  state.local = true
  state.role = null
  state.data = fixture()
  state.loading = false
  state.error = null
})
afterEach(() => {
  unregisterGuard?.()
  unregisterGuard = undefined
  cleanup()
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function choices() {
  return within(screen.getByRole('navigation', { name: 'Command tasks choices' }))
}
function selectTask(name: RegExp) {
  fireEvent.click(choices().getByRole('button', { name }))
}

describe('Contextual Commands workbench', () => {
  it('offers every existing local operation in saved section order without exposing a run-card wall', () => {
    render(<Commands />)
    expect(choices().getAllByRole('button').map(button => button.textContent)).toEqual([
      'Start VMMy VM', 'Reboot VMMy VM', 'Delete VMMy VM',
      'StartupGame services', 'Start battlegroupGame services', 'Restart battlegroupGame services',
      'Apply INIsGame services', 'Update serverGame services', 'Stop battlegroupGame services',
      'Inspect logsTools', 'Open PowerShellTools',
    ])
    expect(screen.getByRole('heading', { name: 'Select a task' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Run / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('searches descriptions, command names, reasons, and saved categories without executing or losing selection', () => {
    const confirm = vi.spyOn(window, 'confirm')
    render(<Commands />)
    const search = screen.getByRole('searchbox', { name: 'Search command tasks' })
    fireEvent.change(search, { target: { value: 'game safely' } })
    expect(choices().getAllByRole('button')).toHaveLength(1)
    selectTask(/^Restart battlegroup/)
    const run = screen.getByRole('button', { name: 'Run Restart battlegroup' })
    expect(run).toBeEnabled()
    fireEvent.change(search, { target: { value: 'inspect/logs' } })
    expect(choices().getAllByRole('button')).toHaveLength(1)
    expect(choices().getByRole('button', { name: /^Inspect logs/ })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'VM is not running' } })
    expect(choices().getByRole('button', { name: /^Stop battlegroup/ })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'no such operation' } })
    expect(screen.getByText('No matching actions.')).toBeInTheDocument()
    expect(run).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Action category' }), { target: { value: 'My VM' } })
    expect(choices().getAllByRole('button')).toHaveLength(3)
    expect(api).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(state.navigate).not.toHaveBeenCalled()
  })

  it('supports keyboard selection without dispatch and uses the original encoded run endpoint only on Run', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    render(<Commands />)
    choices().getByRole('button', { name: /^Inspect logs/ }).focus()
    await user.keyboard('{Enter}')
    expect(api).not.toHaveBeenCalled()
    vi.useFakeTimers()
    vi.mocked(api).mockResolvedValueOnce({ ok: true, name: 'inspect/logs', mode: 'InApp', pid: 42, started: '' })
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Inspect logs' })) })
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/run/inspect%2Flogs', { method: 'POST' })
    expect(screen.getByText("Launched 'inspect/logs' (PID 42) in a new console window.")).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(state.refresh).toHaveBeenCalledOnce()
    expect(state.forceRefresh).toHaveBeenCalledOnce()
  })

  it.each(['players_online', 'player_status_unknown'] as const)(
    'retains the %s guard, busy state, cancellation, and explicit forced retry',
    async conflict => {
      vi.mocked(api).mockRejectedValueOnce(new ApiError(409, 'Player safety check', {
        conflict, playersOnline: conflict === 'players_online' ? 1 : null,
        playerNames: ['Test player'], message: 'Confirm before continuing.',
      }))
      let answer!: (allow: boolean) => void
      const confirmation = new Promise<boolean>(resolve => { answer = resolve })
      const guard = vi.fn(() => confirmation)
      unregisterGuard = registerOnlinePlayerConfirmationHandler(guard)
      render(<Commands />)
      selectTask(/^Restart battlegroup/)
      expect(guard).not.toHaveBeenCalled()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Restart battlegroup' })) })
      expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/run/restart', { method: 'POST' })
      expect(guard).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: 'Launching…' })).toBeDisabled()
      expect(choices().getAllByRole('button').every(button => button.hasAttribute('disabled'))).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: 'Launching…' }))
      expect(api).toHaveBeenCalledOnce()
      await act(async () => { answer(false) })
      expect(screen.getByRole('button', { name: 'Run Restart battlegroup' })).toBeEnabled()
      expect(api).toHaveBeenCalledOnce()
      expect(screen.queryByText(/Launch failed/)).not.toBeInTheDocument()

      unregisterGuard()
      unregisterGuard = registerOnlinePlayerConfirmationHandler(async () => true)
      vi.mocked(api).mockRejectedValueOnce(new ApiError(409, 'Player safety check', { conflict }))
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Restart battlegroup' })) })
      expect(vi.mocked(api).mock.calls).toEqual([
        ['/api/commands/run/restart', { method: 'POST' }],
        ['/api/commands/run/restart', { method: 'POST' }],
        ['/api/commands/run/restart?force=true', { method: 'POST' }],
      ])
    },
  )

  it('shows current VM requirements and unavailable reasons, updating the selected task from refreshed data', () => {
    const view = render(<Commands />)
    selectTask(/^Stop battlegroup/)
    expect(screen.getByText('Requires a running VM.')).toBeInTheDocument()
    expect(screen.getByText('VM is not running.')).toBeInTheDocument()
    const run = screen.getByRole('button', { name: 'Run Stop battlegroup' })
    expect(run).toBeDisabled()
    fireEvent.click(run)
    expect(api).not.toHaveBeenCalled()
    const fresh = fixture()
    fresh.commands = fresh.commands.map(item => item.name === 'stop' ? { ...item, available: true, reason: '' } : item)
    state.data = fresh
    view.rerender(<Commands />)
    expect(screen.getByRole('button', { name: 'Run Stop battlegroup' })).toBeEnabled()
    expect(screen.queryByText('VM is not running.')).not.toBeInTheDocument()
  })

  it.each<PortalAccountRole>(['admin', 'owner', null])(
    'preserves the remote allowlist and local-only boundaries for role %s, including an unplaced owner update',
    role => {
      state.local = false
      state.role = role
      const data = fixture()
      data.sections[1] = data.sections[1].filter(name => name !== 'update')
      state.data = data
      render(<Commands />)
      expect(choices().getAllByRole('button')).toHaveLength(role === 'owner' ? 7 : 6)
      for (const label of ['Start VM', 'Reboot VM', 'Startup', 'Start battlegroup', 'Restart battlegroup', 'Apply INIs']) {
        expect(choices().getByRole('button', { name: new RegExp(`^${label}`) })).toBeInTheDocument()
      }
      expect(choices().queryByRole('button', { name: /^Update server/ }) !== null).toBe(role === 'owner')
      expect(screen.queryByRole('button', { name: /Delete VM|Inspect logs|Stop battlegroup|Open PowerShell/ })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit layout' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument()
      selectTask(/^Restart battlegroup/)
      expect(screen.getByRole('button', { name: 'Run Restart battlegroup' })).toBeEnabled()
      expect(api).not.toHaveBeenCalled()
    },
  )

  it('opens the existing local PowerShell route only after the explicit Open action', () => {
    render(<Commands />)
    selectTask(/^Open PowerShell/)
    expect(state.navigate).not.toHaveBeenCalled()
    expect(screen.getByText("Open DST's embedded PowerShell terminal on this computer.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open PowerShell' }))
    expect(state.navigate).toHaveBeenCalledExactlyOnceWith('/terminal')
    expect(api).not.toHaveBeenCalled()
  })

  it('retains the local section editor and persists renames only from editing, returning to the selected task', async () => {
    render(<Commands />)
    selectTask(/^Restart battlegroup/)
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
    expect(screen.queryByRole('region', { name: 'Command tasks' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Reset layout' })).toBeInTheDocument()
    expect(api).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Game services' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Server tasks' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(api).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(400) })
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/layout', {
      method: 'PUT',
      body: JSON.stringify({ sectionNames: ['My VM', 'Server tasks', 'Tools'], sections: fixture().sections }),
    })
    fireEvent.click(screen.getByRole('button', { name: 'Done editing' }))
    expect(screen.getByRole('button', { name: 'Run Restart battlegroup' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Server tasks' })).toBeInTheDocument()
  })

  it('retains the exact layout-reset confirmation and does not reset when declined', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Commands />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit layout' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset layout' }))
    expect(confirm).toHaveBeenCalledExactlyOnceWith('Reset the Commands page to its default layout (section names, order, and assignments)?')
    expect(api).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Reset layout' })) })
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/layout/reset', { method: 'POST' })
  })

  it('retains keyboard ordering through the original local drag handles without running a command', async () => {
    vi.useRealTimers()
    const user = userEvent.setup()
    const data = fixture()
    const order = data.sections.flat()
    const getRect = HTMLElement.prototype.getBoundingClientRect
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const label = this.firstElementChild?.getAttribute('aria-label')
      const index = order.indexOf(label?.replace('Reorder ', '') ?? '')
      return index < 0 ? getRect.call(this) : new DOMRect(0, index * 80, 300, 64)
    })
    render(<Commands />)
    await user.click(screen.getByRole('button', { name: 'Edit layout' }))
    screen.getByRole('button', { name: 'Reorder start-vm' }).focus()
    await user.keyboard('[Space][ArrowDown][Space]')
    await waitFor(() => expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/layout', {
      method: 'PUT',
      body: JSON.stringify({
        sectionNames: data.sectionNames,
        sections: [['reboot', 'start-vm', 'delete-vm'], data.sections[1], data.sections[2]],
      }),
    }))
  })

  it('retains classic sections, card actions, layout controls, and the local PowerShell link outside opt-in', async () => {
    localStorage.setItem(COMMAND_DECK_KEY, '0')
    render(<Commands />)
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit layout' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(10)
    expect(screen.getByRole('button', { name: 'Reset layout' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Open PowerShell/ })).toBeInTheDocument()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /^1Restart battlegroup Console/ })) })
    expect(api).toHaveBeenCalledExactlyOnceWith('/api/commands/run/restart', { method: 'POST' })
  })

  it('preserves loading, error, refresh, and launch-failure feedback', async () => {
    state.data = null
    state.loading = true
    const view = render(<Commands />)
    expect(screen.getByText('Loading commands…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
    state.loading = false
    state.error = 'Commands could not be loaded.'
    view.rerender(<Commands />)
    expect(screen.getByText('Commands could not be loaded.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(state.refresh).toHaveBeenCalledOnce()
    expect(state.forceRefresh).toHaveBeenCalledOnce()

    state.data = fixture()
    state.error = null
    view.rerender(<Commands />)
    selectTask(/^Restart battlegroup/)
    vi.mocked(api).mockRejectedValueOnce(new Error('VM unavailable'))
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Run Restart battlegroup' })) })
    expect(screen.getByText('Launch failed: VM unavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run Restart battlegroup' })).toBeEnabled()
  })
})
