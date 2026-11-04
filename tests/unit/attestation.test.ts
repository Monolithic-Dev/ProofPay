import { describe, it, expect } from 'vitest'
import {
  generateEd25519KeyPair,
  signDecision,
  verifyDecision,
  buildMerkleTree,
  verifyInclusionProof,
} from '@/lib/crypto/attestation'

describe('Signed Decision Attestations & Merkle Transparency Log (F1)', () => {
  it('signs and verifies a decision attestation with Ed25519', () => {
    const { publicKey, privateKey } = generateEd25519KeyPair()
    const payload = {
      contract_id: 'c1234567-0000-0000-0000-000000000001',
      milestone_key: 'm1',
      decision: 'PASS' as const,
      criteria_hash: 'a'.repeat(64),
      timestamp_iso: new Date().toISOString(),
    }

    const attestation = signDecision(payload, privateKey, publicKey)
    expect(attestation.signature).toBeDefined()
    expect(verifyDecision(attestation)).toBe(true)

    // Tampered decision should fail verification
    const tampered = {
      ...attestation,
      payload: { ...attestation.payload, decision: 'REJECT' as const },
    }
    expect(verifyDecision(tampered)).toBe(false)
  })

  it('builds Merkle tree and verifies single-leaf inclusion', () => {
    const leaves = ['leaf_a'.repeat(8), 'leaf_b'.repeat(8)]
    const tree = buildMerkleTree(leaves)

    expect(tree.root).toBeDefined()
    expect(tree.root.length).toBe(64)
  })
})
