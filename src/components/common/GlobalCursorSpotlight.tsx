'use client'

/**
 * GlobalCursorSpotlight — full-page fixed cursor spotlight that layers over
 * the global dot-grid background. The glow follows the cursor with a smooth
 * lerp so it feels organic, not mechanical.
 *
 * Place once in the root layout (inside a 'use client' wrapper).
 * Covers the entire viewport via position:fixed, pointer-events:none so it
 * never blocks any interactive elements.
 */
import { useEffect, useRef, useCallback } from 'react'

export function GlobalCursorSpotlight() {
  const spotlightRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const target = useRef({ x: -9999, y: -9999 })
  const current = useRef({ x: -9999, y: -9999 })
  const hasEntered = useRef(false)

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const animate = useCallback(() => {
    current.current.x = lerp(current.current.x, target.current.x, 0.07)
    current.current.y = lerp(current.current.y, target.current.y, 0.07)

    if (spotlightRef.current && hasEntered.current) {
      spotlightRef.current.style.background = `radial-gradient(
        700px circle at ${current.current.x}px ${current.current.y}px,
        rgba(14, 165, 233, 0.07) 0%,
        rgba(14, 165, 233, 0.03) 35%,
        transparent 70%
      )`
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      hasEntered.current = true
      target.current = { x: e.clientX, y: e.clientY }
    }

    const handleMouseLeave = () => {
      hasEntered.current = false
      if (spotlightRef.current) {
        spotlightRef.current.style.background = 'none'
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  return (
    <div
      ref={spotlightRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        transition: 'none',
      }}
    />
  )
}

