# Cloud KMS & HSM Key Custody Engine

> **Enterprise Pillar 1 & 4 — Cryptographic Key Custody & FIPS 140-2 Level 3 Compliance**

## Overview

ProofPay abstracts authority cryptographic signing behind a **Hardware Security Module (HSM) / Cloud KMS** interface.

In production environments, platform root signing keys never reside in plaintext on disk, containers, or environment variables. All digital attestations (decision certificates, Merkle root transparency checkpoints) are signed via secure cryptographic RPCs against hardware-isolated security modules.

## Architecture

```
+--------------------------------------------------------------+
| ProofPay Settlement Engine (Apply Decision / ProofPack)     |
+--------------------------------------------------------------+
                               |
                               v
+--------------------------------------------------------------+
| KmsKeyProvider Abstraction (kmsSign / kmsVerify)            |
+--------------------------------------------------------------+
                |                               |
                v                               v
+-------------------------------+ +----------------------------+
| LocalMemoryKeyProvider        | | CloudKmsKeyProvider        |
| (Dev, Testing, Air-gapped CI) | | (AWS KMS / GCP Cloud KMS)  |
| Ed25519 in-memory generation  | | FIPS 140-2 Level 3 HSM     |
+-------------------------------+ +----------------------------+
```

## Security Guarantees

1. **Private Key Isolation**: Private key bytes are never extracted into application heap memory.
2. **Key Rotation Tracking**: Every signature result attaches the active `keyId`, `keyVersion`, and `provider` tag for complete auditability.
3. **FIPS 140-2 Compliance**: Supports cloud hardware modules evaluated under NIST FIPS 140-2 Level 3 standards.

## Usage

```typescript
import { kmsSign, kmsVerify } from '@/lib/crypto/kms-signer'

// 1. Sign milestone verdict attestation
const signature = await kmsSign(Buffer.from(attestationPayload))

// 2. Verify signature using tagged public key
const isValid = kmsVerify(
  Buffer.from(attestationPayload),
  signature.signatureBase64,
  signature.publicKeyPem
)
```

