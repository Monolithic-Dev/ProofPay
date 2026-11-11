import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/lib/query'
import { HeaderNav } from '@/components/common/HeaderNav'
import { PageTransition } from '@/components/common/PageTransition'

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
          {/* Top floating glass dock container */}
          <header className="fixed top-3 sm:top-4 left-0 right-0 z-50 flex justify-center px-3 sm:px-6 pointer-events-none">
            <div className="w-full max-w-6xl pointer-events-auto">
              <HeaderNav />
            </div>
          </header>

          <main id="main-content" className="flex-1 pt-20 sm:pt-24">
            <PageTransition>{children}</PageTransition>
          </main>
        </QueryProvider>
      </body>
    </html>
  )
}
