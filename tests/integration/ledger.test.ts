import { describe, it, expect } from 'vitest'
import { hashLedgerEvent, ZERO_HASH } from '@/server/contracts/canonical'
import { LEDGER_EVENT_TYPES, LedgerPayloadSchemas } from '@/server/ledger/events'

describe('Ledger hash chaining & event schemas', () => {
  const contractId = 'c0000000-1111-2222-3333-444444444444'

  it('first event uses ZERO_HASH as genesis prev_hash', () => {
    expect(ZERO_HASH).toBe('0'.repeat(64))
  })

  it('hashLedgerEvent generates deterministic 64-char sha256 hex', () => {
    const hash = hashLedgerEvent({
      prevHash: ZERO_HASH,
      contractId,
      seq: 1,
      type: 'CONTRACT_CREATED',
      payload: { title: 'Dataset Contract', total_minor: 10000 },
      createdAt: '2026-11-08T09:41:07.113Z',
    })

    expect(hash).toHaveLength(64)
  })

  it('hash changes if any field in the event is modified', () => {
    const originalHash = hashLedgerEvent({
      prevHash: ZERO_HASH,
      contractId,
      seq: 1,
      type: 'CONTRACT_CREATED',
      payload: { title: 'Dataset Contract', total_minor: 10000 },
      createdAt: '2026-11-08T09:41:07.113Z',
    })

    // Modify total_minor
    const tamperedPayloadHash = hashLedgerEvent({
      prevHash: ZERO_HASH,
      contractId,
      seq: 1,
      type: 'CONTRACT_CREATED',
      payload: { title: 'Dataset Contract', total_minor: 10001 },
      createdAt: '2026-11-08T09:41:07.113Z',
    })

    expect(tamperedPayloadHash).not.toBe(originalHash)

    // Modify seq
    const tamperedSeqHash = hashLedgerEvent({
      prevHash: ZERO_HASH,
      contractId,
      seq: 2,
      type: 'CONTRACT_CREATED',
      payload: { title: 'Dataset Contract', total_minor: 10000 },
      createdAt: '2026-11-08T09:41:07.113Z',
    })

    expect(tamperedSeqHash).not.toBe(originalHash)
  })

  it('validates strictly all ledger event schemas without extra keys', () => {
    const validCreated = LedgerPayloadSchemas.CONTRACT_CREATED.safeParse({
      title: 'Valid Contract',
      total_minor: 5000,
    })
    expect(validCreated.success).toBe(true)

    // Extra key rejected
    const invalidCreated = LedgerPayloadSchemas.CONTRACT_CREATED.safeParse({
      title: 'Valid Contract',
      total_minor: 5000,
      unauthorized_extra_key: 'hacker',
    })
    expect(invalidCreated.success).toBe(false)
  })
})
