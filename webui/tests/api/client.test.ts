import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  PlayerGuardCancelledError,
  registerOnlinePlayerConfirmationHandler,
  withOnlinePlayerGuard,
} from '../../src/api/client'
import { saveVehicleNames } from '../../src/api/gameplay'

let unregisterConfirmation: (() => void) | null = null

function confirmWith(result: boolean) {
  const handler = vi.fn(async () => result)
  unregisterConfirmation = registerOnlinePlayerConfirmationHandler(handler)
  return handler
}

afterEach(() => {
  unregisterConfirmation?.()
  unregisterConfirmation = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('online player guard', () => {
  it('shows player details and retries only after confirmation', async () => {
    const confirm = confirmWith(true)
    const operation = vi.fn(async (force: boolean) => {
      if (!force) {
        throw new ApiError(409, 'conflict', {
          ok: false,
          conflict: 'players_online',
          playersOnline: 2,
          playerNames: ['Vospers', 'Fargan'],
          players: [],
          message: 'Restarting will disconnect them.',
        })
      }
      return 'done'
    })

    await expect(withOnlinePlayerGuard(operation)).resolves.toBe('done')
    expect(operation.mock.calls).toEqual([[false], [true]])
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      playerNames: ['Vospers', 'Fargan'],
      message: 'Restarting will disconnect them.',
    }))
  })

  it('does not retry when the operator cancels', async () => {
    confirmWith(false)
    const operation = vi.fn(async () => {
      throw new ApiError(409, 'conflict', {
        conflict: 'players_online',
        playersOnline: 1,
        playerNames: ['Vospers'],
      })
    })

    await expect(withOnlinePlayerGuard(operation)).rejects.toBeInstanceOf(PlayerGuardCancelledError)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('requires confirmation before forcing when player status is unknown', async () => {
    const confirm = confirmWith(true)
    const operation = vi.fn(async (force: boolean) => {
      if (!force) {
        throw new ApiError(409, 'conflict', {
          conflict: 'player_status_unknown',
          playersOnline: null,
          playerNames: [],
          message: 'DST could not verify whether players are online.',
        })
      }
      return 'forced'
    })

    await expect(withOnlinePlayerGuard(operation)).resolves.toBe('forced')
    expect(operation.mock.calls).toEqual([[false], [true]])
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      conflict: 'player_status_unknown',
    }))
  })

  it('fails closed when the DST confirmation host is unavailable', async () => {
    const operation = vi.fn(async () => {
      throw new ApiError(409, 'conflict', {
        conflict: 'player_status_unknown',
        playersOnline: null,
        playerNames: [],
      })
    })

    await expect(withOnlinePlayerGuard(operation)).rejects.toThrow(
      'Player safety confirmation is unavailable. The action was not started.',
    )
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('retries vehicle-name saves only after the online-player confirmation', async () => {
    const confirm = confirmWith(true)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: false,
        conflict: 'players_online',
        playersOnline: 1,
        playerNames: ['Vospers'],
        players: [],
        message: 'Saving names will restart the battlegroup.',
      }), { status: 409, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        renamed: 1,
        restart_started: true,
        message: 'Saved and restarted.',
      }), { status: 202, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(saveVehicleNames([
      { vehicle_id: 42, expected_current_name: 'Scout', name: 'Desert Runner' },
    ], 'a'.repeat(64))).resolves.toMatchObject({ renamed: 1, restart_started: true })

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      '/api/gameplay/vehicles/names',
      '/api/gameplay/vehicles/names?force=true',
    ])
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ playerNames: ['Vospers'] }))
  })
})
