'use client'

/**
 * HeroDotGrid — Linear-style dot grid background with cursor-spotlight effect.
 * Pure CSS + minimal JS. Zero dependencies. Monochrome: slate dots + brand blue spotlight.
 * The radial gradient follows the cursor, creating a "scanning lens" effect.
 */
import React, { useEffect, useRef, useCallback } from 'react'

interface HeroDotGridProps {
  className?: string
}

export function HeroDotGrid({ className = '' }: HeroDotGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const targetRef = useRef({ x: 50, y: 50 })
  const currentRef = useRef({ x: 50, y: 50 })

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  const animate = useCallback(() => {
    // Smooth lerp so the spotlight trails the cursor slightly
    currentRef.current.x = lerp(currentRef.current.x, targetRef.current.x, 0.08)
    currentRef.current.y = lerp(currentRef.current.y, targetRef.current.y, 0.08)

    if (spotlightRef.current) {
      spotlightRef.current.style.background = `
        radial-gradient(
          600px circle at ${currentRef.current.x}% ${currentRef.current.y}%,
          rgba(14, 165, 233, 0.08) 0%,
          rgba(14, 165, 233, 0.03) 30%,
          transparent 70%
        )
      `
    }

    rafRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      targetRef.current = {
        x: ((e.clientX - rect.left) / rect.width) * 100,
        y: ((e.clientY - rect.top) / rect.height) * 100,
      }
    }

    container.addEventListener('mousemove', handleMouseMove)
    rafRef.current = requestAnimationFrame(animate)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [animate])

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {/* Dot grid pattern via CSS — SVG data URI, no external requests */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148,163,184,0.25) 1px, transparent 1px)`,
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 100% 100% at 50% 0%, black 40%, transparent 100%)',
        }}
      />

      {/* Cursor-following spotlight overlay — this is the magic */}
      <div
        ref={spotlightRef}
        className="absolute inset-0 transition-none pointer-events-none"
        style={{
          background: `radial-gradient(600px circle at 50% 50%, rgba(14,165,233,0.06) 0%, transparent 70%)`,
        }}
      />

      {/* Top-center brand aurora — always present, fades toward bottom */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, rgba(14,165,233,0.09) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
    </div>
  )
}

