# Automated 1099-K & W-9 Tax Compliance Engine

> **Enterprise Pillar 1 & 4 — Legal Compliance & Financial Defense**

## Overview

ProofPay automatically calculates and tracks contractor cumulative milestone payout volumes to enforce IRS Form 1099-K statutory reporting thresholds and W-9 collection requirements.

## Reporting Rules & Thresholds

| Jurisdiction | Gross Payout Threshold | Transaction Count | Trigger Action |
|---|---|---|---|
| **Federal (IRS)** | **$5,000 USD** | Any count | Automated 1099-K Annual Filing |
| **Federal Warning** | **$4,000 USD** (80%) | Any count | W-9 Form Collection Notice |
| **Massachusetts (MA)** | **$600 USD** | Any count | State 1099-K Filing |
| **Virginia (VA)** | **$600 USD** | Any count | State 1099-K Filing |
| **Maryland (MD)** | **$600 USD** | Any count | State 1099-K Filing |
| **Illinois (IL)** | **$1,000 USD** | >= 4 transactions | State 1099-K Filing |

## Statutory Backup Withholding

If a contractor exceeds reporting thresholds (or reaches the 80% collection window) and fails to provide a verified Taxpayer Identification Number (TIN / SSN / EIN), the platform automatically flags **24% IRS statutory backup withholding** on subsequent milestone releases.

## Usage

```typescript
import { evaluateTaxCompliance } from '@/server/tax/compliance'

const taxStatus = evaluateTaxCompliance({
  sellerId: 'user-seller-123',
  taxYear: 2026,
  grossVolumeMinor: 520000, // $5,200.00
  transactionCount: 8,
  w9OnFile: true,
  tinVerified: true,
  sellerStateCode: 'CA',
})

if (taxStatus.isReportable1099K) {
  // Enqueue 1099-K reporting record for annual tax bundle
}
```

