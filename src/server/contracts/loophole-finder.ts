/**
 * Loophole Finder Engine (N1 Signature Feature)
 *
 * Attacks contract acceptance criteria using adversarial generation strategies.
 * Deterministic code executes real checks against each candidate to confirm
 * whether a loophole genuinely exists (zero hallucinated loopholes).
 * Generates RFC 6902 JSON Patch arrays (`patch_ops`) and verifies closure by
 * re-running deterministic checks against the exact same exploit artifact.
 */
import type { Operation } from 'fast-json-patch'
import { runDeterministicCheck } from '@/server/verify/deterministic/registry'
import { parseArtifact } from '@/server/verify/artifact'
import { applyPatchSafe } from '@/server/contracts/lint/patch'
import { logger } from '@/server/util/logger'

const log = logger.child({ module: 'contracts:loophole-finder' })

export type LoopholeStrategyTag =
  | 'repeated_rows'
  | 'placeholder_values'
  | 'filler_text'
  | 'keyword_stuffing'
  | 'shallow_variation'
  | 'schema_only_garbage'
  | 'internal_links'

export interface ProposedCriterionTemplate {
  type: 'deterministic'
  required: true
  description: string
  check: string
  spec: Record<string, unknown>
}

export interface LoopholeAttempt {
  strategy_tag: LoopholeStrategyTag
  title: string
  why_useless: string
  artifact: unknown
  proposed_fix_description: string
  closing_criteria: ProposedCriterionTemplate[]
}

export interface ConfirmedLoophole {
  strategy_tag: LoopholeStrategyTag
  milestone_key: string
  milestone_index: number
  title: string
  why_useless: string
  artifact_preview: string
  passed_criteria: string[]
  closing_fix_description: string
  patch_ops: Operation[]
  patch: {
    criteria_add: Array<{
      type: 'deterministic'
      check: string
      spec: Record<string, unknown>
    }>
  }
  retest_result: {
    closed: boolean
    failed_check?: string
    reason: string
  }
}

export interface LoopholeScanResult {
  contract_id: string
  contract_version: number
  attempts_tested: number
  loopholes_confirmed: number
  confirmed_loopholes: ConfirmedLoophole[]
  summary_badge: string
}

const VALID_CATEGORIES = ['Electronics', 'Home', 'Fitness', 'Beauty', 'Toys'] as const

/**
 * Generates adversarial candidate artifacts tailored to a milestone's deliverable type.
 * Dataset candidates strictly conform to `product_v1.json` so they bypass naive JSON schema checks.
 */
