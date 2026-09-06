import { noise3d } from './terrainNoise'

export const TERRAIN_MAX_HEIGHT = .55125
export const TERRAIN_LEVELS = 12
export const TERRAIN_COLUMNS = 192
export const TERRAIN_ROWS = 96
export const TERRAIN_EDGE_FRACTION = 1 / 210

function smooth(value: number, low: number, high: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

export function terrainFieldFraction(x: number, y: number, z: number) {
  const province = noise3d(x * 2.4 + 6.7, y * 2.4 - 3.2, z * 2.4 + 9.1) * .7
    + noise3d(x * 4.8 - 2.3, y * 4.8 + 8.4, z * 4.8 + 1.8) * .3
  const region = smooth(province, .43, .65)
  if (!region) return 0
  const warp = noise3d(x * 3.1 + 4.3, y * 3.1 + 9.2, z * 3.1 - 7.5) - .5
  const a = noise3d(x * 8 + warp, y * 8 - warp * .7, z * 8 + warp * .5)
  const b = noise3d(x * 17 - 4.7, y * 17 + 3.6, z * 17 + 8.3)
  const ridge = (1 - Math.abs(a * 2 - 1)) ** 4
  const detail = (1 - Math.abs(b * 2 - 1)) ** 3
  const height = region * (.16 + ridge * .69 + detail * .15)
  const levels = height * 10
  const whole = Math.floor(levels), fraction = levels - whole
  return (whole + smooth(fraction, .12, .92)) / 10
}

let grid: Float64Array | undefined
export function terrainFieldGrid() {
  if (grid) return grid
  grid = new Float64Array((TERRAIN_COLUMNS + 1) * (TERRAIN_ROWS + 1))
  for (let row = 0; row <= TERRAIN_ROWS; row++) {
    const theta = row / TERRAIN_ROWS * Math.PI
    for (let column = 0; column <= TERRAIN_COLUMNS; column++) {
      const phi = column / TERRAIN_COLUMNS * Math.PI * 2
      grid[row * (TERRAIN_COLUMNS + 1) + column] = terrainFieldFraction(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta))
    }
  }
  return grid
}

export function globeTerrainHeight(x: number, y: number, z: number) {
  const phi = (Math.atan2(z, -x) + Math.PI * 2) % (Math.PI * 2)
  const column = phi / (Math.PI * 2) * TERRAIN_COLUMNS
  const row = Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI * TERRAIN_ROWS
  const ix = Math.min(TERRAIN_COLUMNS - 1, Math.floor(column)), iy = Math.min(TERRAIN_ROWS - 1, Math.floor(row))
  const u = column - ix, v = row - iy, values = terrainFieldGrid()
  const b = values[iy * (TERRAIN_COLUMNS + 1) + ix], a = values[iy * (TERRAIN_COLUMNS + 1) + ix + 1]
  const c = values[(iy + 1) * (TERRAIN_COLUMNS + 1) + ix], d = values[(iy + 1) * (TERRAIN_COLUMNS + 1) + ix + 1]
  const fraction = u >= v ? b * (1 - u) + a * (u - v) + d * v : b * (1 - v) + c * (v - u) + d * u
  if (fraction <= TERRAIN_EDGE_FRACTION) return 0
  return Math.ceil(fraction * TERRAIN_LEVELS - 1e-9) / TERRAIN_LEVELS * TERRAIN_MAX_HEIGHT
}
