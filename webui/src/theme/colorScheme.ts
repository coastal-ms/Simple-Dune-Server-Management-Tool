import { normalizeHex } from './tokens'

export function colorSchemeForBase(value: string): 'light' | 'dark' {
  const base = normalizeHex(value).slice(1, 7)
  const channels = [0, 2, 4].map(offset => {
    const channel = parseInt(base.slice(offset, offset + 2), 16) / 255
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
  })
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722 > .179 ? 'light' : 'dark'
}
