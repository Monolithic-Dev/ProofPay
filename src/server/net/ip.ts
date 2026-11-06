/**
 * IP classification and SSRF address validation.
 * Implements PLAT-1 (Audit S-10).
 *
 * Validates whether an IP address or hostname is publicly routable,
 * blocking loopback, link-local, private, RFC 1918, RFC 6598, multicast,
 * documentation, and cloud metadata ranges.
 */

// CIDR range representation for fast prefix checking
interface CidrV4 {
  network: number
  mask: number
}

function parseCidrV4(cidr: string): CidrV4 {
  const [ipStr = '0.0.0.0', bitsStr = '32'] = cidr.split('/')
  const bits = Number(bitsStr)
  const parts = ipStr.split('.').map(Number)
  const p0 = parts[0] ?? 0
  const p1 = parts[1] ?? 0
  const p2 = parts[2] ?? 0
  const p3 = parts[3] ?? 0
  const network = ((p0 << 24) | (p1 << 16) | (p2 << 8) | p3) >>> 0
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0
  return { network: (network & mask) >>> 0, mask }
}

const BLOCKED_V4_CIDRS: CidrV4[] = [
  '0.0.0.0/8',       // "This host on this network"
  '10.0.0.0/8',      // Private-use (RFC 1918)
  '100.64.0.0/10',   // Shared Address Space / CGNAT (RFC 6598)
  '127.0.0.0/8',     // Loopback
  '169.254.0.0/16',  // Link-Local (incl. cloud metadata 169.254.169.254)
  '172.16.0.0/12',   // Private-use (RFC 1918)
  '192.0.0.0/24',    // IETF Protocol Assignments
  '192.0.2.0/24',    // TEST-NET-1 documentation
  '192.168.0.0/16',  // Private-use (RFC 1918)
  '198.18.0.0/15',   // Benchmarking
  '198.51.100.0/24', // TEST-NET-2 documentation
  '203.0.113.0/24',  // TEST-NET-3 documentation
  '224.0.0.0/4',     // Multicast
  '240.0.0.0/4',     // Reserved / Future Use
].map(parseCidrV4)

/**
 * Normalizes an IPv4 address string, converting octal, hex, or single 32-bit integer formats
 * to standard dotted decimal quad. Returns null if not a valid IPv4.
 */
export function normalizeIpv4(ip: string): string | null {
  const trimmed = ip.trim()

  // Single integer form e.g. 2130706433 or 0x7f000001
  if (/^(?:0x[0-9a-f]+|\d+)$/i.test(trimmed)) {
    const val = Number(trimmed)
    if (Number.isSafeInteger(val) && val >= 0 && val <= 0xffffffff) {
      return [
        (val >>> 24) & 0xff,
        (val >>> 16) & 0xff,
        (val >>> 8) & 0xff,
        val & 0xff,
      ].join('.')
    }
    return null
  }

  // Dotted quad or fewer parts (with octal/hex components)
  const parts = trimmed.split('.')
  if (parts.length > 4 || parts.length < 1) return null

  const parsedParts: number[] = []
  for (const part of parts) {
    if (!part) return null
    let num: number
    if (/^0x[0-9a-f]+$/i.test(part)) {
      num = parseInt(part, 16)
    } else if (/^0[0-7]+$/.test(part)) {
      num = parseInt(part, 8)
    } else if (/^\d+$/.test(part)) {
      num = parseInt(part, 10)
    } else {
      return null
    }
    if (isNaN(num) || num < 0) return null
    parsedParts.push(num)
  }

  const p0 = parsedParts[0]
  if (p0 === undefined) return null

  // Handle standard 4 parts
  if (parsedParts.length === 4) {
    if (parsedParts.some((p) => p > 255)) return null
    return parsedParts.join('.')
  }

  // Handle classes with fewer parts e.g. 127.1 -> 127.0.0.1
  let fullInt = 0
  if (parsedParts.length === 1) {
    fullInt = p0
  } else if (parsedParts.length === 2) {
    const p1 = parsedParts[1]
    if (p1 === undefined || p0 > 255 || p1 > 0xffffff) return null
    fullInt = (p0 << 24) | p1
  } else if (parsedParts.length === 3) {
    const p1 = parsedParts[1]
    const p2 = parsedParts[2]
    if (p1 === undefined || p2 === undefined || p0 > 255 || p1 > 255 || p2 > 0xffff) return null
    fullInt = (p0 << 24) | (p1 << 16) | p2
  }

  if (fullInt < 0 || fullInt > 0xffffffff) return null
  return [
    (fullInt >>> 24) & 0xff,
    (fullInt >>> 16) & 0xff,
    (fullInt >>> 8) & 0xff,
    fullInt & 0xff,
  ].join('.')
}

