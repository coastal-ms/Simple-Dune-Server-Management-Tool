import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import SpatialFrame from '../src/layout/SpatialFrame'
import { ThemeProvider } from '../src/theme/ThemeContext'

const controls = vi.hoisted(() => ({ owner: true, dashboard: vi.fn(), classic: vi.fn() }))
vi.mock('../src/hooks/useStatus', () => ({ useStatus: () => ({ status: null, loading: false, error: null }) }))
vi.mock('../src/auth/portalAccess', () => ({ usePortalAccess: () => ({ canAccessOwnerSurfaces: controls.owner }) }))
vi.mock('../src/util/viewer', () => ({ isLocalViewer: () => true, isWindowsViewer: () => true }))
vi.mock('../src/hooks/useCommandDeck', () => ({ setCommandDeck: controls.classic }))

const geometry = { rootTop: 32, rootHeight: 868, width: 1440, frameInset: 0, borderTop: 0 }
let frames: Map<number, FrameRequestCallback>
let viewport: EventTarget & { offsetTop: number; offsetLeft: number; height: number; width: number }
type Observer = {
  callback: ResizeObserverCallback
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}
let observers: Observer[]

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) }
}

function flush() {
  act(() => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(0))
  })
}

function view(dashboard = true, tools = false, priorMarker?: string) {
  return <ThemeProvider>
    <main data-app-scroll-container data-spatial-dashboard={priorMarker}>
      <div className="w-full min-w-0">
        <SpatialFrame dashboard={dashboard} tools={tools} onDetails={controls.dashboard}>
          <section data-testid="dashboard-content"><button>Inspect map</button></section>
        </SpatialFrame>
      </div>
    </main>
  </ThemeProvider>
}

function elements() {
  const root = screen.getByRole('main')
  const frame = root.querySelector<HTMLElement>('.spatial-workspace')!
  const dock = screen.getByRole('navigation', { name: 'Workspace dock' })
  return { root, frame, dock, anchor: dock.parentElement! }
}

