/**
 * SSRF-Safe HTTP Client (`safeFetch`).
 * Implements PLAT-1 (Audit S-10).
 *
 * Guarantees that outbound requests cannot reach private/internal networks,
 * loopbacks, or cloud metadata endpoints. Protects against DNS rebinding,
 * protocol smuggling, redirect spoofing, and resource exhaustion.
 */
import * as dns from 'node:dns/promises'
import * as http from 'node:http'
import * as https from 'node:https'
import { isPublicIp, isPrivateHostname, normalizeIpv4 } from './ip'

export interface SafeFetchOptions {
  method?: string
  headers?: Record<string, string>
  body?: string | Buffer
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  allowedPorts?: number[]
  allowHttp?: boolean
  allowedContentTypes?: string[]
}

export interface SafeFetchResponse {
  status: number
  headers: Record<string, string>
  body: Buffer
  finalUrl: string
  resolvedIp: string
}

export class SsrBlockedError extends Error {
  code = 'SSRF_BLOCKED'
  constructor(message: string) {
    super(message)
    this.name = 'SsrBlockedError'
  }
}

export class ResponseTooLargeError extends Error {
  code = 'RESPONSE_TOO_LARGE'
  constructor(message: string) {
    super(message)
    this.name = 'ResponseTooLargeError'
  }
}

export class SafeFetchTimeoutError extends Error {
  code = 'TIMEOUT'
  constructor(message: string) {
    super(message)
    this.name = 'SafeFetchTimeoutError'
  }
}

/**
 * Resolves a hostname to its IP addresses and validates that ALL resolved addresses
 * are publicly routable. Returns the primary validated IP.
 */
export async function resolveAndValidateHost(
  host: string,
  lookupFn: (hostname: string) => Promise<{ address: string; family: number }[]> = async (h) => {
    return (await dns.lookup(h, { all: true })) as { address: string; family: number }[]
  }
): Promise<string> {
  // If host is an IP literal
  const cleanHost = host.replace(/^\[|\]$/g, '')
  if (isPublicIp(cleanHost)) {
    return cleanHost
  }

  // Check if literal is private or private hostname
  if (isPrivateHostname(cleanHost) || normalizeIpv4(cleanHost) !== null || cleanHost.includes(':')) {
    throw new SsrBlockedError(`Host "${host}" is private, reserved, or blocked.`)
  }

  const addresses = await lookupFn(cleanHost)
  if (!addresses || addresses.length === 0) {
    throw new SsrBlockedError(`Could not resolve hostname "${cleanHost}".`)
  }

  // ALL addresses must be public to prevent multi-A record DNS rebinding tricks
  for (const record of addresses) {
    if (!isPublicIp(record.address)) {
      throw new SsrBlockedError(
        `Host "${cleanHost}" resolved to private/blocked IP: "${record.address}".`
      )
    }
  }

  const primary = addresses[0]
  if (!primary) {
    throw new SsrBlockedError(`No address records found for "${cleanHost}".`)
  }
  return primary.address
}

/**
 * Executes a hardened, SSRF-safe HTTP(S) request.
 */
