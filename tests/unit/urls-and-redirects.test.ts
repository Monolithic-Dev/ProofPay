import { describe, it, expect, beforeEach } from 'vitest'
import { safeRedirectPath, absoluteUrl } from '@/server/util/urls'
import {
  sanitizeEmailString,
  checkEmailInviteQuota,
  addEmailSuppression,
  clearEmailAbuseStore,
} from '@/server/security/email-abuse'

describe('PLAT-12 URLs, Redirects, and Email Abuse Controls', () => {
  describe('safeRedirectPath table (20 test cases)', () => {
    const table: Array<{ input: string | null | undefined; expected: string; desc: string }> = [
      // Valid relative paths
      { input: '/app', expected: '/app', desc: 'simple app path' },
      { input: '/contracts/123', expected: '/contracts/123', desc: 'subpath with id' },
      { input: '/settings?tab=security', expected: '/settings?tab=security', desc: 'path with query' },
      { input: '/app/overview#stats', expected: '/app/overview#stats', desc: 'path with hash' },

      // Dangerous open redirect payloads (MUST default to /app)
      { input: 'https://evil.com', expected: '/app', desc: 'full https url' },
      { input: 'http://evil.com', expected: '/app', desc: 'full http url' },
      { input: '//evil.com', expected: '/app', desc: 'protocol relative url' },
      { input: '///evil.com', expected: '/app', desc: 'triple slash url' },
      { input: '/\\evil.com', expected: '/app', desc: 'slash backslash bypass' },
      { input: '\\\\evil.com', expected: '/app', desc: 'double backslash' },
      { input: 'javascript:alert(1)', expected: '/app', desc: 'javascript pseudo-scheme' },
      { input: '/javascript:alert(1)', expected: '/app', desc: 'slash javascript' },
      { input: 'data:text/html,<script>', expected: '/app', desc: 'data uri' },
      { input: 'ftp://ftp.evil.com', expected: '/app', desc: 'ftp scheme' },
      { input: 'evil.com', expected: '/app', desc: 'bare domain without slash' },
      { input: '', expected: '/app', desc: 'empty string' },
      { input: null, expected: '/app', desc: 'null' },
      { input: undefined, expected: '/app', desc: 'undefined' },
      { input: '   ', expected: '/app', desc: 'whitespace only' },
      { input: '/app\n/evil', expected: '/app', desc: 'newline injection' },
    ]

    for (const { input, expected, desc } of table) {
      it(`sanitizes redirect target: "${input}" -> "${expected}" (${desc})`, () => {
        expect(safeRedirectPath(input)).toBe(expected)
      })
    }
  })

  describe('absoluteUrl', () => {
    it('constructs absolute URLs using APP_BASE_URL', () => {
      const url = absoluteUrl('/contracts/123')
      expect(url).toMatch(/^https?:\/\/.+\/contracts\/123$/)
    })
  })

  describe('Email abuse controls', () => {
    beforeEach(() => {
      clearEmailAbuseStore()
    })

    it('strips HTML and enforces subject character limits', () => {
      const malicious = '<script>alert(1)</script>Contract Title & <b>Notice</b>'
      const sanitized = sanitizeEmailString(malicious, 30)
      expect(sanitized).toBe('Contract Title & Notice')
      expect(sanitized).not.toContain('<')
      expect(sanitized.length).toBeLessThanOrEqual(30)
    })

    it('enforces external invite quota: 5/day for new orgs (<7 days old)', () => {
      const now = Date.now()
      const newOrgCreatedAt = now - 2 * 24 * 3600 * 1000 // 2 days old

      for (let i = 1; i <= 5; i++) {
        const res = checkEmailInviteQuota({
          orgId: 'org_new',
          orgCreatedAt: newOrgCreatedAt,
          recipientEmail: `user${i}@example.com`,
          now,
        })
        expect(res.allowed).toBe(true)
      }

      // 6th invite from new org is rejected
      const sixth = checkEmailInviteQuota({
        orgId: 'org_new',
        orgCreatedAt: newOrgCreatedAt,
        recipientEmail: 'user6@example.com',
        now,
      })
      expect(sixth.allowed).toBe(false)
      expect(sixth.reason).toContain('Organization daily invite limit exceeded')
    })

    it('enforces recipient limit of max 3 invites/day across orgs', () => {
      const now = Date.now()
      const oldOrgCreatedAt = now - 30 * 24 * 3600 * 1000 // 30 days old

      for (let i = 1; i <= 3; i++) {
        const res = checkEmailInviteQuota({
          orgId: `org_${i}`,
          orgCreatedAt: oldOrgCreatedAt,
          recipientEmail: 'target@example.com',
          now,
        })
        expect(res.allowed).toBe(true)
      }

      // 4th invite to the same recipient is blocked
      const fourth = checkEmailInviteQuota({
        orgId: 'org_another',
        orgCreatedAt: oldOrgCreatedAt,
        recipientEmail: 'target@example.com',
        now,
      })
      expect(fourth.allowed).toBe(false)
      expect(fourth.reason).toContain('Recipient daily invite limit exceeded')
    })

    it('immediately blocks invitations to suppressed email addresses', () => {
      addEmailSuppression('unsub@example.com')

      const res = checkEmailInviteQuota({
        orgId: 'org_1',
        orgCreatedAt: Date.now() - 30 * 24 * 3600 * 1000,
        recipientEmail: 'unsub@example.com',
      })

      expect(res.allowed).toBe(false)
      expect(res.reason).toBe('RECIPIENT_SUPPRESSED')
    })
  })
})
