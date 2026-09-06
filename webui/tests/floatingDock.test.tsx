import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import SpatialFrame from '../src/layout/SpatialFrame'
import { ThemeProvider } from '../src/theme/ThemeContext'

const access = vi.hoisted(() => ({ owner: true, local: true, windows: true }))
vi.mock('../src/hooks/useStatus', () => ({ useStatus: () => ({ status: null, loading: false, error: null }) }))
vi.mock('../src/auth/portalAccess', () => ({ usePortalAccess: () => ({ canAccessOwnerSurfaces: access.owner }) }))
vi.mock('../src/util/viewer', () => ({ isLocalViewer: () => access.local, isWindowsViewer: () => access.windows }))

const geometry = { left: 80, top: 56, width: 1000, height: 664, slotLeft: 260, slotTop: 900, dockWidth: 600, dockHeight: 80 }
const stageGeometry = { left: 700, top: 680, width: 350, height: 68, stageTop: 180, stageHeight: 760 }
const dockLayouts = [
  { name: 'desktop inset workspace', viewportWidth: 1600, left: 40, width: 1500, slotLeft: 420, dockWidth: 660, dockHeight: 80, gap: 12 },
  { name: 'tablet with hidden right label', viewportWidth: 1024, left: 0, width: 1014, slotLeft: 237, dockWidth: 540, dockHeight: 80, gap: 12 },
  { name: 'mobile portrait', viewportWidth: 390, left: 0, width: 390, slotLeft: 12, dockWidth: 366, dockHeight: 92, gap: 34 },
  { name: 'mobile asymmetric safe area', viewportWidth: 740, left: 0, width: 730, slotLeft: 56, dockWidth: 662, dockHeight: 92, gap: 34 },
]
let resize: ResizeObserverCallback
let observer: { observe: ReturnType<typeof vi.fn>; unobserve: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }
let frames: Map<number, FrameRequestCallback>
let viewport: EventTarget & { offsetLeft: number; offsetTop: number; width: number; height: number }

function rect(x: number, y: number, width: number, height: number): DOMRect {
  return { x, y, left: x, top: y, right: x + width, bottom: y + height, width, height, toJSON: () => ({}) }
}

function horizontalBounds(bounds: DOMRect) {
  return { left: bounds.left, right: bounds.right, width: bounds.width, center: bounds.left + bounds.width / 2 }
}

function applyLayout(layout: typeof dockLayouts[number]) {
  const { left, width, slotLeft, dockWidth, dockHeight } = layout
  Object.assign(geometry, { left, width, slotLeft, dockWidth, dockHeight })
  vi.stubGlobal('innerWidth', layout.viewportWidth)
  viewport.width = layout.viewportWidth
}

function flush() {
  act(() => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(0))
  })
}

function resizeLayout() {
  act(() => resize([], observer as unknown as ResizeObserver))
  flush()
}

function mount(tools = true, restoreState = false, stageControls = false) {
  return render(
    <ThemeProvider>
      <main data-app-scroll-container data-spatial-dock={restoreState ? 'existing' : undefined}
        style={restoreState ? { '--spatial-dock-clearance': '7px' } as CSSProperties : undefined}>
        <SpatialFrame tools={tools}>
          <button className="sticky bottom-0">Apply settings</button>
          {stageControls && <div className="spatial-stage">
            <canvas data-testid="stage-canvas" />
            <div className="spatial-stage-controls"
              style={restoreState ? { '--spatial-stage-dock-shift': '-3px' } as CSSProperties : undefined}>
              <button>Reset view</button>
            </div>
          </div>}
        </SpatialFrame>
      </main>
    </ThemeProvider>,
  )
}

function elements() {
  const dock = screen.getByRole('navigation', { name: 'Workspace dock' })
  return { dock, anchor: dock.parentElement!, root: screen.getByRole('main') }
}

