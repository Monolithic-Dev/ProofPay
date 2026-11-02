import type { Metadata } from 'next'
import './globals.css'

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
      <body className="min-h-screen bg-bg text-text antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <header className="border-b border-border bg-surface/80 backdrop-blur-sm sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-xl tracking-tight text-brand">ProofPay</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 text-muted border border-border">
                Sandbox
              </span>
            </div>
            <nav className="flex items-center space-x-4 text-sm font-medium text-muted">
              <span className="text-xs font-mono text-muted">Pay when it&apos;s proven</span>
            </nav>
          </div>
        </header>
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </body>
    </html>
  )
}
