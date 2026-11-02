import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Allow larger body for artifact submission (up to 1 MiB + overhead)
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  // External packages that should not be bundled by Next.js
  serverExternalPackages: ['pino', 'pdfkit', 'postgres'],
}

export default nextConfig
