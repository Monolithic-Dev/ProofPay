import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/lib/query'
import { HeaderNav } from '@/components/common/HeaderNav'
import { PageTransition } from '@/components/common/PageTransition'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'ProofPay — Conditional Payments for Autonomous AI Agents',
  description:
    'Two-sided conditional payments for autonomous AI agents. Pre-authorized PayPal funds release only when cryptographic proof of task completion satisfies the agreement.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased flex flex-col selection:bg-brand/20 selection:text-brand">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <header className="border-b border-border/80 bg-surface/75 backdrop-blur-xl sticky top-0 z-40 shadow-sm transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
              {/* Brand Logo and Status Pill */}
              <div className="flex items-center space-x-3 shrink-0">
                <Link href="/" className="flex items-center space-x-2.5 group">
                  <div className="relative">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/25 group-hover:scale-105 group-hover:shadow-sky-500/40 transition-all">
                      <span className="text-white font-black text-sm tracking-tighter">PP</span>
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="font-extrabold text-lg tracking-tight text-text leading-none">
                      Proof<span className="text-brand dark:text-sky-400">Pay</span>
                    </span>
                    <span className="text-[9px] uppercase tracking-wider font-semibold text-muted/70 leading-none pt-0.5">
                      Autonomous Holds
                    </span>
                  </div>
                </Link>
                
                {/* Properly formatted, single-line PayPal badge with whitespace-nowrap */}
                <div className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>PayPal Sandbox v2</span>
                </div>
              </div>

              {/* Streamlined Nav and Actions */}
              <HeaderNav />
            </div>
          </header>
          <main id="main-content" className="flex-1">
            <PageTransition>{children}</PageTransition>
          </main>
        </QueryProvider>
      </body>
    </html>
  )
}
