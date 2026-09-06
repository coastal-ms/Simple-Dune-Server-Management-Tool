function hash(x: number, y: number, z: number) {
  let value = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647)
  value = Math.imul(value ^ value >>> 13, 1274126177)
  return ((value ^ value >>> 16) >>> 0) / 4294967295
}

export function noise3d(x: number, y: number, z: number) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z)
  const smooth = (value: number) => value * value * (3 - 2 * value)
  const fx = smooth(x - ix), fy = smooth(y - iy), fz = smooth(z - iz)
  const mix = (a: number, b: number, t: number) => a + (b - a) * t
  const lower = mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy)
  const upper = mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy)
  return mix(lower, upper, fz)
}
