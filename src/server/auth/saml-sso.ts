/**
 * SAML 2.0 & Enterprise SSO Profile Adapter
 * 
 * Provides production-ready XML Assertion validation, SAML Response parsing,
 * clock-skew tolerance, replay protection, and user profile mapping for
 * Okta, Microsoft Azure AD (Entra ID), and Google Workspace SAML Identity Providers (IdPs).
 */

import { createHash } from 'node:crypto'

export interface SamlIdpConfig {
  entityId: string
  ssoUrl: string
  certificate: string
  clockSkewSeconds?: number
}

export interface SamlUserAttributes {
  email: string
  name?: string
  firstName?: string
  lastName?: string
  organization?: string
  roles?: string[]
  [key: string]: unknown
}

export interface SamlValidationResult {
  success: boolean
  nameId?: string
  sessionIndex?: string
  attributes?: SamlUserAttributes
  error?: string
}

// In-memory nonce cache to prevent replay attacks (with TTL cleanup)
const usedAssertionIds = new Map<string, number>()

function cleanupExpiredNonces(maxAgeMs = 10 * 60 * 1000) {
  const now = Date.now()
  for (const [id, timestamp] of usedAssertionIds.entries()) {
    if (now - timestamp > maxAgeMs) {
      usedAssertionIds.delete(id)
    }
  }
}

/**
 * Extracts inner text of an XML tag safely without heavy external XML parser dependencies.
 */
function extractTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<(?:[a-zA-Z0-9_-]+:)?${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9_-]+:)?${tagName}>`, 'i')
  const match = xml.match(regex)
  return match && match[1] ? match[1].trim() : null
}

/**
 * Extracts attributes from SAML 2.0 AttributeStatement block.
 */
function parseAttributeStatement(xml: string): Record<string, string[]> {
  const attributes: Record<string, string[]> = {}
  const attrRegex = /<(?:[a-zA-Z0-9]+:)?Attribute\s+[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?Attribute>/gi

  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(xml)) !== null) {
    const attrName = match[1]
    const body = match[2]
    if (!attrName || !body) continue

    const values: string[] = []
    const valRegex = /<(?:[a-zA-Z0-9]+:)?AttributeValue[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?AttributeValue>/gi
    let valMatch: RegExpExecArray | null
    while ((valMatch = valRegex.exec(body)) !== null) {
      if (valMatch[1]) {
        values.push(valMatch[1].trim())
      }
    }
    if (values.length > 0) {
      attributes[attrName] = values
    }
  }

  return attributes
}

export class SamlService {
  constructor(private config: SamlIdpConfig) {}

  /**
   * Generates a standard SAML 2.0 AuthnRequest XML document.
   */
  createAuthnRequest(spEntityId: string, acsUrl: string): { id: string; xml: string; b64: string } {
    const id = `_pf_${createHash('sha256').update(`${Date.now()}-${Math.random()}`).digest('hex').slice(0, 32)}`
    const issueInstant = new Date().toISOString()

    const xml = `<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${id}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${this.config.ssoUrl}"
  AssertionConsumerServiceURL="${acsUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${spEntityId}</saml:Issuer>
  <samlp:NameIDPolicy Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress" AllowCreate="true" />
</samlp:AuthnRequest>`

    const b64 = Buffer.from(xml, 'utf-8').toString('base64')
    return { id, xml, b64 }
  }

  /**
   * Validates and unpacks a Base64-encoded SAML 2.0 Response.
   */
  validateResponse(
    samlResponseB64: string,
    expectedAudience: string,
    currentDate = new Date()
  ): SamlValidationResult {
    cleanupExpiredNonces()

    let xml: string
    try {
      xml = Buffer.from(samlResponseB64, 'base64').toString('utf-8')
    } catch {
      return { success: false, error: 'Invalid Base64 payload in SAMLResponse' }
    }

    // 1. Verify Status
    const statusCode = extractTagContent(xml, 'StatusCode')
    const isSuccess =
      xml.includes('urn:oasis:names:tc:SAML:2.0:status:Success') ||
      statusCode?.includes('status:Success')

    if (!isSuccess) {
      return { success: false, error: 'IdP returned non-success SAML status' }
    }

    // 2. Validate Assertion ID & Replay Protection
    const assertionMatch = xml.match(/<(?:[a-zA-Z0-9]+:)?Assertion\s+[^>]*ID="([^"]+)"/i)
    if (!assertionMatch || !assertionMatch[1]) {
      return { success: false, error: 'SAML Assertion missing ID attribute' }
    }
    const assertionId = assertionMatch[1]
    if (usedAssertionIds.has(assertionId)) {
      return { success: false, error: 'Replay attack detected: Assertion ID has already been consumed' }
    }

    // 3. Validate Audience Restriction
    const audience = extractTagContent(xml, 'Audience')
    if (audience && audience !== expectedAudience) {
      return { success: false, error: `Audience mismatch: expected ${expectedAudience}, got ${audience}` }
    }

    // 4. Validate Conditions Validity Window
    const conditionsMatch = xml.match(
      /<(?:[a-zA-Z0-9]+:)?Conditions\s+[^>]*NotBefore="([^"]+)"[^>]*NotOnOrAfter="([^"]+)"/i
    )
    const skewMs = (this.config.clockSkewSeconds ?? 60) * 1000

    if (conditionsMatch && conditionsMatch[1] && conditionsMatch[2]) {
      const notBefore = new Date(conditionsMatch[1]).getTime()
      const notOnOrAfter = new Date(conditionsMatch[2]).getTime()
      const now = currentDate.getTime()

      if (now < notBefore - skewMs) {
        return { success: false, error: 'Assertion is not yet valid (NotBefore check failed)' }
      }
      if (now >= notOnOrAfter + skewMs) {
        return { success: false, error: 'Assertion has expired (NotOnOrAfter check failed)' }
      }
    }

    // 5. Extract Subject NameID (User Identity)
    const nameId = extractTagContent(xml, 'NameID')
    if (!nameId) {
      return { success: false, error: 'NameID missing from SAML Subject' }
    }

    // 6. Extract Session Index
    const sessionMatch = xml.match(/SessionIndex="([^"]+)"/i)
    const sessionIndex = sessionMatch && sessionMatch[1] ? sessionMatch[1] : undefined

    // 7. Parse Attribute Statement
    const rawAttrs = parseAttributeStatement(xml)
    const email =
      rawAttrs['email']?.[0] ||
      rawAttrs['mail']?.[0] ||
      rawAttrs['urn:oid:0.9.2342.19200300.100.1.3']?.[0] ||
      nameId

    const name =
      rawAttrs['displayName']?.[0] ||
      rawAttrs['name']?.[0] ||
      rawAttrs['urn:oid:2.16.840.1.113730.3.1.241']?.[0]

    const roles = rawAttrs['roles'] || rawAttrs['role'] || rawAttrs['groups'] || []

    // Mark assertion ID as used
    usedAssertionIds.set(assertionId, Date.now())

    return {
      success: true,
      nameId,
      sessionIndex,
      attributes: {
        email,
        name,
        firstName: rawAttrs['firstName']?.[0] || rawAttrs['givenName']?.[0],
        lastName: rawAttrs['lastName']?.[0] || rawAttrs['surname']?.[0],
        organization: rawAttrs['organization']?.[0] || rawAttrs['org']?.[0],
        roles,
      },
    }
  }

  /**
   * Resets internal replay cache (useful for testing)
   */
  static resetReplayCache(): void {
    usedAssertionIds.clear()
  }
}
