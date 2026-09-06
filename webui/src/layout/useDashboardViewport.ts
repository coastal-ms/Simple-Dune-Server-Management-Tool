import { useLayoutEffect, useRef } from 'react'

export function useDashboardViewport(enabled: boolean) {
  const frameRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const frame = frameRef.current
    const root = frame?.closest<HTMLElement>('[data-app-scroll-container]')
    if (!enabled || !frame || !root) return

    const heightProperty = '--spatial-dashboard-height'
    const offsetProperty = '--spatial-dashboard-offset'
    const previousHeight = frame.style.getPropertyValue(heightProperty)
    const previousOffset = frame.style.getPropertyValue(offsetProperty)
    const previousMarker = root.getAttribute('data-spatial-dashboard')
    const viewport = window.visualViewport
    let offset = 0
    let animationFrame = 0
    root.scrollTop = 0
    root.setAttribute('data-spatial-dashboard', '')

    const update = () => {
      animationFrame = 0
      const bounds = root.getBoundingClientRect()
      const rootTop = bounds.top + root.clientTop
      const naturalTop = frame.getBoundingClientRect().top - offset
      const visibleTop = Math.max(rootTop, naturalTop, viewport?.offsetTop ?? 0)
      const visibleBottom = Math.min(rootTop + root.clientHeight, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight))
      const height = Math.max(0, visibleBottom - visibleTop)
      offset = Math.max(0, visibleTop - naturalTop)
      frame.style.setProperty(heightProperty, `${height}px`)
      frame.style.setProperty(offsetProperty, `${offset}px`)
      frame.toggleAttribute('data-dashboard-compact', height < 700)
    }
    const schedule = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(update)
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(root)
    window.addEventListener('resize', schedule)
    viewport?.addEventListener('resize', schedule)
    viewport?.addEventListener('scroll', schedule)
    update()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      observer?.disconnect()
      window.removeEventListener('resize', schedule)
      viewport?.removeEventListener('resize', schedule)
      viewport?.removeEventListener('scroll', schedule)
      frame.removeAttribute('data-dashboard-compact')
      if (previousHeight) frame.style.setProperty(heightProperty, previousHeight)
      else frame.style.removeProperty(heightProperty)
      if (previousOffset) frame.style.setProperty(offsetProperty, previousOffset)
      else frame.style.removeProperty(offsetProperty)
      if (previousMarker === null) root.removeAttribute('data-spatial-dashboard')
      else root.setAttribute('data-spatial-dashboard', previousMarker)
    }
  }, [enabled])

  return frameRef
}
