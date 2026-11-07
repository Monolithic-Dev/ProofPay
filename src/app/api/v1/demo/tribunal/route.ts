/**
/**
 * Multi-Agent AI Dispute Tribunal API Route — /api/v1/demo/tribunal
 * Simulates autonomous AI agents debating deliverable disputes and issuing binding PayPal settlements.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { env } from '@/server/config/env'
import { AppError } from '@/server/util/errors'

export interface TribunalTurn {
  id: string
  speaker: 'buyer_advocate' | 'seller_defense' | 'neutral_arbitrator'
  speakerName: string
  avatar: string
  roleTitle: string
  statement: string
  citedEvidence?: string
  confidence: number
}

export interface DisputeScenario {
  id: string
  title: string
  holdAmountMinor: number
  currency: string
  contractTitle: string
  buyerClaim: string
  sellerDefense: string
  turns: TribunalTurn[]
  verdict: {
    summary: string
    sellerCapturePercent: number
    sellerCaptureMinor: number
    buyerVoidMinor: number
    paypalAction: 'PARTIAL_CAPTURE_AND_VOID' | 'FULL_VOID' | 'FULL_CAPTURE'
    paypalPayload: Record<string, unknown>
    bindingJustification: string
  }
}

export const SCENARIOS: DisputeScenario[] = [
  {
    id: 'ambiguous_dataset',
    title: 'Autonomous Training Dataset Dispute',
    holdAmountMinor: 2000, // $20.00
    currency: 'USD',
    contractTitle: 'High-Accuracy Sentiment Training Dataset (1,000 Samples)',
    buyerClaim: 'Deliverable has ~12% noisy labels. Buyer agent demands full $20.00 authorization void.',
    sellerDefense: 'Contract specified >85% accuracy. Empirical benchmark confirms 88.2% validity.',
    turns: [
      {
        id: 'turn-1',
        speaker: 'buyer_advocate',
        speakerName: 'SentinelBot',
        avatar: '🛡️',
        roleTitle: 'Buyer Advocate LLM',
        statement:
          'Objection to capture: Clause §2.1 defines sentiment classification for production models. We sampled 100 rows and identified 12 false positives, impairing downstream fine-tuning. Full authorization hold should be voided back to buyer funding source.',
        citedEvidence: 'Evaluation batch sample #12-24: misclassified sarcastic review sentences.',
        confidence: 0.94,
      },
      {
        id: 'turn-2',
        speaker: 'seller_defense',
        speakerName: 'LexiBot',
        avatar: '🛠️',
        roleTitle: 'Seller Defense LLM',
        statement:
          'Rebuttal: The deterministic schema contract explicitly accepted a noise floor up to 15% under ambiguous colloquial tone. 882 of 1,000 records have unanimous triple-annotator consensus. Deliverable meets contracted milestone thresholds.',
        citedEvidence: 'Deliverable SHA-256 hash e3b0c442: 88.2% accuracy exceeds agreed 85.0% SLA.',
        confidence: 0.96,
      },
      {
        id: 'turn-3',
        speaker: 'neutral_arbitrator',
        speakerName: 'JusticeBot',
        avatar: '⚖️',
        roleTitle: 'Neutral Chief Arbitrator',
        statement:
          'Verdict rendered: The seller met the primary objective accuracy criteria of 85.0%, but the edge-case sarcastic text caused 11.8% defect density in sub-category B. Under ProofPay Equitable Settlement Doctrine, a partial capture is commanded.',
        citedEvidence: 'Deterministic rubric pass with minor quality deduction. 75% capture / 25% void.',
        confidence: 0.99,
      },
    ],
    verdict: {
      summary: 'Equitable Partial Resolution: 75% Capture to Seller ($15.00), 25% Void to Buyer ($5.00)',
      sellerCapturePercent: 75,
      sellerCaptureMinor: 1500,
      buyerVoidMinor: 500,
      paypalAction: 'PARTIAL_CAPTURE_AND_VOID',
      paypalPayload: {
        method: 'POST /v2/payments/authorizations/AUTH-99238471/capture',
        headers: { 'PayPal-Request-Id': 'req_arb_75_capture' },
        body: {
          amount: { value: '15.00', currency_code: 'USD' },
          is_final_capture: true,
          note_to_payer: 'ProofPay Arbitrated Settlement: $15.00 captured; remaining $5.00 hold auto-voided to buyer.',
        },
      },
      bindingJustification:
        'Seller proved 88.2% fulfillment above the minimum threshold. Buyer is compensated with a $5.00 void for label scrubbing overhead.',
    },
  },
  {
    id: 'hallucinated_code',
    title: 'Adversarial / Hallucinated Agent Code Deliverable',
    holdAmountMinor: 3500, // $35.00
    currency: 'USD',
    contractTitle: 'Automated Stripe to PayPal Invoicing Bridge Module',
    buyerClaim: 'Worker submitted non-compiling TypeScript code with fake hallucinated SDK imports.',
    sellerDefense: 'Worker claims code is conceptual boilerplate and buyer should debug remaining imports.',
    turns: [
      {
        id: 'turn-1',
        speaker: 'buyer_advocate',
        speakerName: 'SentinelBot',
        avatar: '🛡️',
        roleTitle: 'Buyer Advocate LLM',
        statement:
          'Immediate breach of contract: The submitted deliverable failed typescript compiler execution (Exit code 2: Cannot find module @paypal/v3-enterprise-mock). This was generated by an unverified LLM with hallucinated libraries.',
        citedEvidence: 'CI Execution Log: 14 syntax errors, 0 tests passing.',
        confidence: 0.99,
      },
      {
        id: 'turn-2',
        speaker: 'seller_defense',
        speakerName: 'LexiBot',
        avatar: '🛠️',
        roleTitle: 'Seller Defense LLM',
        statement:
          'Defense: Worker provided the architecture structure requested. The milestone description did not mandate complete zero-warning production build.',
        citedEvidence: 'Code artifact size: 12.4 KB across 3 modules.',
        confidence: 0.62,
      },
      {
        id: 'turn-3',
        speaker: 'neutral_arbitrator',
        speakerName: 'JusticeBot',
        avatar: '⚖️',
        roleTitle: 'Neutral Chief Arbitrator',
        statement:
          'Verdict rendered: Deterministic check failed. ProofPay Zero-Custody Rule 1 mandates that code deliverables must compile to satisfy contract criteria. Full void of PayPal authorization hold is ordered. Zero funds captured.',
        citedEvidence: 'Deterministic lint failure: AST invalid, compiler failure. 0% capture awarded.',
        confidence: 1.0,
      },
    ],
    verdict: {
      summary: 'Full Void Mandated: 0% Capture to Seller ($0.00), 100% Void to Buyer ($35.00)',
      sellerCapturePercent: 0,
      sellerCaptureMinor: 0,
      buyerVoidMinor: 3500,
      paypalAction: 'FULL_VOID',
      paypalPayload: {
        method: 'POST /v2/payments/authorizations/AUTH-88371920/void',
        headers: { 'PayPal-Request-Id': 'req_arb_full_void' },
        body: {
          note: 'ProofPay Arbitrated Settlement: Contract criteria breached due to compilation failure. 100% hold voided back to buyer.',
        },
      },
      bindingJustification:
        'Zero-Custody financial invariant upheld: Buyer funds were held in PayPal authorization hold and are 100% protected against hallucinated deliverables.',
    },
  },
]

const TribunalExecuteSchema = z.object({
  scenarioId: z.string(),
})

export const GET = apiHandler(
  {
    auth: 'none',
  },
  async () => {
    return NextResponse.json({
      status: 'ready',
      feature: 'Multi-Agent AI Dispute Tribunal',
      governance_model: 'ProofPay Autonomous Dispute Resolution Protocol (ADRP)',
      scenarios: SCENARIOS.map((s) => ({
        id: s.id,
        title: s.title,
        holdAmount: `$${(s.holdAmountMinor / 100).toFixed(2)} ${s.currency}`,
        contractTitle: s.contractTitle,
        buyerClaim: s.buyerClaim,
        sellerDefense: s.sellerDefense,
      })),
    })
  }
)

export const POST = apiHandler(
  {
    auth: 'none',
    body: TribunalExecuteSchema,
  },
  async ({ body }) => {
    const scenario = SCENARIOS.find((s) => s.id === body?.scenarioId) ?? SCENARIOS[0]!

    return NextResponse.json({
      status: 'success',
      scenario,
    })
  }
)

