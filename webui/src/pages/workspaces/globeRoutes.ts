import * as T from 'three'
import { GlobeArc } from './arrakisGlobe'

export const ROUTE_CORE_RADIUS = .032
export const ROUTE_HEAD_SCALE = 1.3

export function globeSignalColor(value: string) {
  const color = new T.Color(value)
  const hsl = color.getHSL({ h: 0, s: 0, l: 0 }, T.SRGBColorSpace)
  color.setHSL(hsl.h, Math.max(.85, hsl.s), T.MathUtils.clamp(hsl.l, .42, .52), T.SRGBColorSpace)
  return `#${color.getHexString(T.SRGBColorSpace)}`
}

export function routeColor(readiness: string | undefined, ready: string, notReady: string, unknown: string) {
  return readiness === 'Ready' ? ready : readiness === 'Not ready' ? notReady : unknown
}

export function routeEndpointColors(source: string | undefined, destination: string | undefined, ready: string, notReady: string, unknown: string) {
  return {
    start: routeColor(source, ready, notReady, unknown),
    end: routeColor(destination, ready, notReady, unknown),
  }
}

export function createGlobeRoute(curve: GlobeArc, offset: number) {
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      startColor: { value: new T.Color('#9edce5') },
      endColor: { value: new T.Color('#9edce5') },
      head: { value: offset },
      moving: { value: 0 },
      headExpansion: { value: ROUTE_CORE_RADIUS * (ROUTE_HEAD_SCALE - 1) },
    },
    vertexShader: `
      varying vec2 routeUv;
      uniform float head;
      uniform float moving;
      uniform float headExpansion;
      void main() {
        routeUv = uv;
        float bulb = (1.0 - smoothstep(0.0, 0.022, abs(uv.x - head))) * moving;
        vec3 routePosition = position + normal * (headExpansion * bulb);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(routePosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 startColor;
      uniform vec3 endColor;
      uniform float head;
      uniform float moving;
      varying vec2 routeUv;
      void main() {
        float behind = mod(head - routeUv.x + 1.0, 1.0);
        float pulse = (1.0 - smoothstep(0.0, 0.23, behind)) * moving;
        vec3 readinessColor = mix(startColor, endColor, smoothstep(0.0, 1.0, routeUv.x));
        gl_FragColor = vec4(readinessColor * (0.6 + pulse * 0.7), 0.75 + pulse * 0.25);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const backing = new T.Mesh(new T.TubeGeometry(curve, 256, .05, 4, false),
    new T.MeshBasicMaterial({ color: '#151921', transparent: true, opacity: .72, depthWrite: false, toneMapped: false }))
  const mesh = new T.Mesh(new T.TubeGeometry(curve, 256, ROUTE_CORE_RADIUS, 4, false), material)
  backing.renderOrder = 1
  mesh.renderOrder = 2
  return {
    mesh,
    backing,
    material,
    offset,
    setCurve(next: GlobeArc) {
      mesh.geometry.dispose()
      backing.geometry.dispose()
      mesh.geometry = new T.TubeGeometry(next, 256, ROUTE_CORE_RADIUS, 4, false)
      backing.geometry = new T.TubeGeometry(next, 256, .05, 4, false)
    },
  }
}
