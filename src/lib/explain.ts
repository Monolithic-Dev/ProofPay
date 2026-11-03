/**
 * Plain-language explainer mappings for ledger events.
 * Implements phase-6-frontend.md §6.4 & ux-flows.md §4.
 */

export interface EventExplanation {
  title: string
  summary: string
  why: string
}

export function explainLedgerEvent(
  type: string,
  payload: Record<string, unknown> = {}
): EventExplanation {
  const milestoneKey = typeof payload.milestone_key === 'string' ? payload.milestone_key : ''
  const mLabel = milestoneKey ? `[${milestoneKey}] ` : ''

  switch (type) {
    case 'CONTRACT_CREATED':
      return {
        title: 'Contract Created',
        summary: 'Agreement drafted and initialized.',
        why: 'The buyer compiled natural-language requirements into machine-checkable criteria.',
      }
    case 'CONTRACT_DRAFT_EDITED':
      return {
        title: 'Draft Updated',
        summary: 'Contract clauses or lint fixes applied.',
        why: 'The draft was updated before being submitted to the seller.',
      }
    case 'CONTRACT_PROPOSED':
      return {
        title: 'Contract Proposed',
        summary: 'Contract sent to seller for review.',
        why: 'Both parties must agree on the criteria before funds can be locked.',
      }
    case 'CONTRACT_ACCEPTED':
      return {
        title: 'Contract Accepted & Locked',
        summary: 'Seller agreed to terms. Canonical SHA-256 hash locked.',
        why: 'Cryptographic hash guarantees no party can modify criteria retroactively.',
      }
    case 'ORDER_CREATED':
      return {
        title: 'PayPal Order Prepared',
        summary: 'Authorization hold order initialized with PayPal.',
        why: 'Prepares the authorization flow without charging the buyer upfront.',
      }
    case 'AUTHORIZATION_CREATED':
      return {
        title: 'Funds Held on PayPal',
        summary: `Funds authorized on PayPal. Hold is active.`,
        why: 'PayPal placed a 29-day authorization hold on the buyer’s account. Funds are secured.',
      }
    case 'AUTHORIZATION_REAUTHED':
      return {
        title: 'Hold Reauthorized',
        summary: 'PayPal authorization refreshed.',
        why: 'Reauthorization maintains active funds protection through the 29-day window.',
      }
    case 'AUTHORIZATION_VOIDED':
      return {
        title: 'Remaining Hold Released',
        summary: 'Unreleased authorization hold voided back to buyer.',
        why: 'Contract completed or cancelled; unused buyer funds were returned.',
      }
    case 'SUBMISSION_RECEIVED':
      return {
        title: `${mLabel}Work Submitted`,
        summary: `Deliverable received for attempt ${payload.attempt ?? 1}.`,
        why: 'Seller submitted an artifact. Automated verification begins immediately.',
      }
    case 'STAGE1_COMPLETED':
      return {
        title: `${mLabel}Deterministic Checks Passed`,
        summary: 'Structural schemas, JSON formatting, and row counts checked.',
        why: 'Stage 1 tests machine-verifiable bounds with zero hallucinations.',
      }
    case 'STAGE2_COMPLETED':
      return {
        title: `${mLabel}AI Rubric Review Finished`,
        summary: 'Semantic evaluation and evidence extraction completed.',
        why: 'LLM evaluated subjective criteria and identified supporting quotes in the artifact.',
      }
    case 'STAGE3_COMPLETED':
      return {
        title: `${mLabel}Adversarial Inspection Complete`,
        summary: 'Inspected for prompt injections and evaluator manipulation.',
        why: 'Verifies that user input does not attempt to trick the AI grader.',
      }
    case 'INJECTION_FLAGGED':
      return {
        title: `${mLabel}Manipulation Flagged`,
        summary: 'Text addressed to the AI evaluator was detected and ignored.',
        why: 'Adversarial guardrails neutralized untrusted instructions inside the artifact.',
      }
    case 'POLICY_DECISION_EMITTED':
      return {
        title: `${mLabel}Policy Decision Reached`,
        summary: `Verdict: ${payload.decision ?? 'DECIDED'}.`,
        why: 'Deterministic code evaluated the test results against the strict release policy.',
      }
    case 'MILESTONE_PASSED':
      return {
        title: `${mLabel}Milestone Approved`,
        summary: 'All criteria satisfied. Approved for settlement.',
        why: 'Both deterministic and semantic tests passed required thresholds.',
      }
    case 'MILESTONE_REJECTED':
      return {
        title: `${mLabel}Milestone Rejected`,
        summary: 'Deliverable failed one or more criteria.',
        why: 'Specific failing criteria and suggested fixes are provided to the seller.',
      }
    case 'MILESTONE_ESCALATED':
      return {
        title: `${mLabel}Escalated for Human Review`,
        summary: 'Marginal or subjective result requires buyer review.',
        why: 'The AI confidence fell within the review window. Buyer makes final decision.',
      }
    case 'CAPTURE_REQUESTED':
      return {
        title: `${mLabel}Payment Capture Initiated`,
        summary: 'Triggered PayPal partial capture against authorization.',
        why: 'Two-phase commit: locked milestone state before calling PayPal payment rails.',
      }
    case 'CAPTURE_COMPLETED':
      return {
        title: `${mLabel}Funds Released to Seller`,
        summary: `PayPal capture ${payload.capture_id ?? ''} settled.`,
        why: 'Funds have moved directly into the seller’s PayPal account.',
      }
    case 'CAPTURE_FAILED':
      return {
        title: `${mLabel}Capture Declined`,
        summary: 'PayPal capture failed or timed out.',
        why: 'Network or gateway issue. Milestone marked for safe retry without double-charge risk.',
      }
    case 'REFUND_ISSUED':
      return {
        title: `${mLabel}Refund Processed`,
        summary: 'Funds refunded from seller capture.',
        why: 'Mutual agreement or resolution returned funds to the buyer.',
      }
    case 'CONTRACT_CANCELLED':
      return {
        title: 'Contract Cancelled',
        summary: 'Agreement cancelled.',
        why: payload.reason ? String(payload.reason) : 'Buyer cancelled before work began.',
      }
    default:
      return {
        title: type.replace(/_/g, ' '),
        summary: 'Ledger state update recorded.',
        why: 'Recorded in the cryptographically chained audit log.',
      }
  }
}
