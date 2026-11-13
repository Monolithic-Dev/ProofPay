'use client'

import React, { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

interface PageTransitionProps {
  children: React.ReactNode
}

/**
 * Route-change transition wrapper.
 * Plays a subtle fade + slide-in animation whenever routing to a new page.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(false)
    const t = setTimeout(() => setMounted(true), 15)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <div
      key={pathname}
      className={`transition-all duration-300 ease-out ${
        mounted
          ? 'opacity-100 translate-y-0 filter-none'
          : 'opacity-0 translate-y-2 filter blur-[2px]'
      }`}
    >
      {children}
    </div>
  )
}