beforeEach(() => {
  Object.assign(geometry, { left: 80, top: 56, width: 1000, height: 664, slotLeft: 260, slotTop: 900, dockWidth: 600, dockHeight: 80 })
  Object.assign(stageGeometry, { left: 700, top: 680, width: 350, height: 68, stageTop: 180, stageHeight: 760 })
  Object.assign(access, { owner: true, local: true, windows: true })
  localStorage.clear()
  window.history.replaceState({}, '', '/')
  frames = new Map()
  let nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal('innerHeight', 900)
  vi.stubGlobal('innerWidth', 1200)
  viewport = Object.assign(new EventTarget(), { offsetLeft: 0, offsetTop: 0, width: 1200, height: 900 })
  vi.stubGlobal('visualViewport', viewport)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {
      resize = callback
      observer = { observe: this.observe, unobserve: this.unobserve, disconnect: this.disconnect }
    }
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    if (this.hasAttribute('data-app-scroll-container')) return rect(geometry.left, geometry.top, geometry.width, geometry.height)
    if (this.classList.contains('spatial-dock') && this.parentElement?.hasAttribute('data-floating')) {
      const width = Number.parseFloat(this.style.getPropertyValue('--spatial-dock-anchor-width'))
      const height = Number.parseFloat(this.parentElement.style.getPropertyValue('--spatial-dock-height'))
      const center = Number.parseFloat(this.style.getPropertyValue('--spatial-dock-center'))
      const offset = Number.parseFloat(this.style.getPropertyValue('--spatial-dock-viewport-offset'))
      const gap = Number.parseFloat(this.parentElement.style.scrollMarginBottom) || 12
      return rect(center - width / 2, window.innerHeight - offset - gap - height, width, height)
    }
    if (this.classList.contains('spatial-dock') || this.classList.contains('spatial-dock-slot')) {
      return rect(geometry.slotLeft, geometry.slotTop, geometry.dockWidth, geometry.dockHeight)
    }
    if (this.classList.contains('spatial-stage')) return rect(100, stageGeometry.stageTop, 960, stageGeometry.stageHeight)
    if (this.classList.contains('spatial-stage-controls')) {
      const shift = Number.parseFloat(this.style.getPropertyValue('--spatial-stage-dock-shift')) || 0
      return rect(stageGeometry.left, stageGeometry.top + shift, stageGeometry.width, stageGeometry.height)
    }
    return rect(0, 0, 0, 0)
  })
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () {
    return this.hasAttribute('data-app-scroll-container') ? geometry.width : 0
  })
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () {
    return this.hasAttribute('data-app-scroll-container') ? geometry.height : 0
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

describe('Single floating workspace dock', () => {
  it.each([false, true])('links directly to Solo Mode from the dock (tools=%s)', tools => {
    mount(tools)
    const solo = within(elements().dock).getByRole('link', { name: 'Solo Mode' })
    expect(solo).toHaveAttribute('href', '/solo')
    expect(solo.querySelector('svg')).not.toBeNull()
    fireEvent.click(solo)
    expect(window.location.pathname).toBe('/solo')
    expect(solo).toHaveAttribute('aria-current', 'page')
  })

  it.each([
    { local: false, windows: true },
    { local: true, windows: false },
  ])('keeps Solo Mode hidden for unsupported viewers: %j', viewer => {
    Object.assign(access, viewer)
    mount()
    expect(within(elements().dock).queryByRole('link', { name: 'Solo Mode' })).not.toBeInTheDocument()
  })

  it('reserves the dock for compact inner portal routes instead of covering task content', () => {
    window.history.replaceState({}, '', '/players')
    mount()
    const { dock, anchor, root } = elements()
    expect(anchor).not.toHaveAttribute('data-floating')
    const portal = root.querySelector('.spatial-tool-portal')
    expect(portal).not.toBeNull()
    expect(portal?.querySelector('.spatial-tool-scroll')).toHaveAttribute('data-app-scroll-container')
    expect(portal?.querySelector('.spatial-tool-scroll')?.contains(dock)).toBe(false)
    expect(screen.getAllByRole('navigation', { name: 'Workspace dock' })).toHaveLength(1)
  })
  it.each([false, true])('floats beyond the actual app scrollport, preserving the footer slot (tools=%s)', tools => {
    mount(tools)
    const { dock, anchor, root } = elements()
    expect(anchor).toHaveAttribute('data-floating')
    expect(anchor.style.getPropertyValue('--spatial-dock-width')).toBe('600px')
    expect(anchor.style.getPropertyValue('--spatial-dock-height')).toBe('80px')
    expect(dock.style.getPropertyValue('--spatial-dock-center')).toBe('560px')
    expect(dock.style.getPropertyValue('--spatial-dock-viewport-offset')).toBe('180px')
    expect(root.style.getPropertyValue('--spatial-dock-clearance')).toBe('104px')
    expect(screen.getAllByRole('navigation', { name: 'Workspace dock' })).toHaveLength(1)
    expect(observer.observe).toHaveBeenCalledWith(root)
    expect(observer.observe).toHaveBeenCalledWith(dock)
    expect(within(dock).queryByRole('link', { name: 'World' }) !== null).toBe(tools)
  })

  it('returns the same focused nav to its footer and floats it again on app-container scroll', () => {
    mount()
    const { dock, anchor, root } = elements()
    const allTools = within(dock).getByRole('button', { name: 'All tools' })
    allTools.focus()
    geometry.slotTop = 620
    fireEvent.scroll(root)
    flush()
    expect(anchor).not.toHaveAttribute('data-floating')
    expect(root.style.getPropertyValue('--spatial-dock-clearance')).toBe('0px')
    expect(document.activeElement).toBe(allTools)
    geometry.slotTop = 900
    fireEvent.scroll(root)
    flush()
    expect(anchor).toHaveAttribute('data-floating')
    expect(elements().dock).toBe(dock)
    expect(document.activeElement).toBe(allTools)
    expect(within(dock).getByRole('link', { name: 'World' })).toHaveAttribute('aria-current', 'page')
    fireEvent.click(allTools)
    expect(screen.getByRole('dialog', { name: 'Find your next move.' })).toBeVisible()
  })

  it.each(dockLayouts)('preserves the anchor rectangle across both threshold directions: $name', layout => {
    applyLayout(layout)
    const threshold = geometry.top + geometry.height - layout.gap - layout.dockHeight
    geometry.slotTop = threshold - 0.25
    mount()
    const { dock, anchor, root } = elements()
    anchor.style.scrollMarginBottom = `${layout.gap}px`
    resizeLayout()
    expect(anchor).not.toHaveAttribute('data-floating')
    const natural = dock.getBoundingClientRect()
    expect(natural.left).toBe(layout.slotLeft)
    expect(natural.width).toBe(layout.dockWidth)

    for (const slotTop of [threshold + 0.25, threshold - 0.25, threshold + 0.25, threshold - 0.25]) {
      geometry.slotTop = slotTop
      fireEvent.scroll(root)
      flush()
      const current = dock.getBoundingClientRect()
      expect(horizontalBounds(current)).toEqual(horizontalBounds(natural))
      expect(current.height).toBe(natural.height)
      expect(anchor.style.getPropertyValue('--spatial-dock-height')).toBe(`${natural.height}px`)
      expect(anchor.getBoundingClientRect().height).toBe(natural.height)
      if (slotTop > threshold) {
        expect(anchor).toHaveAttribute('data-floating')
        expect(current.bottom).toBe(geometry.top + geometry.height - layout.gap)
      } else {
        expect(anchor).not.toHaveAttribute('data-floating')
        expect(current.top).toBe(slotTop)
      }
      expect(elements().dock).toBe(dock)
      expect(frames.size).toBe(0)
    }
  })

  it('remeasures anchor bounds while floating across desktop, tablet, mobile, and back without drift', () => {
    mount()
    const { dock, anchor } = elements()
    for (const layout of [...dockLayouts, dockLayouts[0]]) {
      applyLayout(layout)
      anchor.style.scrollMarginBottom = `${layout.gap}px`
      fireEvent.resize(window)
      flush()
      expect(anchor).toHaveAttribute('data-floating')
      const resized = dock.getBoundingClientRect()
      expect(horizontalBounds(resized)).toEqual(horizontalBounds(anchor.getBoundingClientRect()))
      expect(resized.width).toBe(layout.dockWidth)
      expect(resized.height).toBe(layout.dockHeight)
      expect(resized.bottom).toBe(geometry.top + geometry.height - layout.gap)
      expect(anchor.style.getPropertyValue('--spatial-dock-height')).toBe(`${layout.dockHeight}px`)
      resizeLayout()
      expect(dock.getBoundingClientRect()).toMatchObject({
        left: resized.left, right: resized.right, width: resized.width,
        top: resized.top, bottom: resized.bottom, height: resized.height,
      })
      expect(frames.size).toBe(0)
    }
  })

  it('keeps a fully visible footer natural, but floats a partially clipped or above-screen footer', () => {
    geometry.slotTop = 620
    mount()
    const { anchor, root } = elements()
    expect(anchor).not.toHaveAttribute('data-floating')
    geometry.slotTop = 670
    fireEvent.scroll(root)
    flush()
    expect(anchor).toHaveAttribute('data-floating')
    geometry.slotTop = 20
    fireEvent.scroll(root)
    flush()
    expect(anchor).toHaveAttribute('data-floating')
  })

  it('remeasures responsive dock dimensions and honors the visual viewport and bottom safe area', () => {
    mount()
    const { anchor, dock, root } = elements()
    Object.assign(geometry, { left: 0, width: 390, slotLeft: 12, dockWidth: 366, dockHeight: 92 })
    Object.assign(viewport, { width: 390, height: 450, offsetTop: 10 })
    anchor.style.scrollMarginBottom = '34px'
    resizeLayout()
    expect(anchor.style.getPropertyValue('--spatial-dock-width')).toBe('366px')
    expect(anchor.style.getPropertyValue('--spatial-dock-height')).toBe('92px')
    expect(dock.style.getPropertyValue('--spatial-dock-center')).toBe('195px')
    expect(dock.style.getPropertyValue('--spatial-dock-viewport-offset')).toBe('440px')
    expect(dock.style.getPropertyValue('--spatial-dock-anchor-width')).toBe('366px')
    expect(root.style.getPropertyValue('--spatial-dock-clearance')).toBe('138px')
    viewport.height = 500
    fireEvent(viewport, new Event('scroll'))
    flush()
    expect(dock.style.getPropertyValue('--spatial-dock-viewport-offset')).toBe('390px')
  })

  it('does not depend on ResizeObserver for scrolling or window resizing', () => {
    vi.stubGlobal('ResizeObserver', undefined)
    vi.stubGlobal('visualViewport', undefined)
    mount()
    const { anchor, root } = elements()
    geometry.slotTop = 620
    fireEvent.scroll(root)
    flush()
    expect(anchor).not.toHaveAttribute('data-floating')
    geometry.slotTop = 900
    fireEvent.resize(window)
    flush()
    expect(anchor).toHaveAttribute('data-floating')
  })

  it('preserves restricted-viewer destinations in the floating dock and finder', () => {
    Object.assign(access, { owner: false, local: false, windows: false })
    mount()
    const { dock, anchor } = elements()
    expect(anchor).toHaveAttribute('data-floating')
    expect(within(dock).queryByRole('link', { name: 'Database' })).not.toBeInTheDocument()
    expect(within(dock).getByRole('link', { name: 'Players' })).toHaveAttribute('href', '/players')
    fireEvent.click(within(dock).getByRole('button', { name: 'All tools' }))
    expect(screen.queryByRole('link', { name: /Manage backups, restores/ })).not.toBeInTheDocument()
  })

  it('cleans up observers, scheduled work, listeners, and scroll-root state on unmount', () => {
    const view = mount(true, true)
    const { root } = elements()
    const removeScroll = vi.spyOn(root, 'removeEventListener')
    const removeViewport = vi.spyOn(viewport, 'removeEventListener')
    fireEvent.scroll(root)
    expect(frames.size).toBe(1)
    view.unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
    expect(removeScroll).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeViewport).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(removeViewport).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(frames.size).toBe(0)
    expect(root).toHaveAttribute('data-spatial-dock', 'existing')
    expect(root.style.getPropertyValue('--spatial-dock-clearance')).toBe('7px')
  })

  it('lifts intersecting stage controls just above the dock without cumulative shifts or canvas changes', () => {
    mount(false, false, true)
    const { dock, root } = elements()
    const control = screen.getByRole('button', { name: 'Reset view' }).parentElement!
    const canvas = screen.getByTestId('stage-canvas')
    const stage = control.parentElement!
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-128px')
    expect(control.getBoundingClientRect().bottom).toBe(dock.getBoundingClientRect().top - 8)
    expect(control.getBoundingClientRect().top).toBeGreaterThan(stage.getBoundingClientRect().top)
    for (let index = 0; index < 3; index++) {
      fireEvent.scroll(root)
      resizeLayout()
      expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-128px')
      expect(frames.size).toBe(0)
    }
    expect(canvas).not.toHaveAttribute('style')
    expect(stage).not.toHaveAttribute('style')
    expect(screen.getAllByRole('navigation', { name: 'Workspace dock' })).toHaveLength(1)
  })

  it('clears stage-control shifts when natural rectangles no longer intersect or the dock returns inline', () => {
    mount(false, false, true)
    const { root, anchor } = elements()
    const control = screen.getByRole('button', { name: 'Reset view' }).parentElement!
    stageGeometry.left = 900
    fireEvent.scroll(root)
    flush()
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('')
    stageGeometry.left = 700
    stageGeometry.top = 720
    fireEvent.scroll(root)
    flush()
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('')
    stageGeometry.top = 680
    fireEvent.scroll(root)
    flush()
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-128px')
    geometry.slotTop = 620
    fireEvent.scroll(root)
    flush()
    expect(anchor).not.toHaveAttribute('data-floating')
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('')
  })

  it('bounds clearance at the stage edge when there is insufficient space above the dock', () => {
    stageGeometry.stageTop = 610
    mount(false, false, true)
    const control = screen.getByRole('button', { name: 'Reset view' }).parentElement!
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-62px')
    expect(control.getBoundingClientRect().top).toBe(stageGeometry.stageTop + 8)
  })

  it('clears newly mounted absolute controls and restores their original property on removal and cleanup', async () => {
    const view = mount(false, true, true)
    const originalControl = screen.getByRole('button', { name: 'Reset view' }).parentElement!
    expect(originalControl.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-128px')
    const stage = document.createElement('div')
    stage.className = 'spatial-stage'
    const control = document.createElement('div')
    control.className = 'spatial-stage-controls'
    stage.append(control)
    await act(async () => elements().root.querySelector('.spatial-workarea')!.append(stage))
    flush()
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-128px')
    await act(async () => stage.remove())
    flush()
    expect(control.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('')
    view.unmount()
    expect(originalControl.style.getPropertyValue('--spatial-stage-dock-shift')).toBe('-3px')
    expect(frames.size).toBe(0)
  })

  it('keeps horizontal navigation, safe-area insets, and action-bar clearance isolated to the dock stylesheet', () => {
    const dockCss = readFileSync(resolve('src', 'layout', 'floatingDock.css'), 'utf8')
    expect(dockCss).toContain('overflow-x: auto')
    expect(dockCss).toContain('env(safe-area-inset-bottom)')
    expect(dockCss).toContain('env(safe-area-inset-left)')
    expect(dockCss).toContain('env(safe-area-inset-right)')
    expect(dockCss).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, max-content) minmax(0, 1fr)')
    expect(dockCss).toContain('grid-template-columns: minmax(0, 1fr);')
    expect(dockCss).toContain('left: var(--spatial-dock-center);')
    expect(dockCss).toContain('width: var(--spatial-dock-anchor-width);')
    expect(dockCss).not.toContain('--spatial-dock-available-width')
    expect(dockCss).toContain('.spatial-workspace .sticky.bottom-0')
    expect(dockCss).toContain('.spatial-workspace .fixed.bottom-4')
    expect(dockCss).toContain('translate: 0 var(--spatial-stage-dock-shift, 0px)')
    expect(dockCss).toContain('scroll-padding-bottom:')
  })

  it('shares square dock styling and inherits theme tokens instead of replacing selected palettes', () => {
    const css = readFileSync(resolve('src', 'layout', 'portalWorkspace.css'), 'utf8')
    expect(css).not.toMatch(/--color-[\w-]+\s*:/)
    expect(css).toContain('--portal-selection:var(--color-accent)')
    expect(css).toMatch(/\.spatial-workspace \.spatial-dock \{[^}]*border-radius:2px/)
    expect(css).toMatch(/\.spatial-workspace \.spatial-dock :is\(a,button\) \{[^}]*border-radius:1px/)
    expect(css).toContain('.spatial-workspace .spatial-dock a[aria-current="page"]')
    expect(css).not.toMatch(/\.spatial-tool-portal \.spatial-dock[^{}]*\{[^}]*border-radius/)
    const dashboardCss = readFileSync(resolve('src', 'layout', 'dashboardFrame.css'), 'utf8')
    expect(dashboardCss).not.toMatch(/\.spatial-dock[^{}]*\{[^}]*\b(?:padding|gap|border-radius)\s*:/)
  })
})
