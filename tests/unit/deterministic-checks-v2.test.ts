import { describe, it, expect } from 'vitest'
import { runDeterministicCheck } from '@/server/verify/deterministic/registry'
import { parseArtifact } from '@/server/verify/artifact'

describe('Criteria Library v2 — Deterministic Checks', () => {
  it('validates CSV schemas correctly', () => {
    const csvContent = 'id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com'
    const artifact = parseArtifact('text', csvContent)

    // Passing case
    const passRes = runDeterministicCheck(
      {
        criterion_key: 'c_csv',
        check: 'csv_schema',
        spec: { required_headers: ['id', 'name', 'email'], min_columns: 3 },
      },
      artifact
    )
    expect(passRes.passed).toBe(true)

    // Failing case: missing header
    const failRes = runDeterministicCheck(
      {
        criterion_key: 'c_csv',
        check: 'csv_schema',
        spec: { required_headers: ['id', 'name', 'phone'] },
      },
      artifact
    )
    expect(failRes.passed).toBe(false)
    expect(failRes.message).toContain('phone')
  })

  it('detects forbidden terms', () => {
    const content = 'This code contains proprietary internal secrets and passwords.'
    const artifact = parseArtifact('text', content)

    const failRes = runDeterministicCheck(
      {
        criterion_key: 'c_forbid',
        check: 'forbidden_terms',
        spec: { terms: ['internal secrets', 'unauthorized'] },
      },
      artifact
    )
    expect(failRes.passed).toBe(false)
    expect(failRes.message).toContain('internal secrets')

    const passRes = runDeterministicCheck(
      {
        criterion_key: 'c_forbid',
        check: 'forbidden_terms',
        spec: { terms: ['confidential NDA', 'prohibited'] },
      },
      artifact
    )
    expect(passRes.passed).toBe(true)
  })

  it('guards against SSRF in link checks', () => {
    const unsafeContent = 'Documentation available at http://localhost:8080/admin and https://api.external.com'
    const artifact = parseArtifact('text', unsafeContent)

    const failRes = runDeterministicCheck(
      {
        criterion_key: 'c_links',
        check: 'link_check',
        spec: { require_https: true, disallow_internal: true },
      },
      artifact
    )
    expect(failRes.passed).toBe(false)
    expect(failRes.message).toMatch(/localhost|HTTPS/i)

    const safeContent = 'Production API at https://api.production.org/v1'
    const passRes = runDeterministicCheck(
      {
        criterion_key: 'c_links',
        check: 'link_check',
        spec: { require_https: true, disallow_internal: true },
      },
      parseArtifact('text', safeContent)
    )
    expect(passRes.passed).toBe(true)
  })
})