/**
 * Checks if a normalized IPv4 string falls into private/reserved ranges.
 */
function isPrivateV4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true
  }
  const p0 = parts[0] ?? 0
  const p1 = parts[1] ?? 0
  const p2 = parts[2] ?? 0
  const p3 = parts[3] ?? 0
  const intVal = ((p0 << 24) | (p1 << 16) | (p2 << 8) | p3) >>> 0

  for (const { network, mask } of BLOCKED_V4_CIDRS) {
    if (((intVal & mask) >>> 0) === network) {
      return true
    }
  }
  return false
}

/**
 * Checks if an IPv6 address string is private, loopback, link-local, multicast, or mapped IPv4.
 */
function isPrivateV6(ip: string): boolean {
  let clean = ip.trim().toLowerCase()
  if (clean.startsWith('[') && clean.endsWith(']')) {
    clean = clean.slice(1, -1)
  }

  // Loopback and unspecified
  if (clean === '::1' || clean === '::' || clean === '0000:0000:0000:0000:0000:0000:0000:0001') {
    return true
  }

  // IPv4-mapped IPv6: ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (clean.startsWith('::ffff:')) {
    const embeddedV4 = clean.slice(7)
    const norm = normalizeIpv4(embeddedV4)
    if (norm) {
      return isPrivateV4(norm)
    }
    // Might be hex formatted ::ffff:7f00:0001
    const hexParts = embeddedV4.split(':')
    if (hexParts.length === 2 && hexParts[0] && hexParts[1]) {
      const p1 = parseInt(hexParts[0], 16)
      const p2 = parseInt(hexParts[1], 16)
      if (!isNaN(p1) && !isNaN(p2)) {
        const v4Str = `${(p1 >> 8) & 0xff}.${p1 & 0xff}.${(p2 >> 8) & 0xff}.${p2 & 0xff}`
        return isPrivateV4(v4Str)
      }
    }
    return true
  }

  // Unique Local Address (ULA) fc00::/7 (covers fc00... and fd00...)
  if (/^f[cd][0-9a-f]{2}:/i.test(clean)) return true

  // Link-Local fe80::/10 (covers fe80... through febf...)
  if (/^fe[89ab][0-9a-f]:/i.test(clean)) return true

  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/i.test(clean)) return true

  return false
}

/**
 * Checks if a hostname matches private/internal domain patterns.
 */
export function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase().trim()
  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.local') ||
    lower.endsWith('.lan') ||
    lower.endsWith('.home') ||
    lower.endsWith('.corp')
  ) {
    return true
  }
  return false
}

/**
 * Validates if an IP address (v4 or v6) is publicly routable.
 * Returns true if public, false if private/reserved/loopback/cloud metadata.
 */
export function isPublicIp(ip: string): boolean {
  if (!ip) return false

  const v4 = normalizeIpv4(ip)
  if (v4) {
    return !isPrivateV4(v4)
  }

  // If not IPv4, test as IPv6
  if (ip.includes(':')) {
    return !isPrivateV6(ip)
  }

  return false
}
