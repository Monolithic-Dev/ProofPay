import { describe, it, expect, beforeEach } from 'vitest'
import { SamlService, SamlIdpConfig } from '@/server/auth/saml-sso'

const mockConfig: SamlIdpConfig = {
  entityId: 'https://idp.okta.com/app/proofpay',
  ssoUrl: 'https://idp.okta.com/app/proofpay/sso/saml',
  certificate: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0...',
  clockSkewSeconds: 60,
}

function buildMockSamlResponse(params: {
  id?: string
  statusCode?: string
  audience?: string
  notBefore?: string
  notOnOrAfter?: string
  nameId?: string
  email?: string
  role?: string
}) {
  const {
    id = '_assertion_test_123',
    statusCode = 'urn:oasis:names:tc:SAML:2.0:status:Success',
    audience = 'https://proofpay.io/saml/metadata',
    notBefore = new Date(Date.now() - 10000).toISOString(),
    notOnOrAfter = new Date(Date.now() + 60000).toISOString(),
    nameId = 'enterprise_user@acme-corp.com',
    email = 'enterprise_user@acme-corp.com',
    role = 'escrow_auditor',
  } = params

  const xml = `
<samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol" ID="_resp_999" Version="2.0" IssueInstant="${new Date().toISOString()}">
  <samlp:Status>
    <samlp:StatusCode Value="${statusCode}" />
  </samlp:Status>
  <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion" ID="${id}" Version="2.0" IssueInstant="${new Date().toISOString()}">
    <saml:Subject>
      <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">${nameId}</saml:NameID>
    </saml:Subject>
    <saml:Conditions NotBefore="${notBefore}" NotOnOrAfter="${notOnOrAfter}">
      <saml:AudienceRestriction>
        <saml:Audience>${audience}</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>
    <saml:AuthnStatement SessionIndex="_session_okta_456">
      <saml:AuthnContext>
        <saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>
      </saml:AuthnContext>
    </saml:AuthnStatement>
    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>${email}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="roles">
        <saml:AttributeValue>${role}</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="organization">
        <saml:AttributeValue>Acme Corporation</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
</samlp:Response>`

  return Buffer.from(xml, 'utf-8').toString('base64')
}

describe('SAML 2.0 & Enterprise SSO Profile Adapter (src/server/auth/saml-sso.ts)', () => {
  let saml: SamlService

  beforeEach(() => {
    saml = new SamlService(mockConfig)
    SamlService.resetReplayCache()
  })

  it('generates a valid AuthnRequest with secure random identifier and proper ACS URL', () => {
    const req = saml.createAuthnRequest('https://proofpay.io', 'https://proofpay.io/api/v1/auth/saml/callback')
    expect(req.id).toMatch(/^_pf_[a-f0-9]{32}$/)
    expect(req.xml).toContain('Destination="https://idp.okta.com/app/proofpay/sso/saml"')
    expect(req.xml).toContain('AssertionConsumerServiceURL="https://proofpay.io/api/v1/auth/saml/callback"')
    expect(req.b64.length).toBeGreaterThan(50)
  })

  it('successfully validates a valid IdP response and extracts user identity and attributes', () => {
    const b64 = buildMockSamlResponse({
      id: '_assert_success_001',
      nameId: 'alice@enterprise.org',
      email: 'alice@enterprise.org',
      role: 'admin',
    })

    const result = saml.validateResponse(b64, 'https://proofpay.io/saml/metadata')
    expect(result.success).toBe(true)
    expect(result.nameId).toBe('alice@enterprise.org')
    expect(result.sessionIndex).toBe('_session_okta_456')
    expect(result.attributes?.email).toBe('alice@enterprise.org')
    expect(result.attributes?.organization).toBe('Acme Corporation')
    expect(result.attributes?.roles).toEqual(['admin'])
  })

  it('prevents replay attacks when the same Assertion ID is submitted more than once', () => {
    const b64 = buildMockSamlResponse({ id: '_replay_token_777' })

    const first = saml.validateResponse(b64, 'https://proofpay.io/saml/metadata')
    expect(first.success).toBe(true)

    const second = saml.validateResponse(b64, 'https://proofpay.io/saml/metadata')
    expect(second.success).toBe(false)
    expect(second.error).toContain('Replay attack detected')
  })

  it('rejects assertions with audience mismatch', () => {
    const b64 = buildMockSamlResponse({ audience: 'https://imposter.app/sp' })
    const result = saml.validateResponse(b64, 'https://proofpay.io/saml/metadata')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Audience mismatch')
  })

  it('rejects expired assertions outside of allowable clock-skew tolerance', () => {
    const expiredNotOnOrAfter = new Date(Date.now() - 120000).toISOString()
    const b64 = buildMockSamlResponse({ notOnOrAfter: expiredNotOnOrAfter })

    const result = saml.validateResponse(b64, 'https://proofpay.io/saml/metadata')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Assertion has expired')
  })
})
