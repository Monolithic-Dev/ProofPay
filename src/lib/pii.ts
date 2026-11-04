/**
 * PII Shield — Deterministic privacy redactor for AI calls.
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md U5 & F7.
 *
 * Masks sensitive personal data (emails, phones, payment cards, SSNs, IPs)
 * before sending deliverable text to external LLM providers.
 */

export type PiiCategory = 'email' | 'phone' | 'card' | 'ssn' | 'ip'

export interface RedactionResult {
  maskedText: string
  redactionCount: number
  redactionsByType: Record<PiiCategory, number>
  unmask: (text: string) => string
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g
const CARD_REGEX = /\b(?:\d{4}[- ]?){3}\d{4}\b|\b\d{15,16}\b/g
const SSN_REGEX = /\b\d{3}-\d{2}-\d{4}\b/g
const IP_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g

export function maskPii(inputText: string): RedactionResult {
  if (!inputText || typeof inputText !== 'string') {
    return {
      maskedText: inputText || '',
      redactionCount: 0,
      redactionsByType: { email: 0, phone: 0, card: 0, ssn: 0, ip: 0 },
      unmask: (t) => t,
    }
  }

  const tokenToOriginal = new Map<string, string>()
  const redactionsByType: Record<PiiCategory, number> = {
    email: 0,
    phone: 0,
    card: 0,
    ssn: 0,
    ip: 0,
  }

  let counter = 0
  let working = inputText

  // 1. Emails
  working = working.replace(EMAIL_REGEX, (match) => {
    counter++
    redactionsByType.email++
    const token = `[REDACTED_EMAIL_${counter}]`
    tokenToOriginal.set(token, match)
    return token
  })

  // 2. SSNs
  working = working.replace(SSN_REGEX, (match) => {
    counter++
    redactionsByType.ssn++
    const token = `[REDACTED_SSN_${counter}]`
    tokenToOriginal.set(token, match)
    return token
  })

  // 3. Payment cards
  working = working.replace(CARD_REGEX, (match) => {
    const digitsOnly = match.replace(/[- ]/g, '')
    if (digitsOnly.length >= 13 && digitsOnly.length <= 19) {
      counter++
      redactionsByType.card++
      const token = `[REDACTED_CARD_${counter}]`
      tokenToOriginal.set(token, match)
      return token
    }
    return match
  })

  // 4. Phones
  working = working.replace(PHONE_REGEX, (match) => {
    counter++
    redactionsByType.phone++
    const token = `[REDACTED_PHONE_${counter}]`
    tokenToOriginal.set(token, match)
    return token
  })

  // 5. IP Addresses
  working = working.replace(IP_REGEX, (match) => {
    const parts = match.split('.').map(Number)
    if (parts.every((p) => p >= 0 && p <= 255)) {
      counter++
      redactionsByType.ip++
      const token = `[REDACTED_IP_${counter}]`
      tokenToOriginal.set(token, match)
      return token
    }
    return match
  })

  const unmask = (text: string): string => {
    let result = text
    for (const [token, original] of tokenToOriginal.entries()) {
      result = result.replaceAll(token, original)
    }
    return result
  }

  return {
    maskedText: working,
    redactionCount: counter,
    redactionsByType,
    unmask,
  }
}
