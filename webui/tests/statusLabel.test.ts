import { describe, expect, it } from 'vitest'
import { statusLabel } from '../src/util/statusLabel'

describe('Known status capitalization', () => {
  it.each([['running', 'Running'], ['READY', 'Ready'], ['starting', 'Starting'], ['stopped', 'Stopped'], ['unknown', 'Unknown'], ['not ready', 'Not ready']])('formats %s as %s', (raw, expected) => {
    expect(statusLabel(raw)).toBe(expected)
  })
  it.each(['FLS API', 'My CUSTOM status', '__proto__', 'Hagga NORTH'])('preserves arbitrary text and acronyms: %s', raw => {
    expect(statusLabel(raw)).toBe(raw)
  })
})
