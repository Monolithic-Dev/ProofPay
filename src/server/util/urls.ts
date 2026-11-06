/**
 * URL and redirect hardening utilities.
 * Implements PLAT-12 (Audit S-7, S-8, S-13).
 *
 * Ensures all outbound links use the canonical configured APP_BASE_URL
 * (preventing Host header poisoning attacks) and blocks open redirects.
 */

/**
 * Returns the canonical base URL of the application.
 */
export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL || 'http://localhost:3000'
}

/**
 * Builds an absolute URL from APP_BASE_URL.
 * Rejects attacker-controlled host/x-forwarded-host poisoning.
 */
export function absoluteUrl(path: string): string {
  const base = getAppBaseUrl().replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}

/**
 * Validates and sanitizes a redirect target path.
 *
 * Prevents Open Redirect vulnerabilities:
 * - Only permits relative paths starting with a single '/'
 * - Rejects protocol-relative paths ('//evil.com')
 * - Rejects backslashes ('/\evil.com' which some browsers normalize to http)
 * - Rejects any scheme ('javascript:', 'data:', 'https://')
 * - Defaults safely to '/app'
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || typeof next !== 'string') {
    return '/app'
  }

  const trimmed = next.trim()

  // Must start with exactly one forward slash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return '/app'
  }

  // Reject backslashes anywhere in the path prefix
  if (trimmed.includes('\\')) {
    return '/app'
  }

  // Reject control characters or whitespace
  if (/[\u0000-\u001F\u007F-\u009F\s]/.test(trimmed)) {
    return '/app'
  }

  // Reject URL scheme syntax e.g. /https: or /javascript:
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return '/app'
  }

  return trimmed
}
