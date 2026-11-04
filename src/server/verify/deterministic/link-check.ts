import type { ParsedArtifact } from '../artifact'

export interface CheckLinkCheckSpec {
  require_https?: boolean
  disallow_internal?: boolean
  max_links?: number
}

const URL_REGEX = /https?:\/\/[^\s<>"'{}|\\^`]+/gi
const INTERNAL_HOST_REGEX = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1\])/i

export function checkLinkCheck(
  artifact: ParsedArtifact,
  spec: CheckLinkCheckSpec
): { status: 'pass' | 'fail'; observed: unknown; expected: unknown; message: string } {
  const content = artifact.text || ''
  const matches = content.match(URL_REGEX) || []

  if (spec.max_links !== undefined && matches.length > spec.max_links) {
    return {
      status: 'fail',
      observed: matches.length,
      expected: `<= ${spec.max_links}`,
      message: `Found ${matches.length} links; maximum allowed is ${spec.max_links}.`,
    }
  }

  const issues: string[] = []

  for (const urlStr of matches) {
    try {
      const parsed = new URL(urlStr)
      if (spec.require_https && parsed.protocol !== 'https:') {
        issues.push(`${urlStr} is not HTTPS`)
      }
      if (spec.disallow_internal !== false && INTERNAL_HOST_REGEX.test(parsed.hostname)) {
        issues.push(`${urlStr} points to an internal/loopback address`)
      }
    } catch {
      issues.push(`Malformed URL: ${urlStr}`)
    }
  }

  if (issues.length > 0) {
    return {
      status: 'fail',
      observed: issues,
      expected: 'valid, safe URLs only',
      message: `Link security validation failed: ${issues.join('; ')}.`,
    }
  }

  return {
    status: 'pass',
    observed: `${matches.length} valid links`,
    expected: 'all links pass protocol & SSRF guards',
    message: `All ${matches.length} links validated successfully.`,
  }
}