beforeEach(() => {
  controls.owner = true
  vi.clearAllMocks()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  Object.assign(geometry, { rootTop: 32, rootHeight: 868, width: 1440, frameInset: 0, borderTop: 0 })
  frames = new Map()
  observers = []
  let nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('innerWidth', 1440)
  viewport = Object.assign(new EventTarget(), { offsetTop: 0, offsetLeft: 0, height: 900, width: 1440 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      observers.push({ callback, observe: this.observe, unobserve: this.unobserve, disconnect: this.disconnect })
    }
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.hasAttribute('data-app-scroll-container')) return rect(0, geometry.rootTop, geometry.width, geometry.rootHeight + geometry.borderTop)
    if (this.classList.contains('spatial-workspace')) {
      const offset = Number.parseFloat(this.style.getPropertyValue('--spatial-dashboard-offset')) || 0
      const height = Number.parseFloat(this.style.getPropertyValue('--spatial-dashboard-height')) || 1200
      return rect(0, geometry.rootTop + geometry.borderTop + geometry.frameInset + offset, geometry.width, height)
    }
    if (this.classList.contains('spatial-dock') || this.classList.contains('spatial-dock-slot')) return rect(200, 1600, 600, 78)
    return rect(0, 0, 0, 0)
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
    return this.hasAttribute('data-app-scroll-container') ? geometry.rootHeight : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.hasAttribute('data-app-scroll-container') ? geometry.width : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientTop', 'get').mockImplementation(function () {
    return this.hasAttribute('data-app-scroll-container') ? geometry.borderTop : 0
  })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () {
    if (this.hasAttribute('open')) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('Bounded dashboard frame', () => {
  it.each([
    { width: 1440, height: 900, rootTop: 32 },
    { width: 1366, height: 768, rootTop: 72 },
    { width: 1000, height: 700, rootTop: 32 },
    { width: 390, height: 844, rootTop: 91 },
  ])('fits the actual scrollport below menu/banner at $width x $height', ({ width, height, rootTop }) => {
    Object.assign(geometry, { width, rootTop, rootHeight: height - rootTop })
    Object.assign(viewport, { width, height })
    vi.stubGlobal('innerHeight', height)
    vi.stubGlobal('innerWidth', width)
    render(view())
    const { root, frame, anchor, dock } = elements()
    expect(frame).toHaveClass('spatial-dashboard-frame')
    expect(frame.style.getPropertyValue('--spatial-dashboard-height')).toBe(`${height - rootTop}px`)
    expect(frame.getBoundingClientRect().bottom).toBe(height)
    expect(frame.hasAttribute('data-dashboard-compact')).toBe(height - rootTop < 700)
    expect(root).toHaveAttribute('data-spatial-dashboard')
    expect(root).not.toHaveAttribute('data-spatial-dock')
    expect(anchor).not.toHaveAttribute('data-floating')
    expect(observers).toHaveLength(1)
    expect(observers[0].observe).toHaveBeenCalledWith(root)
    expect(observers[0].observe).not.toHaveBeenCalledWith(dock)
  })

  it('provides a bounded content wrapper and a single separate normal-flow dock, without duplicate footer status', () => {
    render(view())
    const { frame, dock, anchor } = elements()
    const body = frame.querySelector('.spatial-dashboard-body')!
    expect(body).toContainElement(screen.getByTestId('dashboard-content'))
    expect(body).not.toContainElement(dock)
    expect(body.nextElementSibling).toBe(anchor.parentElement)
    expect(anchor.parentElement?.tagName).toBe('FOOTER')
    expect(frame.querySelector('.spatial-infrastructure')).toBeNull()
    expect(frame.querySelector('.spatial-system-label')).toBeNull()
    expect(screen.getAllByRole('navigation', { name: 'Workspace dock' })).toHaveLength(1)
    fireEvent.scroll(elements().root)
    flush()
    expect(anchor).not.toHaveAttribute('data-floating')
    expect(elements().root.style.getPropertyValue('--spatial-dock-clearance')).toBe('')
  })

  it('retains palette, finder, dashboard, classic controls, and access filtering', () => {
    controls.owner = false
    render(view())
    expect(screen.getByRole('combobox', { name: 'Workspace palette' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    expect(controls.dashboard).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }))
    expect(controls.classic).toHaveBeenCalledWith(false)
    const { dock } = elements()
    expect(within(dock).queryByRole('link', { name: 'Database' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Find a tool' }))
    expect(screen.getByRole('dialog', { name: 'Find your next move.' })).toBeVisible()
  })

  it('tracks banner/layout resize and visual-viewport keyboard/panning without accumulating offsets', () => {
    render(view())
    const { frame, root } = elements()
    Object.assign(geometry, { rootTop: 84, rootHeight: 816 })
    act(() => observers[0].callback([], observers[0] as unknown as ResizeObserver))
    flush()
    expect(frame.style.getPropertyValue('--spatial-dashboard-height')).toBe('816px')
    Object.assign(viewport, { offsetTop: 140, height: 500 })
    fireEvent(viewport, new Event('resize'))
    flush()
    expect(frame.style.getPropertyValue('--spatial-dashboard-offset')).toBe('56px')
    expect(frame.style.getPropertyValue('--spatial-dashboard-height')).toBe('500px')
    expect(frame.getBoundingClientRect().top).toBe(140)
    expect(frame.getBoundingClientRect().bottom).toBe(640)
    for (let index = 0; index < 3; index++) {
      fireEvent(viewport, new Event('scroll'))
      flush()
      expect(frame.style.getPropertyValue('--spatial-dashboard-offset')).toBe('56px')
      expect(frames.size).toBe(0)
    }
    Object.assign(viewport, { offsetTop: 0, height: 900 })
    fireEvent(viewport, new Event('resize'))
    flush()
    expect(frame.style.getPropertyValue('--spatial-dashboard-offset')).toBe('0px')
    expect(frame.getBoundingClientRect().height).toBe(root.clientHeight)
  })

  it('subtracts an inner-wrapper offset and root border instead of assuming an auto-height wrapper fills the viewport', () => {
    Object.assign(geometry, { borderTop: 2, rootHeight: 866, frameInset: 16 })
    render(view())
    const { frame } = elements()
    expect(frame.getBoundingClientRect().top).toBe(50)
    expect(frame.getBoundingClientRect().height).toBe(850)
    expect(frame.getBoundingClientRect().bottom).toBe(900)
  })

  it('disables/re-enables floating cleanly without replacing the dock or changing ordinary tool-page structure', () => {
    const rendered = render(view(false, true))
    const { dock, anchor, root, frame } = elements()
    expect(anchor).toHaveAttribute('data-floating')
    expect(frame).toHaveClass('spatial-tool-workspace')
    expect(frame.querySelector('.spatial-tool-content')).not.toBeNull()
    expect(frame.querySelector('.spatial-infrastructure')).not.toBeNull()
    root.scrollTop = 120
    rendered.rerender(view(true, true))
    expect(root.scrollTop).toBe(0)
    expect(elements().dock).toBe(dock)
    expect(anchor).not.toHaveAttribute('data-floating')
    expect(root).not.toHaveAttribute('data-spatial-dock')
    expect(frame.querySelector('.spatial-tool-content')).toBeNull()
    expect(frame.querySelector('.spatial-dashboard-body')).not.toBeNull()
    rendered.rerender(view(false, true))
    expect(elements().dock).toBe(dock)
    expect(anchor).toHaveAttribute('data-floating')
    expect(frame).toHaveClass('spatial-tool-workspace')
    expect(frame).not.toHaveClass('spatial-dashboard-frame')
    expect(root).not.toHaveAttribute('data-spatial-dashboard')
    expect(frame.style.getPropertyValue('--spatial-dashboard-height')).toBe('')
  })

  it('falls back to window resize without optional viewport/resize-observer APIs', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    vi.stubGlobal('visualViewport', undefined)
    render(view())
    geometry.rootHeight = 700
    fireEvent.resize(window)
    flush()
    expect(elements().frame.style.getPropertyValue('--spatial-dashboard-height')).toBe('700px')
  })

  it('cleans up scoped scroll-root state, sizing, listeners, observers, and scheduled updates', () => {
    const rendered = render(view(true, false, 'previous'))
    const { frame, root } = elements()
    const removeViewport = vi.spyOn(viewport, 'removeEventListener')
    fireEvent.resize(window)
    expect(frames.size).toBe(1)
    rendered.unmount()
    expect(frames.size).toBe(0)
    expect(observers[0].disconnect).toHaveBeenCalledOnce()
    expect(removeViewport).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(removeViewport).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(root).toHaveAttribute('data-spatial-dashboard', 'previous')
    expect(frame.style.getPropertyValue('--spatial-dashboard-height')).toBe('')
    expect(frame.style.getPropertyValue('--spatial-dashboard-offset')).toBe('')
  })

  it('reserves grid rows and safe-area padding only for dashboard frames, not viewport-height guesses', () => {
    const css = readFileSync(resolve('src', 'layout', 'dashboardFrame.css'), 'utf8')
    expect(css).toContain('[data-app-scroll-container][data-spatial-dashboard]')
    expect(css).toContain('overflow: clip')
    expect(css).toContain('grid-template-rows: auto minmax(0, 1fr)')
    expect(css).toContain('grid-template-rows: minmax(0, 1fr) auto')
    expect(css).toContain('.spatial-dashboard-body')
    expect(css).toContain('min-height: 0')
    expect(css).toContain('position: static')
    expect(css).toContain('max(8px, env(safe-area-inset-bottom))')
    expect(css).toContain('env(safe-area-inset-left)')
    expect(css).toContain('env(safe-area-inset-right)')
    expect(css).not.toContain('100vh')
  })
})
