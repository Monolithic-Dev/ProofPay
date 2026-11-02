import type { Metadata } from 'next'
import './globals.css'
import { QueryProvider } from '@/lib/query'
import { HeaderNav } from '@/components/common/HeaderNav'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'ProofPay — Pay when it is proven',
  description: 'AI-verified milestones with PayPal authorization holds.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text antialiased flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link href="/" className="font-bold text-lg tracking-tight text-brand">
                  ProofPay
                </Link>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-border">
                  Sandbox
                </span>
              </div>
              <HeaderNav />
            </div>
          </header>
          <main id="main-content" className="flex-1">
            {children}
          </main>
        </QueryProvider>
      </body>
    </html>
  )
}