function generateAdversarialCandidates(milestone: any): LoopholeAttempt[] {
  const deliverableType =
    milestone?.deliverable?.content_type ??
    milestone?.deliverable_json?.type ??
    'json_records'

  if (deliverableType === 'json_records') {
    return [
      {
        strategy_tag: 'repeated_rows',
        title: 'Identical Duplicate Records Attack',
        why_useless:
          'Satisfies product_v1 JSON schema and row_count >= 25 by copying the exact same single SKU row 25 times.',
        artifact: Array.from({ length: 25 }, () => ({
          sku: 'DUP-9999',
          name: 'Repeated Synthetic Product',
          category: 'Electronics',
          price_usd: 19.99,
          contact_email: 'catalog@example.com',
          description:
            'Standard repeated product catalog description meeting minimum character count.',
        })),
        proposed_fix_description:
          'Enforce unique_field on sku and junk_detector (max 25% duplicate values).',
        closing_criteria: [
          {
            type: 'deterministic',
            required: true,
            description: 'Require unique product SKU across every record',
            check: 'unique_field',
            spec: { field: 'sku' },
          },
          {
            type: 'deterministic',
            required: true,
            description: 'Block copy-pasted dataset records (> 25% duplicates)',
            check: 'junk_detector',
            spec: { max_duplicate_ratio: 0.25 },
          },
        ],
      },
      {
        strategy_tag: 'placeholder_values',
        title: 'Unique IDs with Placeholder Names ("TBD") Attack',
        why_useless:
          'Supplies distinct SKUs, varied categories, and unique emails so unique_field passes, while setting every product name to "TBD".',
        artifact: Array.from({ length: 25 }, (_, i) => ({
          sku: `SKU-${1000 + i}`,
          name: 'TBD',
          category: VALID_CATEGORIES[i % VALID_CATEGORIES.length],
          price_usd: 15 + i * 0.5,
          contact_email: `vendor${i}@sample.com`,
          description: `Catalog item #${1000 + i} specification draft awaiting verified supplier copy for listing #${i + 1}.`,
        })),
        proposed_fix_description:
          'Add junk_detector placeholder guard (<= 5% placeholders) and forbidden_terms check blocking "TBD".',
        closing_criteria: [
          {
            type: 'deterministic',
            required: true,
            description: 'Reject datasets exceeding 5% placeholder strings (N/A, TBD, dummy)',
            check: 'junk_detector',
            spec: { max_placeholder_ratio: 0.05 },
          },
          {
            type: 'deterministic',
            required: true,
            description: 'Disallow unresolved TBD and FIXME markers in records',
            check: 'forbidden_terms',
            spec: { terms: ['TBD', 'FIXME', 'lorem'] },
          },
        ],
      },
      {
        strategy_tag: 'schema_only_garbage',
        title: 'Low-Entropy Synthetic Padding Attack',
        why_useless:
          'Fills every SKU, email, and name uniquely, while packing every description with repeated identical padding characters to clear minLength: 40.',
        artifact: Array.from({ length: 25 }, (_, i) => ({
          sku: `MIN-${2000 + i}`,
          name: `Catalog Entry #${2000 + i}`,
          category: VALID_CATEGORIES[i % VALID_CATEGORIES.length],
          price_usd: 12.5 + i,
          contact_email: `seller${i}@merchant-example.com`,
          description: `Item ${2000 + i}: ${'x'.repeat(42)}`,
        })),
        proposed_fix_description:
          'Add minimum Shannon entropy threshold (min_entropy: 4.5 bits/char) and stricter duplicate ratio guard.',
        closing_criteria: [
          {
            type: 'deterministic',
            required: true,
            description: 'Require >= 4.5 bits/char entropy and <= 15% repeated field strings',
            check: 'junk_detector',
            spec: { min_entropy: 4.5, max_duplicate_ratio: 0.15 },
          },
        ],
      },
    ]
  }

  // Text / Markdown deliverable attack corpus
  return [
    {
      strategy_tag: 'filler_text',
      title: 'Repetitive Sentence Loop Filler Attack',
      why_useless:
        'Repeats one short boilerplate sentence containing required keywords 60 times to clear word count bounds with near-zero information.',
      artifact: 'This PayPal Security architecture note summarizes compliance cleanly. '.repeat(
        60
      ),
      proposed_fix_description:
        'Enforce junk_detector duplicate limit (<= 15%) and minimum Shannon entropy (>= 4.2 bits/char).',
      closing_criteria: [
        {
          type: 'deterministic',
          required: true,
          description: 'Block repetitive boilerplate text and low-entropy sentence loops',
          check: 'junk_detector',
          spec: { max_duplicate_ratio: 0.15, max_placeholder_ratio: 0.05, min_entropy: 4.2 },
        },
      ],
    },
    {
      strategy_tag: 'keyword_stuffing',
      title: 'Bare Keyword List Without Substance',
      why_useless:
        'Concatenates required terms inside an 18-word checklist stub with zero technical architecture narrative.',
      artifact:
        'Audit Checklist: PayPal Security Authorization Hold Idempotency Replay Reconciliation Schema Validation Status Verified Ready.',
      proposed_fix_description:
        'Require minimum 150 words so bare keyword lists fail deterministically.',
      closing_criteria: [
        {
          type: 'deterministic',
          required: true,
          description: 'Require substantive narrative with at least 150 words',
          check: 'word_count',
          spec: { min: 150 },
        },
      ],
    },
    {
      strategy_tag: 'internal_links',
      title: 'Placeholder Terms & Internal Loopback Links Attack',
      why_useless:
        'Embeds unresolved "TBD" markers and non-HTTPS loopback URLs (http://127.0.0.1:8080/internal-admin) into a plausible long report.',
      artifact:
        `${'PayPal integration architecture uses explicit order creation, buyer-approved authorization holds up to twenty-nine days, and idempotent partial milestone captures with outbox reconciliation. '.repeat(
          8
        )}Diagnostic endpoints verified on http://127.0.0.1:8080/internal-admin and http://localhost:3000/debug. Final production runbook links remain TBD.`,
      proposed_fix_description:
        'Enforce HTTPS external URLs via link_check (disallow_internal) and block TBD/FIXME tokens via forbidden_terms.',
      closing_criteria: [
        {
          type: 'deterministic',
          required: true,
          description: 'Require HTTPS links and disallow localhost / internal IP URLs',
          check: 'link_check',
          spec: { require_https: true, disallow_internal: true },
        },
        {
          type: 'deterministic',
          required: true,
          description: 'Disallow unresolved TBD or FIXME markers in final report',
          check: 'forbidden_terms',
          spec: { terms: ['TBD', 'FIXME', 'lorem ipsum'] },
        },
      ],
    },
  ]
}

