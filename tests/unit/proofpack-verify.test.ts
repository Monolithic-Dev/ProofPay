import { describe, it, expect } from 'vitest'
import { verifyProofPack, sha256Hex, canonicalize, ZERO_HASH } from '@/lib/proofpack/verify'

describe('Offline Proof Pack Verifier', () => {
  it('successfully verifies a valid Proof Pack chain', async () => {
    const contractId = 'c1111111-1111-1111-1111-111111111111'
    const date1 = new Date('2026-11-03T10:00:00.000Z').toISOString()
    const payload1 = { amount_minor: 5000, action: 'hold_created' }
    const hash1 = await sha256Hex(
      [ZERO_HASH, contractId, '1', 'PAYPAL_AUTHORIZATION_CREATED', canonicalize(payload1), date1].join('|')
    )

    const date2 = new Date('2026-11-03T11:00:00.000Z').toISOString()
    const payload2 = { amount_minor: 2500, milestone_key: 'm1' }
    const hash2 = await sha256Hex(
      [hash1, contractId, '2', 'PAYPAL_CAPTURE_COMPLETED', canonicalize(payload2), date2].join('|')
    )

    const samplePack = {
      contract: { id: contractId },
      ledger: [
        {
          seq: 1,
          type: 'PAYPAL_AUTHORIZATION_CREATED',
          payload: payload1,
          prev_hash: ZERO_HASH,
          hash: hash1,
          created_at: date1,
        },
        {
          seq: 2,
          type: 'PAYPAL_CAPTURE_COMPLETED',
          payload: payload2,
          prev_hash: hash1,
          hash: hash2,
          created_at: date2,
        },
      ],
    }

    const res = await verifyProofPack(samplePack)
    expect(res.valid).toBe(true)
    expect(res.eventsChecked).toBe(2)
  })

  it('detects tampering when payload is modified', async () => {
    const contractId = 'c1111111-1111-1111-1111-111111111111'
    const date1 = new Date('2026-11-03T10:00:00.000Z').toISOString()
    const payload1 = { amount_minor: 5000, action: 'hold_created' }
    const hash1 = await sha256Hex(
      [ZERO_HASH, contractId, '1', 'PAYPAL_AUTHORIZATION_CREATED', canonicalize(payload1), date1].join('|')
    )

    const tamperedPack = {
      contract: { id: contractId },
      ledger: [
        {
          seq: 1,
          type: 'PAYPAL_AUTHORIZATION_CREATED',
          payload: { amount_minor: 999999, action: 'hold_created' }, // TAMPERED!
          prev_hash: ZERO_HASH,
          hash: hash1,
          created_at: date1,
        },
      ],
    }

    const res = await verifyProofPack(tamperedPack)
    expect(res.valid).toBe(false)
    expect(res.brokenAtSeq).toBe(1)
    expect(res.error).toMatch(/Tampering detected at event #1/)
  })
})
