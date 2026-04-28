'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'

let listeners: ((active: boolean) => void)[] = []
let activeCount = 0

export function startProgress() {
  activeCount++
  listeners.forEach((fn) => fn(true))
}

export function stopProgress() {
  activeCount = Math.max(0, activeCount - 1)
  if (activeCount === 0) listeners.forEach((fn) => fn(false))
}

export default function TopProgressBar() {
  const [active, setActive] = useState(false)
  const pathname = usePathname()
  const prevPathname = useRef(pathname)

  useEffect(() => {
    listeners.push(setActive)
    return () => { listeners = listeners.filter((fn) => fn !== setActive) }
  }, [])

  // Stop when navigation completes (pathname changed)
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      stopProgress()
    }
  }, [pathname])

  // Start on internal link clicks
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as Element).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return
      // Only internal same-origin navigation (not hash-only, not external)
      if (href.startsWith('/') && !href.startsWith('//') && !anchor.hasAttribute('download') && anchor.target !== '_blank') {
        startProgress()
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  if (!active) return null

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 9999, overflow: 'hidden', background: 'transparent' }}>
      <div style={{ height: '100%', background: 'var(--brand)', animation: 'cm-progress 1.4s ease-in-out infinite', transformOrigin: 'left center' }} />
      <style>{`@keyframes cm-progress{0%{transform:scaleX(0) translateX(0)}50%{transform:scaleX(0.6) translateX(80%)}100%{transform:scaleX(0) translateX(300%)}}`}</style>
    </div>
  )
}