/**
 * Compute highest existing numeric criterion suffix (`cN`) across all milestones so new keys never collide.
 */
function nextAvailableCriterionIndex(contract: any): number {
  let maxIdx = 100
  const milestones = Array.isArray(contract?.milestones) ? contract.milestones : []
  for (const m of milestones) {
    const crits = Array.isArray(m?.criteria) ? m.criteria : []
    for (const c of crits) {
      if (typeof c?.key === 'string') {
        const match = /^c(\d+)$/.exec(c.key)
        if (match && match[1]) {
          maxIdx = Math.max(maxIdx, Number(match[1]))
        }
      }
    }
  }
  return maxIdx + 1
}

/**
 * Evaluate all deterministic criteria in a list against a candidate artifact.
 */
function evaluateDeterministicCriteria(
  criteriaList: any[],
  candidateArtifact: unknown
): { allPassed: boolean; failedCheck?: string; failedReason?: string; passedChecks: string[] } {
  const candidateType = Array.isArray(candidateArtifact) ? 'json_records' : 'text'
  const parsedArtifact = parseArtifact(candidateType, candidateArtifact)

  const passedChecks: string[] = []

  for (const crit of criteriaList) {
    if (crit?.type !== 'deterministic') continue
    const checkName = crit.check || crit.check_name || crit.name
    if (!checkName) continue
    const spec = crit.spec || crit.spec_json || crit.config || {}
    const checkRes = runDeterministicCheck(checkName, parsedArtifact, spec)
    if (!checkRes.passed) {
      return {
        allPassed: false,
        failedCheck: checkName,
        failedReason: checkRes.reason,
        passedChecks,
      }
    }
    passedChecks.push(checkName)
  }

  return { allPassed: true, passedChecks }
}

/**
 * Builds RFC 6902 add operations for a milestone and verifies against the exact exploit artifact
 * that applying those operations closes the exploit deterministically.
 */
function buildAndVerifyClosingPatch(
  contract: any,
  milestoneIndex: number,
  milestoneCriteria: any[],
  candidate: LoopholeAttempt,
  startingKeyNumber: number
): {
  patch_ops: Operation[]
  nextKeyNumber: number
  retest: { closed: boolean; failed_check?: string; reason: string }
} {
  let keyCounter = startingKeyNumber
  const patchOps: Operation[] = []
  const newCriteria: any[] = []

  for (const tmpl of candidate.closing_criteria) {
    const criterionKey = `c${keyCounter++}`
    const criterionObj = {
      key: criterionKey,
      type: 'deterministic' as const,
      required: true,
      description: tmpl.description,
      check: tmpl.check,
      spec: tmpl.spec,
    }
    patchOps.push({
      op: 'add',
      path: `/milestones/${milestoneIndex}/criteria/-`,
      value: criterionObj,
    })
    newCriteria.push(criterionObj)
  }

  let patchedCriteriaForRetest = [...milestoneCriteria, ...newCriteria]
  if (contract?.schema_version === 1) {
    const safeCheck = applyPatchSafe(contract, patchOps)
    if (safeCheck.ok && safeCheck.contract?.milestones?.[milestoneIndex]?.criteria) {
      patchedCriteriaForRetest = safeCheck.contract.milestones[milestoneIndex]!.criteria as any[]
    }
  }

  // Actually execute Stage 1 deterministic checks against the SAME exploit artifact
  const retestEval = evaluateDeterministicCriteria(patchedCriteriaForRetest, candidate.artifact)

  return {
    patch_ops: patchOps,
    nextKeyNumber: keyCounter,
    retest: {
      closed: !retestEval.allPassed,
      failed_check: retestEval.failedCheck,
      reason: !retestEval.allPassed
        ? `Confirmed blocked by [${retestEval.failedCheck}]: ${retestEval.failedReason}`
        : 'Warning: exploit still satisfied patched ruleset.',
    },
  }
}

