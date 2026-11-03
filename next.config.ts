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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.paypal.com; connect-src 'self' https://*.paypal.com https://api.anthropic.com; frame-src 'self' https://*.paypal.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';",
          },
        ],
      },
    ]
  },
}

export default nextConfig

