/**
 * Decision Attestation & Merkle Transparency Log.
 * Implements docs/v2/01-NEXT-LEVEL-STRATEGY.md F1.
 *
 * Provides cryptographic attestation (Ed25519 signatures) and Merkle tree inclusion
 * proofs so any third party can verify ProofPay decisions without trusting the server.
 */
import { createHash, generateKeyPairSync, sign, verify } from 'crypto'

export interface DecisionAttestationPayload {
  contract_id: string
  milestone_key: string
  decision: 'PASS' | 'REJECT' | 'ESCALATE'
  criteria_hash: string
  timestamp_iso: string
  authority_id?: string
}

export interface SignedDecisionAttestation {
  payload: DecisionAttestationPayload
  signature: string
  public_key: string
}

export interface MerkleCheckpoint {
  checkpoint_id: string
  sequence: number
  merkle_root: string
  contract_count: number
  timestamp_iso: string
  signature: string
}

/** Formats decision payload into canonical string for signing */
export function formatAttestationMessage(payload: DecisionAttestationPayload): string {
  return [
    payload.contract_id,
    payload.milestone_key,
    payload.decision,
    payload.criteria_hash,
    payload.timestamp_iso,
  ].join('|')
}

/** Generates a new Ed25519 authority keypair */
export function generateEd25519KeyPair() {
  return generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
}

let defaultAuthorityKeypair: { publicKey: string; privateKey: string } | null = null

export function getOrCreateAuthorityKeyPair(): { publicKey: string; privateKey: string } {
  if (!defaultAuthorityKeypair) {
    defaultAuthorityKeypair = generateEd25519KeyPair()
  }
  return defaultAuthorityKeypair
}

export function createSignedDecision(payload: DecisionAttestationPayload): SignedDecisionAttestation {
  const { publicKey, privateKey } = getOrCreateAuthorityKeyPair()
  return signDecision(payload, privateKey, publicKey)
}
/** Signs a decision attestation using an Ed25519 private key */
export function signDecision(
  payload: DecisionAttestationPayload,
  privateKeyPem: string,
  publicKeyPem: string
): SignedDecisionAttestation {
  const msg = Buffer.from(formatAttestationMessage(payload))
  const sig = sign(null, msg, privateKeyPem).toString('base64')
  return {
    payload,
    signature: sig,
    public_key: publicKeyPem,
  }
}

/** Verifies a decision attestation signature */
export function verifyDecision(attestation: SignedDecisionAttestation): boolean {
  try {
    const msg = Buffer.from(formatAttestationMessage(attestation.payload))
    const sig = Buffer.from(attestation.signature, 'base64')
    return verify(null, msg, attestation.public_key, sig)
  } catch {
    return false
  }
}

/** Computes SHA-256 hash of two combined nodes */
function hashPair(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a] // deterministic sorted pairs
  return createHash('sha256').update(`${first}|${second}`).digest('hex')
}

export interface MerkleTreeResult {
  root: string
  leaves: string[]
  proofs: Map<string, string[]>
}

/** Builds a Merkle Tree from an array of leaf hashes */
export function buildMerkleTree(leaves: string[]): MerkleTreeResult {
  if (leaves.length === 0) {
    const emptyRoot = createHash('sha256').update('EMPTY_TREE').digest('hex')
    return { root: emptyRoot, leaves: [], proofs: new Map() }
  }

  const firstLeaf = leaves[0]!
  if (leaves.length === 1) {
    const proofs = new Map<string, string[]>()
    proofs.set(firstLeaf, [])
    return { root: firstLeaf, leaves, proofs }
  }

  const proofs = new Map<string, string[]>()
  for (const l of leaves) {
    proofs.set(l, [])
  }

  let currentLevel = [...leaves]

  while (currentLevel.length > 1) {
    const nextLevel: string[] = []
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i]!
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1]! : left

      for (const [leaf, proof] of proofs.entries()) {
        if (leaf === left) {
          proof.push(right)
        } else if (leaf === right) {
          proof.push(left)
        }
      }

      nextLevel.push(hashPair(left, right))
    }
    currentLevel = nextLevel
  }

  return {
    root: currentLevel[0] || '',
    leaves,
    proofs,
  }
}

/** Validates that a leaf exists in the Merkle root given an inclusion proof */
export function verifyInclusionProof(leaf: string, proof: string[], expectedRoot: string): boolean {
  if (proof.length === 0) {
    return leaf === expectedRoot
  }

  let current = leaf
  for (const sibling of proof) {
    current = hashPair(current, sibling)
  }
  return current === expectedRoot
}
