import { describe, expect, it } from 'vitest'
import { clampGlobeZoom, parseGlobeZoom } from '../src/pages/workspaces/globeZoom'

describe('Versioned globe camera zoom', () => {
  it('bounds finite values to 50-300 percent', () => {
    expect(clampGlobeZoom(-1)).toBe(.5)
    expect(clampGlobeZoom(10)).toBe(3)
    expect(clampGlobeZoom(1.234)).toBe(1.23)
    expect(() => clampGlobeZoom(NaN)).toThrow()
  })
  it('restores a valid versioned value', () => {
    expect(parseGlobeZoom('{"version":1,"zoom":1.75}')).toBe(1.75)
  })
  it.each(['null', '{}', '{"version":2,"zoom":1}', '{"version":1,"zoom":4}', '{"version":1,"zoom":"2"}'])('rejects invalid saved zoom %s', raw => {
    expect(() => parseGlobeZoom(raw)).toThrow()
  })
})
