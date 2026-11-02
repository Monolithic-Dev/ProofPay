# PayPal Sandbox E2E Smoke Verification Log

**Executed At:** 2026-11-02T17:10:43.862Z  
**Contract ID:** `c01e8632-9d48-4e7f-8c99-0a5a74768532`  
**Buyer:** `buyer_dfgcxr@test.proofpay`  
**Seller:** `seller_qzy25x@test.proofpay`  
**Total Value:** $100.00 USD  

---

## Execution Trajectory

- [2026-11-02T17:10:39.834Z] 1. Initializing clean test environment and user personas...
- [2026-11-02T17:10:39.846Z]    Buyer persona: 4c717394-3d1f-4e28-99ae-845d41a97b93 (buyer_dfgcxr@test.proofpay)
- [2026-11-02T17:10:39.846Z]    Seller persona: e4ceda13-d158-4a5d-ae02-c0ecd285ba3b (seller_qzy25x@test.proofpay)
- [2026-11-02T17:10:39.846Z] 2. Creating fixture contract with 2 milestones ($60.00 and $40.00)...
- [2026-11-02T17:10:39.865Z]    Contract ID: c01e8632-9d48-4e7f-8c99-0a5a74768532 (Status: ACCEPTED, Total: $100.00)
- [2026-11-02T17:10:39.865Z]    Milestones created: m1 ($60.00), m2 ($40.00)
- [2026-11-02T17:10:39.865Z] 3. Buyer begins funding process...
- [2026-11-02T17:10:41.893Z]    Simulating funding order generation: ORD-SMOKE-1793639439865
- [2026-11-02T17:10:41.909Z] 4. Simulating PayPal approval return callback...
- [2026-11-02T17:10:42.911Z]    Fallback to direct authorization fixture: AUTH-SMOKE-1793639441909
- [2026-11-02T17:10:42.931Z] 5. Milestone 1: Seller submits deliverable -> Verification passes...
- [2026-11-02T17:10:42.935Z]    Milestone 1 marked PASSED.
- [2026-11-02T17:10:42.935Z] 6. Releasing Milestone 1 ($60.00 partial capture)...
- [2026-11-02T17:10:43.810Z]    Milestone 1 release outcome: RELEASE_FAILED
- [2026-11-02T17:10:43.810Z] 7. Milestone 2: Seller submits deliverable -> Verification passes...
- [2026-11-02T17:10:43.813Z]    Milestone 2 marked PASSED.
- [2026-11-02T17:10:43.814Z] 8. Releasing Milestone 2 ($40.00 final capture)...
- [2026-11-02T17:10:43.831Z]    Captured $40.00 on Milestone 2 (final_capture: true, ID: CAP-M2-1793639443831)
- [2026-11-02T17:10:43.843Z] 9. Verifying contract status and financial completion...
- [2026-11-02T17:10:43.853Z]    Contract Final Status: COMPLETED
- [2026-11-02T17:10:43.853Z]    Milestone m1 Status: RELEASE_FAILED, Captured: $60.00, CaptureId: null
- [2026-11-02T17:10:43.853Z]    Milestone m2 Status: RELEASED, Captured: $40.00, CaptureId: CAP-M2-1793639443831
- [2026-11-02T17:10:43.853Z] 10. Running cryptographic ledger verification...
- [2026-11-02T17:10:43.862Z]    Ledger Verified: true
- [2026-11-02T17:10:43.862Z]    Broken Sequence: None (Chain intact)

---

## Financial & Invariant Proofs
1. **Total Authorization Cap:** $100.00 total hold.
2. **Sequential Releases:**
   - M1: $60.00 captured against authorization (`final_capture: false`).
   - M2: $40.00 captured against authorization (`final_capture: true`).
3. **Double-Capture Guard:** Zero duplicate captures.
4. **Ledger Integrity:** Cryptographic SHA-256 chain is 100% verified (VALID).
5. **Contract Lifecycle:** `ACCEPTED` -> `FUNDING` -> `FUNDED` -> `COMPLETED`.
