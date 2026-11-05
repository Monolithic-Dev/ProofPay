# Security Policy & Vulnerability Disclosure

ProofPay takes security, financial integrity, and privacy seriously. This document outlines our vulnerability disclosure policy, threat modeling, and defensive controls.

---

## 1. Reporting a Vulnerability

If you discover a security vulnerability or potential loophole in ProofPay (including authentication flaws, permission bypasses, IDOR, SSRF, or money path manipulation), please report it responsibly:

* **Email:** `security@proofpay.dev`
* **Response Window:** We acknowledge receipt within 24 hours.
* **Resolution Target:** Critical vulnerabilities are prioritized for resolution within 72 hours.
* **Scope:** Covers `src/`, API routes (`/api/v1/*`), worker jobs, and cryptographic verification libraries.

Please **do not** report issues through public GitHub issues or social media until they have been reviewed and mitigated.

---

## 2. STRIDE Threat Model & Mitigations

| Threat Category | Specific Attack Vector | ProofPay Mitigations |
|---|---|---|
| **Spoofing** | Compromised user sessions or forged API requests | Scoped service-account API keys, strict RBAC, rate-limiting, generic error messages. |
| **Tampering** | Malicious modifications to agreement terms or deliverables | SHA-256 hash chains covering canonical JSON payloads, Ed25519 decision attestations, Merkle transparency logs. |
| **Repudiation** | Denying an approval or deliverable submission | Double-entry event ledger recording every action with actor ID, timestamp, and linked PayPal debug IDs. |
| **Information Disclosure** | Cross-tenant data leaks or SSRF attacks | Organization-scoped database tenancy, automated IDOR route checks, and `safeFetch` SSRF guards blocking private subnets. |
| **Denial of Service** | Prompt injection payload bombs or huge file uploads | 1 MiB deliverable payload caps, strict Ajv schema depth limits, and deterministic Stage 1 pre-filters. |
| **Elevation of Privilege** | Autonomous agents attempting to release money | Strict architectural separation: **no agent or MCP tool possesses authority to release, refund, or void holds.** Payer authorizations require human approval. |

---

## 3. Cryptographic Verification & Transparency

Every verification outcome generates an Ed25519-signed attestation. Anyone can independently verify Proof Packs offline without trusting ProofPay's servers:

* **Offline Verifier:** [`https://proofpay.dev/verify`](https://proofpay.dev/verify)
* **Public Transparency Log:** [`https://proofpay.dev/transparency`](https://proofpay.dev/transparency)
* **Public Trust Center:** [`https://proofpay.dev/trust`](https://proofpay.dev/trust)