/**
 * Runs deterministic verification against adversarial candidate artifacts across contract milestones.
 * Any candidate that satisfies EVERY deterministic criterion on a milestone is a confirmed loophole.
 */
export async function scanContractForLoopholes(contract: any): Promise<LoopholeScanResult> {
  const rawMilestones: any[] =
    Array.isArray(contract?.milestones) && contract.milestones.length > 0
      ? contract.milestones
      : [{ key: 'm1', deliverable_json: { type: 'json_records' }, criteria: [] }]

  const confirmed: ConfirmedLoophole[] = []
  let attemptsTested = 0
  let keyCounter = nextAvailableCriterionIndex(contract)

  for (let mIdx = 0; mIdx < rawMilestones.length; mIdx++) {
    const milestone = rawMilestones[mIdx]
    const milestoneKey = milestone?.key || milestone?.milestone_key || `m${mIdx + 1}`
    const existingCriteria = Array.isArray(milestone?.criteria) ? milestone.criteria : []
    const detCount = existingCriteria.filter((c: any) => c?.type === 'deterministic').length

    if (detCount === 0) continue

    const candidates = generateAdversarialCandidates(milestone)

    for (const candidate of candidates) {
      attemptsTested++
      const evalRes = evaluateDeterministicCriteria(existingCriteria, candidate.artifact)

      if (evalRes.allPassed) {
        const { patch_ops, nextKeyNumber, retest } = buildAndVerifyClosingPatch(
          contract,
          mIdx,
          existingCriteria,
          candidate,
          keyCounter
        )
        keyCounter = nextKeyNumber

        const previewRaw =
          typeof candidate.artifact === 'string'
            ? candidate.artifact
            : JSON.stringify(candidate.artifact)
        const preview =
          previewRaw.length > 180 ? `${previewRaw.slice(0, 180)}...` : previewRaw

        confirmed.push({
          strategy_tag: candidate.strategy_tag,
          milestone_key: milestoneKey,
          milestone_index: mIdx,
          title: candidate.title,
          why_useless: candidate.why_useless,
          artifact_preview: preview,
          passed_criteria: evalRes.passedChecks,
          closing_fix_description: candidate.proposed_fix_description,
          patch_ops,
          patch: {
            criteria_add: candidate.closing_criteria.map((c) => ({
              type: c.type,
              check: c.check,
              spec: c.spec,
            })),
          },
          retest_result: retest,
        })
      }
    }
  }

  const confirmedCount = confirmed.length
  const badge =
    confirmedCount === 0
      ? `0 loopholes confirmed in ${attemptsTested} attempts`
      : `${confirmedCount} confirmed loophole${confirmedCount > 1 ? 's' : ''} detected across ${attemptsTested} probes`

  log.info(
    {
      contractId: contract?.id || 'draft',
      tested: attemptsTested,
      confirmed: confirmedCount,
    },
    'Completed contract loophole audit'
  )

  return {
    contract_id: contract?.id || 'demo_contract',
    contract_version: contract?.version || 1,
    attempts_tested: attemptsTested,
    loopholes_confirmed: confirmedCount,
    confirmed_loopholes: confirmed,
    summary_badge: badge,
  }
}

/**
 * Interactive presets for /demo/loophole sandbox (canonical ContractSchema v1 compliant).
 */
export interface LoopholePreset {
  id: string
  name: string
  subtitle: string
  contract: Record<string, unknown>
}

