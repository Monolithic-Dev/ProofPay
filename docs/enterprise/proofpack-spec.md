# ProofPack Specification (v0.1)

> **Standard:** Open ProofPack Protocol · **Version:** 0.1 · **Status:** Draft / Active  
> **Inspired by:** in-toto Attestations v1.0, Dead Simple Signing Envelope (DSSE), RFC 3161

---

## 1. Abstract

A **ProofPack** is a self-contained, cryptographically signed, and independently verifiable archive that records the lifecycle of a milestone payment settlement between two parties (human or autonomous agent).

ProofPacks enable **offline, zero-knowledge verification**: anyone possessing the ProofPack archive can verify the integrity of deliverables, the satisfaction of acceptance criteria, the cryptographic attestation of the verification oracle, and the settlement event on PayPal rails without access to ProofPay's databases or internal APIs.

---

## 2. Archive Structure

A ProofPack is distributed as a ZIP archive or serialized JSON bundle (`proofpack.json`) containing:

```
proofpack.zip
├── manifest.json              # Top-level manifest and SHA-256 file catalog
├── contract.json              # Canonical contract specification and acceptance criteria
├── deliverable/               # Exact deliverable submitted by worker/agent
│   └── artifact.json / .csv   # Verified deliverable payload
├── attestation.dsse.json      # In-toto / DSSE formatted signed attestation envelope
├── tsa-token.tst              # RFC 3161 cryptographic timestamp token from external TSA
└── ledger.chain.json          # Double-entry ledger cryptographic hash chain
```

---

## 3. DSSE Signing Envelope Specification

The attestation is formatted in compliance with the **DSSE (Dead Simple Signing Envelope)** standard:

```json
{
  "payloadType": "application/vnd.in-toto+json",
  "payload": "<Base64-encoded in-toto Statement>",
  "signatures": [
    {
      "keyid": "proofpay-verifier-oracle-2026-v1",
      "sig": "<Base64-encoded ECDSA or Ed25519 signature>"
    }
  ]
}
```

### Decoded In-Toto Statement:
```json
{
  "_type": "https://in-toto.io/Statement/v1",
  "subject": [
    {
      "name": "deliverable/artifact.json",
      "digest": {
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
      }
    }
  ],
  "predicateType": "https://proofpay.io/attestation/v1",
  "predicate": {
    "contractId": "ct_01HXYZ...",
    "milestoneId": "ms_01HABC...",
    "evaluator": "ProofPay-Deterministic-Oracle-v2",
    "verdict": "PASSED",
    "checksSummary": {
      "deterministicChecksPassed": 4,
      "deterministicChecksTotal": 4,
      "manipulationSeverity": "NONE",
      "entropyScore": 3.84
    },
    "settlement": {
      "paypalOrderId": "4WT25578C5037015R",
      "captureAmountUSD": "25.00",
      "captureTimestamp": "2026-11-06T18:10:45Z"
    }
  }
}
```

---

## 4. Verification Algorithm (Offline)

An independent verifier verifies a ProofPack in 5 steps:

1. **Digest Calculation:** Calculate `SHA-256(deliverable/artifact)`.
2. **Attestation Match:** Confirm calculated digest matches `subject[0].digest.sha256` in the in-toto statement.
3. **Signature Verification:** Verify DSSE signature using ProofPay's published public verification key.
4. **Timestamp Verification:** Validate the RFC 3161 TSA token (`tsa-token.tst`) against the statement hash.
5. **Ledger Hash Chain:** Verify `previousHash` linking across all ledger events leading to `PAYMENT_CAPTURED`.

When all 5 checks succeed, the settlement is mathematically proven.

