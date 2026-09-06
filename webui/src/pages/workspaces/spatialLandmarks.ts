import * as T from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { SpatialLocationKind } from './spatialModel'

// Original symbolic models: no sampled game textures, heightmaps, or measured terrain.
export function createSpatialLandmark(kind: SpatialLocationKind, stone: T.Material, strata: T.Material) {
  const surfaces: T.BufferGeometry[] = []
  const bands: T.BufferGeometry[] = []
  const accents: T.BufferGeometry[] = []
  let accentColor = 0x9edce5
  function block(width: number, height: number, depth: number, x: number, y: number, z: number) {
    surfaces.push(new T.BoxGeometry(width, height, depth).translate(x, y + height / 2, z))
  }
  function layer(radius: number, height: number, x: number, y: number, z: number, index: number, stretch = 1) {
    const geometry = new T.CylinderGeometry(radius, radius * 1.04, height, 7)
    geometry.scale(1, 1, stretch).rotateY(.2).translate(x, y + height / 2, z)
    const pieces = index % 3 === 0 ? bands : surfaces
    pieces.push(geometry)
  }
  function haggaLayer(radius: number, height: number, x: number, y: number, z: number, index: number, stretch = 1) {
    const points = Array.from({ length: 16 }, (_, point) => {
      const angle = point / 16 * Math.PI * 2
      const c = Math.cos(angle), s = Math.sin(angle)
      const edge = 1 + .045 * Math.sin(angle * 3 + index * .17) + .025 * Math.cos(angle * 7)
      return new T.Vector2(Math.sign(c) * Math.abs(c) ** .65 * radius * edge,
        Math.sign(s) * Math.abs(s) ** .65 * radius * stretch * edge)
    })
    const shape = new T.Shape(points)
    const bandHeight = Math.min(.018, height / 4)
    for (const [depth, offset, target] of [[bandHeight, 0, bands], [height - bandHeight, bandHeight, surfaces]] as const) {
      const slab = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 })
      slab.rotateX(-Math.PI / 2).rotateY(.2).translate(x, y + offset, z)
      target.push(slab)
    }
  }
  function ridge(x: number, z: number, scale: number, rotation: number) {
    const outline = [[-1.8, -.5], [-1.2, -.9], [-.3, -.7], [.6, -.95], [1.8, -.5], [1.3, .1], [.5, .4], [-.2, .85], [-1.2, .5]]
    const shape = new T.Shape(outline.map(([px, py]) => new T.Vector2(px, py)))
    for (let i = 0; i < 9; i++) {
      const size = scale * (1 - i * .065)
      const slab = new T.ExtrudeGeometry(shape, { depth: .11, bevelEnabled: false, steps: 1 })
      slab.rotateX(-Math.PI / 2).scale(size, 1, size).rotateY(rotation).translate(x + i * .045, i * .13, z)
      const pieces = i % 3 === 0 ? bands : surfaces
      pieces.push(slab)
    }
  }
  function mesa(x: number, z: number, radius: number, height: number, stretch = 1) {
    for (let i = 0; i < height; i++) layer(radius * (1 - i * .055), .1, x, i * .115, z, i, stretch)
  }
  function ring(radius: number, y: number, thickness = .1) {
    const geometry = new T.TorusGeometry(radius, thickness, 5, 32)
    geometry.rotateX(Math.PI / 2).translate(0, y, 0)
    surfaces.push(geometry)
  }
  switch (kind) {
    case 'hagga':
      for (let i = 0; i < 18; i++) {
        const radius = i < 12 ? 1.12 * Math.exp(-i * .13) + .13 : .3 + (i - 12) * .075
        haggaLayer(radius, .125, -.35, i * .125, 0, i, .82)
      }
      for (let i = 0; i < 3; i++) haggaLayer(.73, .12, -.35, 2.25 + i * .12, 0, i + 18, .78)
      for (let pillar = 0; pillar < 3; pillar++) {
        const x = .7 + pillar * .42, z = .2 - pillar * .45
        const height = 5 + pillar * 2
        for (let i = 0; i < height; i++) haggaLayer(.2 - i * .006, .12, x, i * .12, z, i)
        haggaLayer(.29, .15, x, height * .12, z, height)
      }
      break
    case 'deep-desert':
      ridge(-.2, -.1, 1.05, -.5)
      ridge(.7, 1, .47, -.5)
      break
    case 'arrakeen':
      for (let i = 0; i < 5; i++) layer(1.6 - i * .1, .1, 0, i * .1, 0, i, .82)
      block(1.6, .35, 1.2, 0, .5, 0)
      block(1.1, .35, .85, 0, .85, 0)
      block(.65, .4, .55, -.12, 1.2, -.08)
      for (const x of [-.95, .95]) for (const z of [-.65, .65]) block(.35, .55, .35, x, .5, z)
      for (let i = 0; i < 5; i++) block(.25, .2 + (i % 2) * .14, .25, -.8 + i * .4, .5, 1)
      break
    case 'harko':
      mesa(0, 0, 1.15, 6, .85)
      surfaces.push(new T.CylinderGeometry(.22, .44, 2.15, 4).rotateY(Math.PI / 4).translate(0, 1.7, 0))
      break
    case 'hephaestus':
      for (const side of [-1, 1]) {
        const hull = new T.BoxGeometry(1.5, .65, 1.05)
        hull.rotateZ(side * .12).rotateY(side * .17).translate(side * 1.05, .4, 0)
        surfaces.push(hull)
        for (let i = 0; i < 3; i++) block(.3, .12, .2, side * (.2 + i * .17), .25 + i * .09, -.3 + i * .3)
      }
      break
    case 'fallen-light':
      mesa(0, 0, 1.5, 4, .75)
      for (let i = 0; i < 7; i++) {
        const rib = new T.TorusGeometry(.7, .085, 5, 16, Math.PI * 1.7)
        rib.rotateY(Math.PI / 2).translate(-1.2 + i * .4, .8, 0)
        surfaces.push(rib)
      }
      block(2.9, .16, .75, 0, .38, 0)
      break
    case 'tyche':
      mesa(0, 0, 1.45, 4, .7)
      block(2.5, .28, .65, 0, .45, 0)
      block(1.3, .4, .42, .2, .73, 0)
      break
    case 'carthag':
      for (let i = 0; i < 12; i++) {
        const angle = i * Math.PI * 2 / 12
        const height = .6 + (i % 4) * .28
        const spire = new T.CylinderGeometry(.08, .22, height, 4)
        spire.translate(Math.cos(angle) * 1.4, height / 2, Math.sin(angle) * 1.4)
        surfaces.push(spire)
      }
      ring(.7, .08, .04)
      ring(1.1, .05, .035)
      break
    case 'quarry':
      for (let i = 0; i < 7; i++) ring(.4 + i * .17, i * .12, .12)
      for (let i = 0; i < 5; i++) {
        const angle = i * Math.PI * 2 / 5
        mesa(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, .36, 5)
      }
      break
    case 'broodworks':
    case 'arsunt':
      mesa(0, 0, 1.5, kind === 'broodworks' ? 10 : 6, .8)
      block(1.5, .22, 1.2, 0, kind === 'broodworks' ? 1.15 : .7, 0)
      for (const x of [-.6, .6]) for (const z of [-.45, .45]) block(.25, .35, .25, x, kind === 'broodworks' ? 1.35 : .92, z)
      break
    case 'cavern':
    case 'smugglers-run':
    case 'tsimpo':
      mesa(0, 0, 1.5, 4)
      for (let i = 0; i < 5; i++) {
        const angle = i * 2.4
        mesa(Math.cos(angle) * .9, Math.sin(angle) * .9, .48, 7 + i % 3 * 3)
      }
      if (kind === 'cavern') {
        accentColor = 0xe290bb
        for (let i = 0; i < 7; i++) accents.push(new T.OctahedronGeometry(.18).scale(.6, 1.5, .6).translate(Math.cos(i) * 1.4, .65, Math.sin(i) * 1.4))
      }
      if (kind === 'tsimpo') for (let i = 0; i < 4; i++) block(.3, .25, .3, -.6 + i * .4, .48, .15)
      break
    case 'wind-pass':
      mesa(-.9, 0, .75, 9, 1.7)
      mesa(.9, 0, .75, 9, 1.7)
      block(.7, .12, .4, 0, .9, -.3)
      for (const x of [-.9, .9]) block(.45, .3, .5, x, 1.04, .35)
      break
    case 'station24':
    case 'station89':
    case 'station136':
    case 'station152':
    case 'station195':
      for (let i = 0; i < 8; i++) {
        const entrance = new T.TorusGeometry(1.2 - i * .065, .14, 5, 24, Math.PI * 1.7)
        entrance.rotateX(Math.PI / 2).rotateY(.45).translate(0, .12 + i * .13, 0)
        surfaces.push(entrance)
      }
      block(.4, .6, .4, -.5, .15, .4)
      block(.4, .6, .4, .5, .15, .4)
      block(1.3, .2, .45, 0, .75, .4)
      accentColor = kind === 'station89' ? 0x96dcbc : kind === 'station136' ? 0xf0ae67 : kind === 'station152' ? 0x80c6f0 : 0xa5bc79
      if (kind !== 'station24') accents.push(new T.OctahedronGeometry(.19).scale(.6, 1.7, .6).translate(0, .45, .65))
      break
    case 'overland':
      throw new Error('Overmap is the containing world surface, not a location marker')
    case 'dungeon':
      block(2, .25, 1.5, 0, 0, 0)
      block(.5, 1.4, .75, -.7, .25, 0)
      block(.5, 1.4, .75, .7, .25, 0)
      block(1.9, .35, .8, 0, 1.65, 0)
      break
    case 'story':
      surfaces.push(new T.OctahedronGeometry(.85).scale(.7, 1.4, .7).translate(0, 1.3, 0))
      layer(1.3, .18, 0, 0, 0, 0)
      break
    case 'unknown':
      surfaces.push(new T.OctahedronGeometry(.7).translate(0, .85, 0))
      break
  }
  const group = new T.Group()
  for (const [pieces, material] of [[surfaces, stone], [bands, strata]] as const) {
    if (!pieces.length) continue
    const normalized = pieces.map(piece => piece.index ? piece.toNonIndexed() : piece)
    const geometry = mergeGeometries(normalized)
    new Set([...pieces, ...normalized]).forEach(piece => piece.dispose())
    if (!geometry) throw new Error(`Could not assemble ${kind} location marker`)
    group.add(new T.Mesh(geometry, material))
  }
  if (accents.length) {
    const geometry = mergeGeometries(accents)
    accents.forEach(piece => piece.dispose())
    if (!geometry) throw new Error(`Could not assemble ${kind} marker accents`)
    group.add(new T.Mesh(geometry, new T.MeshBasicMaterial({ color: accentColor })))
  }
  return group
}
