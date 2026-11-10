/**
 * Sample Proof Pack Builder for Offline Verification & Time-Travel Demos.
 * Uses real canonical JSON serialization and SHA-256 hash chaining so
 * browser WebCrypto / Node verification passes 100% authentically.
 */
import { canonicalize, sha256Hex, ZERO_HASH, type ProofPackEvent } from './verify'

export const SAMPLE_CONTRACT_ID = 'e9c8a7b6-1234-4567-89ab-cdef01234567'

export interface SampleProofPack {
  version: number
  generated_at: string
  disclaimer: string
  contract: {
    id: string
    title: string
    total_minor: number
    currency: string
    buyer_email: string
    seller_email: string
    canonical: {
      id: string
      title: string
      total_minor: number
      currency: string
      milestones: Array<{ key: string; title: string; amount_minor: number }>
    }
    hash: string
  }
  ledger: ProofPackEvent[]
}

const RAW_SAMPLE_EVENTS: Array<{
  seq: number
  type: string
  actor_type: string
  created_at: string
  payload: Record<string, unknown>
}> = [
  {
    seq: 1,
    type: 'CONTRACT_CREATED',
    actor_type: 'buyer',
    created_at: '2026-11-03T09:50:00.000Z',
    payload: {
      title: 'E-commerce Product Catalog Scraping & Normalization',
      total_minor: 15000,
    },
  },
  {
    seq: 2,
    type: 'CONTRACT_PROPOSED',
    actor_type: 'buyer',
    created_at: '2026-11-03T09:54:00.000Z',
    payload: {
      seller_id: 'seller-agentic-sol',
      total_minor: 15000,
    },
  },
  {
    seq: 3,
    type: 'CONTRACT_ACCEPTED',
    actor_type: 'seller',
    created_at: '2026-11-03T09:57:00.000Z',
    payload: {
      seller_id: 'seller-agentic-sol',
      method: 'counterparty_invitation',
    },
  },
  {
    seq: 4,
    type: 'PAYPAL_AUTHORIZATION_CREATED',
    actor_type: 'buyer',
    created_at: '2026-11-03T10:00:00.000Z',
    payload: {
      amount_minor: 15000,
      currency: 'USD',
      paypal_order_id: 'ORDER-89A7654321',
      paypal_authorization_id: 'AUTH-1234567890',
      authorization_id: 'AUTH-1234567890',
      note: 'PayPal authorization hold established on buyer funding source',
    },
  },
  {
    seq: 5,
    type: 'MILESTONE_SUBMITTED',
    actor_type: 'seller',
    created_at: '2026-11-03T10:08:00.000Z',
    payload: {
      milestone_key: 'm1',
      amount_minor: 7500,
      submission_id: 'sub-catalog-m1-v1',
      sha256: '4a7f2108c9d0b1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6',
    },
  },
  {
    seq: 6,
    type: 'DELIVERABLE_VERIFIED',
    actor_type: 'verifier',
    created_at: '2026-11-03T10:15:00.000Z',
    payload: {
      milestone_key: 'm1',
      decision: 'PASS',
      confidence: 0.99,
      deterministic_schema_passed: true,
      llm_rubric_score: 96,
      verified_quotes_count: 3,
      evidence_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
  },
  {
    seq: 7,
    type: 'PAYPAL_CAPTURE_COMPLETED',
    actor_type: 'paypal',
    created_at: '2026-11-03T10:30:00.000Z',
    payload: {
      milestone_key: 'm1',
      amount_minor: 7500,
      currency: 'USD',
      capture_id: 'CAP-9988776655',
      paypal_capture_id: 'CAP-9988776655',
      remaining_hold_minor: 7500,
    },
  },
]

export async function buildValidSampleProofPack(): Promise<SampleProofPack> {
  const canonicalContract = {
    id: SAMPLE_CONTRACT_ID,
    title: 'E-commerce Product Catalog Scraping & Normalization',
    total_minor: 15000,
    currency: 'USD',
    milestones: [
      { key: 'm1', title: 'Raw JSON Catalog Extract (5,000 SKUs)', amount_minor: 7500 },
      { key: 'm2', title: 'Normalized Taxonomy & Price History', amount_minor: 7500 },
    ],
  }

  const contractDigest = await sha256Hex(canonicalize(canonicalContract))

  const ledger: ProofPackEvent[] = []
  let prevHash = ZERO_HASH

  for (const item of RAW_SAMPLE_EVENTS) {
    const payload =
      item.type === 'CONTRACT_PROPOSED'
        ? { ...item.payload, contract_hash: contractDigest }
        : item.payload

    const createdIso = new Date(item.created_at).toISOString()
    const raw = [
      prevHash,
      SAMPLE_CONTRACT_ID,
      String(item.seq),
      item.type,
      canonicalize(payload),
      createdIso,
    ].join('|')

    const hash = await sha256Hex(raw)

    ledger.push({
      seq: item.seq,
      type: item.type,
      actor_type: item.actor_type,
      payload,
      prev_hash: prevHash,
      hash,
      created_at: createdIso,
    })

    prevHash = hash
  }

  return {
    version: 1,
    generated_at: '2026-11-03T10:35:00.000Z',
    disclaimer:
      'Authorization hold, not escrow. Verified client-side via canonical SHA-256 hash chaining.',
    contract: {
      id: SAMPLE_CONTRACT_ID,
      title: canonicalContract.title,
      total_minor: canonicalContract.total_minor,
      currency: 'USD',
      buyer_email: 'procurement-team@acme-corp.com',
      seller_email: 'data-engineers@agentic-sol.io',
      canonical: canonicalContract,
      hash: contractDigest,
    },
    ledger,
  }
}

export async function createTamperedSampleProofPack(): Promise<SampleProofPack> {
  const valid = await buildValidSampleProofPack()
  const tampered = JSON.parse(JSON.stringify(valid)) as SampleProofPack
  const lastEvent = tampered.ledger[tampered.ledger.length - 1]
  if (lastEvent) {
    lastEvent.payload = {
      ...lastEvent.payload,
      amount_minor: 999999,
    }
  }
  return tampered
}

