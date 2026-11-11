import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, Rubik, Manrope, JetBrains_Mono, Bebas_Neue } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '@/lib/query'
import { HeaderNav } from '@/components/common/HeaderNav'
import { PageTransition } from '@/components/common/PageTransition'

// Primary modern sans-serif for UI & controls
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans-main',
  weight: ['400', '500', '600', '700', '800'],
})

// Rubik: Used for bold titles, subheadings, and section headers
const rubik = Rubik({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-rubik',
  weight: ['500', '600', '700', '800', '900'],
})

// Manrope: Clean, readable neo-grotesque for descriptions, body text & paragraphs
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-manrope',
  weight: ['400', '500', '600'],
})

// Bebas Neue: High-impact condensed display typeface (companion to Atipo Round-8) for hero callouts
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-punch',
  weight: ['400'],
})

// JetBrains Mono: Cryptographic hashes, JSON-RPC payloads & numbers
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

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
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${rubik.variable} ${manrope.variable} ${bebasNeue.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-screen bg-bg text-text font-sans antialiased flex flex-col selection:bg-brand/20 selection:text-brand">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <QueryProvider>
          {/* Featurebase-style: Clean, full-bleed sticky top navigation */}
          <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-surface/80 backdrop-blur-xl transition-all">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-6">
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
