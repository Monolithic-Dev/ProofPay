'use client'

import React, { useEffect, useRef, useState } from 'react'

interface ScrollRevealProps {
  children: React.ReactNode
  className?: string
  animation?: 'fade-up' | 'fade-in' | 'scale-up' | 'slide-left' | 'slide-right'
  delayMs?: number
  durationMs?: number
  threshold?: number
}

/**
 * Enterprise Scroll Reveal wrapper.
 * Uses IntersectionObserver with CSS transitions for smooth, butter-60fps
 * entrance animations across all pages and route changes.
 */
export function ScrollReveal({
  children,
  className = '',
  animation = 'fade-up',
  delayMs = 0,
  durationMs = 600,
  threshold = 0.1,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry && entry.isIntersecting) {
          setIsVisible(true)
          observer.unobserve(entry.target)
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const getInitialStyle = (): string => {
    switch (animation) {
      case 'fade-up':
        return 'opacity-0 translate-y-6'
      case 'scale-up':
        return 'opacity-0 scale-95 translate-y-3'
      case 'slide-left':
        return 'opacity-0 translate-x-8'
      case 'slide-right':
        return 'opacity-0 -translate-x-8'
      case 'fade-in':
      default:
        return 'opacity-0'
    }
  }

  const activeStyle = 'opacity-100 translate-y-0 translate-x-0 scale-100'

  return (
    <div
      ref={ref}
      style={{
        transitionDuration: `${durationMs}ms`,
        transitionDelay: `${delayMs}ms`,
      }}
      className={`transition-all ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? activeStyle : getInitialStyle()
      } ${className}`}
    >
      {children}
    </div>
  )
}