export async function safeFetch(
  urlInput: string | URL,
  opts?: SafeFetchOptions,
  customLookup?: (hostname: string) => Promise<{ address: string; family: number }[]>
): Promise<SafeFetchResponse> {
  const timeoutMs = opts?.timeoutMs ?? 5_000
  const maxBytes = opts?.maxBytes ?? 1_000_000
  const maxRedirects = opts?.maxRedirects ?? 3
  const allowedPorts = opts?.allowedPorts ?? [80, 443]
  const allowHttp = opts?.allowHttp ?? (process.env.NODE_ENV !== 'production')
  const allowedContentTypes = opts?.allowedContentTypes

  let currentUrl = typeof urlInput === 'string' ? new URL(urlInput) : new URL(urlInput.toString())
  let redirectsRemaining = maxRedirects
  let lastResolvedIp = ''

  while (true) {
    // 1. Protocol check
    if (currentUrl.protocol !== 'https:' && currentUrl.protocol !== 'http:') {
      throw new SsrBlockedError(`Unsupported protocol "${currentUrl.protocol}". Only http/https allowed.`)
    }
    if (currentUrl.protocol === 'http:' && !allowHttp) {
      throw new SsrBlockedError('HTTP protocol disallowed in production. Use HTTPS.')
    }

    // 2. Disallow userinfo (e.g. http://user:pass@domain)
    if (currentUrl.username || currentUrl.password) {
      throw new SsrBlockedError('URLs containing user credentials / userinfo are blocked.')
    }

    // 3. Port check
    const port = currentUrl.port ? Number(currentUrl.port) : (currentUrl.protocol === 'https:' ? 443 : 80)
    if (!allowedPorts.includes(port)) {
      throw new SsrBlockedError(`Port ${port} is not in the allowed ports list: [${allowedPorts.join(', ')}].`)
    }

    // 4. DNS resolution & IP validation (Pins the connection to this exact IP)
    const resolvedIp = await resolveAndValidateHost(currentUrl.hostname, customLookup)
    lastResolvedIp = resolvedIp

    // 5. Perform the request using Node http/https client pinned to the resolved IP
    const isHttps = currentUrl.protocol === 'https:'
    const requestModule = isHttps ? https : http

    const requestHeaders: Record<string, string> = {
      ...(opts?.headers ?? {}),
      Host: currentUrl.host,
    }

    const responseResult = await new Promise<{
      status: number
      headers: Record<string, string>
      body: Buffer
      location?: string
    }>((resolve, reject) => {
      let isSettled = false
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true
          req.destroy(new SafeFetchTimeoutError(`Request timed out after ${timeoutMs}ms.`))
        }
      }, timeoutMs)

      const req = requestModule.request(
        {
          host: resolvedIp,
          port,
          path: currentUrl.pathname + currentUrl.search,
          method: opts?.method ?? 'GET',
          headers: requestHeaders,
          servername: currentUrl.hostname, // Required for SNI TLS handshake
          rejectUnauthorized: process.env.NODE_ENV === 'production',
        },
        (res) => {
          const status = res.statusCode ?? 0
          const resHeaders: Record<string, string> = {}
          for (const [k, v] of Object.entries(res.headers)) {
            if (v !== undefined) {
              resHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v
            }
          }

          // Redirect handling
          if ([301, 302, 303, 307, 308].includes(status) && resHeaders.location) {
            clearTimeout(timer)
            isSettled = true
            res.resume() // discard remaining
            resolve({
              status,
              headers: resHeaders,
              body: Buffer.alloc(0),
              location: resHeaders.location,
            })
            return
          }

          // Content-Type check if specified
          if (allowedContentTypes && allowedContentTypes.length > 0) {
            const ct = resHeaders['content-type'] ?? ''
            const matches = allowedContentTypes.some((type) => ct.includes(type))
            if (!matches) {
              clearTimeout(timer)
              isSettled = true
              res.destroy()
              reject(new SsrBlockedError(`Content-Type "${ct}" is not permitted.`))
              return
            }
          }

          const chunks: Buffer[] = []
          let totalBytes = 0

          res.on('data', (chunk: Buffer) => {
            totalBytes += chunk.length
            if (totalBytes > maxBytes) {
              clearTimeout(timer)
              isSettled = true
              res.destroy()
              reject(new ResponseTooLargeError(`Response exceeded maximum size of ${maxBytes} bytes.`))
              return
            }
            chunks.push(chunk)
          })

          res.on('end', () => {
            if (!isSettled) {
              clearTimeout(timer)
              isSettled = true
              resolve({
                status,
                headers: resHeaders,
                body: Buffer.concat(chunks),
              })
            }
          })

          res.on('error', (err) => {
            if (!isSettled) {
              clearTimeout(timer)
              isSettled = true
              reject(err)
            }
          })
        }
      )

      req.on('error', (err) => {
        if (!isSettled) {
          clearTimeout(timer)
          isSettled = true
          reject(err)
        }
      })

      if (opts?.body) {
        req.write(opts.body)
      }
      req.end()
    })

    if (responseResult.location) {
      if (redirectsRemaining <= 0) {
        throw new SsrBlockedError(`Maximum redirects (${maxRedirects}) exceeded.`)
      }
      redirectsRemaining--
      // Resolve redirect location against current URL
      currentUrl = new URL(responseResult.location, currentUrl)
      continue
    }

    return {
      status: responseResult.status,
      headers: responseResult.headers,
      body: responseResult.body,
      finalUrl: currentUrl.toString(),
      resolvedIp: lastResolvedIp,
    }
  }
}
