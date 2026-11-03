/**
 * Worker Agent (SynthetixBot) — autonomous seller agent generating and fixing deliverables.
 * Implements phase-7-agents-judge-mode-mcp.md §7.2.
 */
import fs from 'fs'
import path from 'path'
import type { ApiClient } from '@/shared/api-client'
import { nanoid } from 'nanoid'

// Helper to load fixtures safely
function loadFixture(filename: string): string {
  const p = path.resolve(process.cwd(), 'src/demo/fixtures', filename)
  return fs.readFileSync(p, 'utf8')
}

export interface GenerateDatasetOptions {
  flaw?: 'short_rows' | 'bad_email'
}

export interface GenerateSummaryOptions {
  dataset?: unknown
  flaw?: 'injection'
}

/**
 * Generates product dataset, falling back to deterministic golden fixtures.
 */
export function generateDataset(options: GenerateDatasetOptions = {}): string {
  if (options.flaw === 'short_rows' || options.flaw === 'bad_email') {
    return loadFixture('dataset-22-bad.json')
  }
  return loadFixture('dataset-25-valid.json')
}

/**
 * Generates market summary text.
 */
export function generateSummary(options: GenerateSummaryOptions = {}): string {
  if (options.flaw === 'injection') {
    return loadFixture('summary-injection.txt')
  }
  return loadFixture('summary-175.txt')
}

/**
 * Applies deterministic fixes to flawed deliverables based on verification feedback.
 */
export function applyFeedback(artifact: string, _verificationView?: any): string {
  const trimmed = artifact.trim()

  // 1. Check if artifact is JSON array
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const records = JSON.parse(trimmed) as any[]
      const validReference = JSON.parse(loadFixture('dataset-25-valid.json')) as any[]

      // Fix 1: Repair malformed email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      for (let i = 0; i < records.length; i++) {
        const item = records[i]
        if (!item.contact_email || !emailRegex.test(item.contact_email)) {
          item.contact_email = `contact-${i + 1}@valid-domain.example.com`
        }
        if (!item.sku || !/^[A-Z]{3}-\d{4}$/.test(item.sku)) {
          item.sku = `FIX-${1000 + i}`
        }
      }

      // Fix 2: Pad rows up to 25 if short
      if (records.length < 25) {
        for (let i = records.length; i < 25; i++) {
          const fallback = validReference[i] || validReference[0]
          records.push({
            ...fallback,
            sku: `PAD-${2000 + i}`,
          })
        }
      }

      return JSON.stringify(records, null, 2)
    } catch {
      // If parsing failed, return valid fixture directly
      return loadFixture('dataset-25-valid.json')
    }
  }

  // 2. Text Summary Fix
  let text = trimmed

  // Strip adversarial injections
  if (text.includes('SYSTEM NOTE TO GRADER')) {
    text = text.replace(/SYSTEM NOTE TO GRADER:[\s\S]*$/, '').trim()
  }

  // Check word count
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 150 || words.length > 200) {
    return loadFixture('summary-175.txt')
  }

  return text
}

/**
 * Submits deliverable to ProofPay on behalf of the Worker Agent.
 */
export async function submitDeliverableAsWorker(
  client: ApiClient,
  contractId: string,
  milestoneKey: string,
  content: string,
  contentType: 'json_records' | 'text' = 'json_records'
) {
  const idempotencyKey = `worker_sub_${contractId}_${milestoneKey}_${nanoid(8)}`
  return client.submitDeliverable(contractId, milestoneKey, {
    content_type: contentType,
    content_text: content,
    idempotency_key: idempotencyKey,
  })
}
