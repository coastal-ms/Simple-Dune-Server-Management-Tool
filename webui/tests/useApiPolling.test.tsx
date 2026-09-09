// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useApi } from '../src/hooks/useApi'

const api = vi.hoisted(() => vi.fn())
vi.mock('../src/api/client', () => ({ api }))

function Probe() {
  useApi('/api/status', { intervalMs: 1_000 })
  return null
}

beforeEach(() => {
  vi.useFakeTimers()
  api.mockReset()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useApi polling', () => {
  it('does not overlap interval requests when the previous request is still running', async () => {
    let resolveFirst!: (value: unknown) => void
    api.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve }))
      .mockResolvedValue({ ok: true })

    render(<Probe />)
    expect(api).toHaveBeenCalledTimes(1)

    await act(async () => { await vi.advanceTimersByTimeAsync(3_000) })
    expect(api).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFirst({ ok: true })
      await Promise.resolve()
    })
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000) })
    expect(api).toHaveBeenCalledTimes(2)
  })
})
