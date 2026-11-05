/**
 * SSRF-Safe HTTP Client (safeFetch).
 * Implements docs/v2/01-NEW-FEATURES-SECURITY-AI-PRODUCT.md S6 & PROOFPAY-FULL-AUDIT-AND-IMPROVEMENTS.md S-10.
 *
 * Enforces protocol, IP range, and cloud metadata guards to prevent Server-Side Request Forgery.
 */

export interface SafeFetchOptions extends RequestInit {
  timeoutMs?: number
  maxBytes?: number
  allowedProtocols?: Array<'http:' | 'https:'>
  allowPrivateIps?: boolean
}

export class SecuritySSRFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecuritySSRFError'
  }
}

const PRIVATE_OR_RESERVED_IP_PATTERNS = [
  /^localhost$/i,
  /^127\.\d+\.\d+\.\d+$/,
  /^10\.\d+\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+$/,
  /^169\.254\.\d+\.\d+$/, // AWS / GCP / Azure metadata
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^\[::1\]$/,
  /^fc00:/i,
  /^fe80:/i,
]

export function isPrivateOrReservedHost(hostname: string): boolean {
  const cleanHost = hostname.replace(/^\[|\]$/g, '').trim().toLowerCase()
  return PRIVATE_OR_RESERVED_IP_PATTERNS.some((pattern) => pattern.test(cleanHost))
}

export async function safeFetch(
  input: string | URL,
  options?: SafeFetchOptions
): Promise<Response> {
  const urlObj = typeof input === 'string' ? new URL(input) : input
  const allowedProtocols = options?.allowedProtocols || ['https:', 'http:']

  // 1. Protocol check
  if (!allowedProtocols.includes(urlObj.protocol as any)) {
    throw new SecuritySSRFError(
      `Disallowed protocol: "${urlObj.protocol}". Only ${allowedProtocols.join(', ')} permitted.`
    )
  }

  // 2. Private & Metadata IP check
  if (!options?.allowPrivateIps && isPrivateOrReservedHost(urlObj.hostname)) {
    throw new SecuritySSRFError(
      `SSRF Guard: connection to internal/private host "${urlObj.hostname}" blocked.`
    )
  }

  const timeoutMs = options?.timeoutMs ?? 10_000
  const maxBytes = options?.maxBytes ?? 2 * 1024 * 1024 // 2 MiB

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(urlObj.toString(), {
      ...options,
      signal: controller.signal,
      redirect: 'manual', // Prevent silent redirects to internal targets
    })

    // If redirect, re-validate destination
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('Location')
      if (location) {
        const nextUrl = new URL(location, urlObj)
        if (!options?.allowPrivateIps && isPrivateOrReservedHost(nextUrl.hostname)) {
          throw new SecuritySSRFError(
            `SSRF Guard: redirect to internal host "${nextUrl.hostname}" blocked.`
          )
        }
      }
    }

    return res
  } finally {
    clearTimeout(timer)
  }
}

