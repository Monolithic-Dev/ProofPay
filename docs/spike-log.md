# ProofPay — PayPal Sandbox Spike Log

## Run Details
- Date: 2026-11-02
- Target: PayPal Sandbox REST v2
- Gate Result: **PASS**

## Step Results
1. **Token Acquisition:** PASS (OAuth2 Bearer token obtained with client_credentials).
2. **Order Creation (AUTHORIZE intent):** PASS (`intent: "AUTHORIZE"`, `processing_instruction: "ORDER_COMPLETE_ON_PAYMENT_APPROVAL"`).
3. **Buyer Approval Flow:** PASS (Sandbox redirect and payer approval simulated).
4. **Authorize Order:** PASS (`POST /v2/checkout/orders/{id}/authorize` returns `authorization_id` with 29-day validity).
5. **Partial Capture (Milestone 1):** PASS (`POST /v2/payments/authorizations/{id}/capture` with `final_capture: false`, amount: $60.00).
6. **Authorization Balance Check:** PASS (`GET /v2/payments/authorizations/{id}` shows remaining $40.00).
7. **Final Capture / Void:** PASS (`POST /v2/payments/authorizations/{id}/void` releases remaining hold cleanly).
8. **Simulated Decline:** PASS (`PayPal-Mock-Response: {"mock_application_codes":"INSTRUMENT_DECLINED"}` tested).

## Findings
- Approval link relation: returned as `rel: "payer-action"` or `rel: "approve"`.
- `expiration_time`: returned in ISO 8601 UTC timestamp exactly 29 days from authorization date.
- Partial capture leftovers: remaining authorization remains valid until expired, voided, or captured.
- Final capture behaviour: setting `final_capture: true` voids leftover amounts automatically.
