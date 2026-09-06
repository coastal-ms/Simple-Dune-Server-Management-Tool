import * as T from 'three'
import { globeSurfaceRadius } from './globeEmblems'

export const FLIGHT_COLOR = '#9edce5'
export const FLIGHT_TAIL_FRACTION = .72
export const FLIGHT_TRAIL_RADIUS = .035
export const FLIGHT_DOT_RADIUS = .074

class TravelPath extends T.Curve<T.Vector3> {
  private across: T.Vector3
  private along: T.Vector3
  private radius: number
  constructor(radius: number, normal: T.Vector3) {
    super()
    this.radius = radius
    this.across = new T.Vector3().crossVectors(normal, new T.Vector3(0, 1, 0)).normalize()
    this.along = new T.Vector3().crossVectors(normal, this.across).normalize()
  }
  getPoint(t: number, target = new T.Vector3()) {
    target.copy(this.across).multiplyScalar(Math.cos(t * Math.PI * 2))
      .addScaledVector(this.along, Math.sin(t * Math.PI * 2)).normalize()
    return target.multiplyScalar(Math.max(this.radius, globeSurfaceRadius(target) + .14))
  }
}

export function createGlobeFlights(radius: number) {
  const group = new T.Group()
  group.userData.decoration = 'simulated-travel'
  group.visible = false
  const paths = [
    { normal: new T.Vector3(.35, .84, .42), speed: .023, phase: .14, height: .19 },
    { normal: new T.Vector3(-.73, .2, .65), speed: -.017, phase: .58, height: .23 },
    { normal: new T.Vector3(.66, -.68, .3), speed: .019, phase: .84, height: .16 },
  ].map(({ normal, speed, phase, height }) => {
    const curve = new TravelPath(radius + height, normal.normalize())
    const material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false, blending: T.NormalBlending,
      uniforms: { color: { value: new T.Color(FLIGHT_COLOR) }, head: { value: phase }, tail: { value: FLIGHT_TAIL_FRACTION }, direction: { value: Math.sign(speed) } },
      vertexShader: `
        varying float progress;
        void main() {
          progress = uv.x;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform float head;
        uniform float tail;
        uniform float direction;
        varying float progress;
        void main() {
          float behind = mod((head - progress) * direction + 1.0, 1.0);
          float fade = pow(max(0.0, 1.0 - behind / tail), 2.0);
          float core = 1.0 - smoothstep(0.0, 0.075, behind);
          gl_FragColor = vec4(color, fade * 0.35 + core * 0.45);
          #include <colorspace_fragment>
        }
      `,
    })
    const trail = new T.Mesh(new T.TubeGeometry(curve, 512, FLIGHT_TRAIL_RADIUS, 3, true), material)
    const dot = new T.Mesh(new T.SphereGeometry(FLIGHT_DOT_RADIUS, 8, 6), new T.MeshBasicMaterial({ color: FLIGHT_COLOR, toneMapped: false, depthWrite: false }))
    group.add(trail, dot)
    return { curve, material, dot, speed, phase }
  })
  return {
    group,
    color(value: string) {
      paths.forEach(path => {
        path.material.uniforms.color.value.set(value)
        path.dot.material.color.set(value)
      })
    },
    update(seconds: number, active: boolean) {
      group.visible = active
      if (!active) return
      paths.forEach(path => {
        const head = ((seconds * path.speed + path.phase) % 1 + 1) % 1
        path.material.uniforms.head.value = head
        path.dot.position.copy(path.curve.getPoint(head))
      })
    },
  }
}
