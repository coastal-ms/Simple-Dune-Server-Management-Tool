import { useLayoutEffect, useRef } from 'react'

export function useFloatingDock({ enabled = true }: { enabled?: boolean } = {}) {
  const dockRef = useRef<HTMLElement>(null)
  const dockAnchorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!enabled) return
    const dock = dockRef.current
    const anchor = dockAnchorRef.current
    const root = anchor?.closest<HTMLElement>('[data-app-scroll-container]')
    if (!dock || !anchor || !root) return

    const clearanceProperty = '--spatial-dock-clearance'
    const previousClearance = root.style.getPropertyValue(clearanceProperty)
    const previousPriority = root.style.getPropertyPriority(clearanceProperty)
    const previousMarker = root.getAttribute('data-spatial-dock')
    const workarea = anchor.closest('.spatial-workarea')
    const controlShiftProperty = '--spatial-stage-dock-shift'
    const controlShifts = new Map<HTMLElement, { value: string; priority: string; shift: number }>()
    const viewport = window.visualViewport
    let frame = 0
    let needsMeasure = true
    let dockHeight = 0
    let gap = 12
    root.setAttribute('data-spatial-dock', '')

    function restoreControl(control: HTMLElement, original: { value: string; priority: string; shift: number }) {
      if (original.value) control.style.setProperty(controlShiftProperty, original.value, original.priority)
      else control.style.removeProperty(controlShiftProperty)
      original.shift = Number.parseFloat(original.value) || 0
    }

    const update = () => {
      frame = 0
      if (needsMeasure) {
        // Measure in normal flow, then preserve that exact slot while the same nav floats.
        anchor.removeAttribute('data-floating')
        const size = dock.getBoundingClientRect()
        dockHeight = size.height
        gap = Number.parseFloat(getComputedStyle(anchor).scrollMarginBottom) || 12
        anchor.style.setProperty('--spatial-dock-width', `${size.width}px`)
        anchor.style.setProperty('--spatial-dock-height', `${dockHeight}px`)
        needsMeasure = false
      }

      const rootRect = root.getBoundingClientRect()
      const left = Math.max(rootRect.left + root.clientLeft, viewport?.offsetLeft ?? 0)
      const right = Math.min(rootRect.left + root.clientLeft + root.clientWidth, (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth))
      const top = Math.max(rootRect.top + root.clientTop, viewport?.offsetTop ?? 0)
      const bottom = Math.min(rootRect.top + root.clientTop + root.clientHeight, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight))
      const slot = anchor.getBoundingClientRect()
      const floating = dockHeight > 0 && bottom - top > dockHeight + gap * 2 && right > left
        && (slot.top < top || slot.bottom > bottom - gap)

      dock.style.setProperty('--spatial-dock-center', `${slot.left + slot.width / 2}px`)
      dock.style.setProperty('--spatial-dock-anchor-width', `${slot.width}px`)
      dock.style.setProperty('--spatial-dock-viewport-offset', `${window.innerHeight - bottom}px`)
      anchor.toggleAttribute('data-floating', floating)
      root.style.setProperty(clearanceProperty, floating ? `${dockHeight + gap + 12}px` : '0px')

      const dockRect = floating ? dock.getBoundingClientRect() : null
      for (const [control, original] of controlShifts) {
        if (!workarea?.contains(control)) {
          observer?.unobserve(control)
          restoreControl(control, original)
          controlShifts.delete(control)
        }
      }
      workarea?.querySelectorAll<HTMLElement>('.spatial-stage-controls').forEach(control => {
        let original = controlShifts.get(control)
        if (!original) {
          original = {
            value: control.style.getPropertyValue(controlShiftProperty),
            priority: control.style.getPropertyPriority(controlShiftProperty),
            shift: Number.parseFloat(getComputedStyle(control).getPropertyValue(controlShiftProperty)) || 0,
          }
          controlShifts.set(control, original)
          observer?.observe(control)
        }
        const controlRect = control.getBoundingClientRect()
        // Compare the unshifted position, or each scroll/resize would undo its own clearance.
        const naturalTop = controlRect.top - original.shift
        const naturalBottom = controlRect.bottom - original.shift
        let shift = 0
        if (dockRect && controlRect.left < dockRect.right && controlRect.right > dockRect.left
          && naturalTop < dockRect.bottom && naturalBottom > dockRect.top) {
          const stage = control.closest<HTMLElement>('.spatial-stage')
          const stageTop = stage ? stage.getBoundingClientRect().top + stage.clientTop : top
          const earliestTop = Math.max(stageTop, top) + 8
          shift = Math.max(dockRect.top - naturalBottom - 8, Math.min(0, earliestTop - naturalTop))
        }
        if (!shift) restoreControl(control, original)
        else if (shift !== original.shift) {
          control.style.setProperty(controlShiftProperty, `${shift}px`)
          original.shift = shift
        }
      })
    }

    function schedule(measure = false) {
      needsMeasure ||= measure
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    const onScroll = () => schedule()
    const onResize = () => schedule(true)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(onResize)
    observer?.observe(root)
    observer?.observe(dock)
    if (workarea) observer?.observe(workarea)
    // Controls mount after entering 3D; child-list observation ignores our transform-only writes.
    const mutations = typeof MutationObserver === 'undefined' ? null : new MutationObserver(onScroll)
    if (workarea) mutations?.observe(workarea, { childList: true, subtree: true })
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onResize)
    viewport?.addEventListener('resize', onResize)
    viewport?.addEventListener('scroll', onScroll)
    update()

    return () => {
      window.cancelAnimationFrame(frame)
      observer?.disconnect()
      mutations?.disconnect()
      controlShifts.forEach((original, control) => restoreControl(control, original))
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onResize)
      viewport?.removeEventListener('resize', onResize)
      viewport?.removeEventListener('scroll', onScroll)
      anchor.removeAttribute('data-floating')
      if (previousMarker === null) root.removeAttribute('data-spatial-dock')
      else root.setAttribute('data-spatial-dock', previousMarker)
      if (previousClearance) root.style.setProperty(clearanceProperty, previousClearance, previousPriority)
      else root.style.removeProperty(clearanceProperty)
    }
  }, [enabled])

  return { dockRef, dockAnchorRef }
}