export const DEMO_LOOPHOLE_PRESETS: LoopholePreset[] = [
  {
    id: 'catalog_loose',
    name: 'Loose Product Catalog (Dataset)',
    subtitle: 'Requires product_v1 JSON schema & >= 25 rows — lacks duplicate, placeholder, and entropy guards',
    contract: {
      schema_version: 1,
      title: 'E-Commerce Product Catalog Scraping & Normalization',
      summary: 'Deliver 25 validated product records in JSON format.',
      currency: 'USD',
      total_minor: 5000,
      milestones: [
        {
          key: 'm1',
          title: '25 Product Records JSON',
          amount_minor: 5000,
          due_in_days: 7,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 524288,
            description: 'Array of 25 JSON product objects matching product_v1',
          },
          criteria: [
            {
              key: 'c1',
              type: 'deterministic',
              required: true,
              description: 'Validates against product_v1 object schema',
              check: 'json_schema',
              spec: { schema_ref: 'product_v1' },
            },
            {
              key: 'c2',
              type: 'deterministic',
              required: true,
              description: 'Must contain at least 25 rows',
              check: 'row_count',
              spec: { min: 25 },
            },
          ],
        },
      ],
      policy: {
        max_revisions: 2,
        auto_release_hours: 48,
        on_final_failure: 'void_remaining',
        verifier_confidence_min: 0.6,
      },
    },
  },
  {
    id: 'security_report_loose',
    name: 'Loose Security Audit Report (Text)',
    subtitle: 'Checks only keyword presence ("Security", "PayPal") — vulnerable to keyword stuffing, loops & loopback URLs',
    contract: {
      schema_version: 1,
      title: 'Payment Flow Architecture & Security Audit Report',
      summary: 'Deliver a comprehensive security and PayPal architecture evaluation in Markdown.',
      currency: 'USD',
      total_minor: 7500,
      milestones: [
        {
          key: 'm1',
          title: 'Final Architecture Security Audit',
          amount_minor: 7500,
          due_in_days: 10,
          deliverable: {
            content_type: 'text',
            max_bytes: 262144,
            description: 'Markdown technical report analyzing PayPal hold flows and API security',
          },
          criteria: [
            {
              key: 'c1',
              type: 'deterministic',
              required: true,
              description: 'Must mention Security and PayPal',
              check: 'required_keywords',
              spec: { keywords: ['Security', 'PayPal'], mode: 'all' },
            },
          ],
        },
      ],
      policy: {
        max_revisions: 2,
        auto_release_hours: 48,
        on_final_failure: 'void_remaining',
        verifier_confidence_min: 0.6,
      },
    },
  },
  {
    id: 'hardened_production',
    name: 'Hardened Multi-Layer Contract (Reference)',
    subtitle: 'Combines json_schema, row_count, unique_field, junk_detector (entropy + placeholder), and forbidden_terms',
    contract: {
      schema_version: 1,
      title: 'Hardened Multi-Layer Catalog & Architecture Agreement',
      summary: 'Protected dataset contract with anti-junk, uniqueness, and entropy bounds.',
      currency: 'USD',
      total_minor: 10000,
      milestones: [
        {
          key: 'm1',
          title: 'Validated Dataset Delivery',
          amount_minor: 10000,
          due_in_days: 7,
          deliverable: {
            content_type: 'json_records',
            max_bytes: 524288,
            description: '25 unique, high-entropy JSON catalog records',
          },
          criteria: [
            {
              key: 'c1',
              type: 'deterministic',
              required: true,
              description: 'Matches product_v1 JSON schema',
              check: 'json_schema',
              spec: { schema_ref: 'product_v1' },
            },
            {
              key: 'c2',
              type: 'deterministic',
              required: true,
              description: 'Minimum 25 records',
              check: 'row_count',
              spec: { min: 25 },
            },
            {
              key: 'c3',
              type: 'deterministic',
              required: true,
              description: 'Unique SKU field across all rows',
              check: 'unique_field',
              spec: { field: 'sku' },
            },
            {
              key: 'c4',
              type: 'deterministic',
              required: true,
              description: 'Blocks duplicate, low-entropy, and placeholder records',
              check: 'junk_detector',
              spec: { max_duplicate_ratio: 0.15, max_placeholder_ratio: 0.05, min_entropy: 4.5 },
            },
            {
              key: 'c5',
              type: 'deterministic',
              required: true,
              description: 'Disallow TBD, FIXME, or lorem placeholder tokens',
              check: 'forbidden_terms',
              spec: { terms: ['TBD', 'FIXME', 'lorem'] },
            },
          ],
        },
      ],
      policy: {
        max_revisions: 2,
        auto_release_hours: 48,
        on_final_failure: 'void_remaining',
        verifier_confidence_min: 0.6,
      },
    },
  },
]
