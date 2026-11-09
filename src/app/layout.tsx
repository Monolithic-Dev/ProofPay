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
          <header className="border-b border-border bg-surface/85 backdrop-blur-md sticky top-0 z-40 shadow-sm transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Link href="/" className="flex items-center space-x-2 group">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                    <span className="text-white font-black text-sm tracking-tighter">PP</span>
                  </div>
                  <span className="font-extrabold text-lg tracking-tight text-text">
                    Proof<span className="text-brand dark:text-sky-400">Pay</span>
                  </span>
                </Link>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  PayPal Sandbox v2
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
