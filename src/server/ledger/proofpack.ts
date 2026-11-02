/**
 * Proof Pack Generator — JSON & PDF formats.
 * Implements phase-6-frontend.md §6.2 & api-spec.md §8.
 */
import PDFDocument from 'pdfkit'
import { eq, asc } from 'drizzle-orm'
import { getDb } from '@/server/db/client'
import {
  contracts,
  milestones,
  submissions,
  verifications,
  ledger_events,
  users,
} from '@/server/db/schema'
import { verifyLedger } from '@/server/ledger/verify'
import { toVerificationView, type VerificationView } from '@/server/verify/view'
import { NotFoundError } from '@/server/util/errors'
import { ZERO_HASH } from '@/server/contracts/canonical'
import type { Contract } from '@/server/contracts/schema'

export interface ProofPack {
  version: number
  generated_at: string
  disclaimer: string
  contract: {
    id: string
    title: string
    hash: string
    canonical: Contract
    buyer: { id: string; email: string; name: string }
    seller: { id: string; email: string; name: string } | null
  }
  paypal: {
    order_id: string | null
    authorization_ids: string[]
    captures: Array<{ id: string; milestone_key: string; amount_minor: number }>
    voids: Array<Record<string, unknown>>
    refunds: Array<Record<string, unknown>>
  }
  milestones: Array<{
    key: string
    status: string
    submissions: Array<{
      attempt: number
      sha256: string
      received_at: string
    }>
    verifications: VerificationView[]
  }>
  ledger: Array<{
    seq: number
    type: string
    actor_type: string
    payload: Record<string, unknown>
    prev_hash: string
    hash: string
    created_at: string
  }>
  chain: {
    valid: boolean
    head_hash: string
  }
}

export async function buildProofPack(contractId: string): Promise<ProofPack> {
  const db = getDb()

  const [contractRow] = await db
    .select()
    .from(contracts)
    .where(eq(contracts.id, contractId))

  if (!contractRow) {
    throw new NotFoundError('Contract', { id: contractId })
  }

  // Fetch buyer & seller
  const [buyerUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, contractRow.buyer_id))

  let sellerUser = null
  if (contractRow.seller_id) {
    const [seller] = await db
      .select()
      .from(users)
      .where(eq(users.id, contractRow.seller_id))
    if (seller) {
      sellerUser = {
        id: seller.id,
        email: seller.email,
        name: seller.display_name,
      }
    }
  }

  // Fetch milestones
  const milestoneRows = await db
    .select()
    .from(milestones)
    .where(eq(milestones.contract_id, contractId))
    .orderBy(asc(milestones.idx))

  // Fetch submissions and verifications for each milestone
  const milestonesPack = await Promise.all(
    milestoneRows.map(async (m) => {
      const subRows = await db
        .select()
        .from(submissions)
        .where(eq(submissions.milestone_id, m.id))
        .orderBy(asc(submissions.attempt))

      const subsData = subRows.map((s) => ({
        attempt: s.attempt,
        sha256: s.sha256,
        received_at: new Date(s.created_at).toISOString(),
      }))

      const vViews: VerificationView[] = []
      for (const s of subRows) {
        const [vRow] = await db
          .select()
          .from(verifications)
          .where(eq(verifications.submission_id, s.id))
        if (vRow) {
          vViews.push(toVerificationView(vRow, m.milestone_key))
        }
      }

      return {
        key: m.milestone_key,
        status: m.status,
        submissions: subsData,
        verifications: vViews,
      }
    })
  )

  // Fetch ledger events
  const ledgerRows = await db
    .select()
    .from(ledger_events)
    .where(eq(ledger_events.contract_id, contractId))
    .orderBy(asc(ledger_events.seq))

  const ledgerData = ledgerRows.map((e) => ({
    seq: e.seq,
    type: e.type,
    actor_type: e.actor_type,
    payload: e.payload as Record<string, unknown>,
    prev_hash: e.prev_hash,
    hash: e.hash,
    created_at: new Date(e.created_at).toISOString(),
  }))

  const chainResult = await verifyLedger(contractId)
  const headHash = ledgerData.length > 0 ? ledgerData[ledgerData.length - 1]!.hash : ZERO_HASH

  // Extract PayPal identifiers from milestones and ledger
  const authIds = new Set<string>()
  if (contractRow.authorization_id) authIds.add(contractRow.authorization_id)

  const captures: Array<{ id: string; milestone_key: string; amount_minor: number }> = []
  const voids: Array<Record<string, unknown>> = []
  const refunds: Array<Record<string, unknown>> = []

  for (const m of milestoneRows) {
    if (m.capture_id) {
      captures.push({
        id: m.capture_id,
        milestone_key: m.milestone_key,
        amount_minor: m.amount_minor,
      })
    }
  }

  for (const e of ledgerRows) {
    const payload = e.payload as Record<string, unknown>
    if (payload.authorization_id && typeof payload.authorization_id === 'string') {
      authIds.add(payload.authorization_id)
    }
    if (e.type === 'AUTHORIZATION_VOIDED') {
      voids.push({ ...payload, timestamp: e.created_at })
    }
    if (e.type === 'REFUND_ISSUED') {
      refunds.push({ ...payload, timestamp: e.created_at })
    }
  }

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    disclaimer: 'Authorization hold, not escrow. Sandbox only.',
    contract: {
      id: contractRow.id,
      title: contractRow.title,
      hash: contractRow.contract_hash ?? '',
      canonical: contractRow.contract_json as unknown as Contract,
      buyer: {
        id: buyerUser?.id ?? contractRow.buyer_id,
        email: buyerUser?.email ?? 'buyer@proofpay.test',
        name: buyerUser?.display_name ?? 'Buyer',
      },
      seller: sellerUser,
    },
    paypal: {
      order_id: contractRow.paypal_order_id,
      authorization_ids: Array.from(authIds),
      captures,
      voids,
      refunds,
    },
    milestones: milestonesPack,
    ledger: ledgerData,
    chain: {
      valid: chainResult.valid,
      head_hash: headHash,
    },
  }
}

export async function renderProofPackPdf(pack: ProofPack): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      })
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header Banner
      doc.fillColor('#1D4ED8').fontSize(22).text('ProofPay', { continued: true })
      doc.fillColor('#64748B').fontSize(14).text('  |  Settlement Proof Pack')
      doc.moveDown(0.2)
      doc.fillColor('#0F172A').fontSize(10).text(`Generated: ${pack.generated_at}`)
      doc.fillColor('#B45309').fontSize(9).text(`Notice: ${pack.disclaimer}`)
      doc.moveDown(0.8)

      // Horizontal separator
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.8)

      // Contract Summary
      doc.fillColor('#1D4ED8').fontSize(14).text('1. Contract Summary')
      doc.moveDown(0.4)
      doc.fillColor('#0F172A').fontSize(10)
      doc.text(`Title: ${pack.contract.title}`)
      doc.text(`Contract ID: ${pack.contract.id}`)
      doc.text(`Canonical Hash: ${pack.contract.hash || 'N/A'}`)
      doc.text(`Total Amount: $${(pack.contract.canonical?.total_minor ? pack.contract.canonical.total_minor / 100 : 0).toFixed(2)} USD`)
      doc.text(`Buyer: ${pack.contract.buyer.name} (${pack.contract.buyer.email})`)
      doc.text(`Seller: ${pack.contract.seller ? `${pack.contract.seller.name} (${pack.contract.seller.email})` : 'Unassigned'}`)
      doc.moveDown(0.8)

      // PayPal References
      doc.fillColor('#1D4ED8').fontSize(14).text('2. PayPal Settlement References')
      doc.moveDown(0.4)
      doc.fillColor('#0F172A').fontSize(10)
      doc.text(`Order ID: ${pack.paypal.order_id ?? 'None'}`)
      doc.text(`Authorization IDs: ${pack.paypal.authorization_ids.join(', ') || 'None'}`)
      doc.text(`Captures (${pack.paypal.captures.length}):`)
      pack.paypal.captures.forEach((c) => {
        doc.text(`   • Milestone ${c.milestone_key}: Capture ${c.id} ($${(c.amount_minor / 100).toFixed(2)})`)
      })
      if (pack.paypal.voids.length > 0) {
        doc.text(`Voids: ${pack.paypal.voids.length} void event(s) recorded`)
      }
      if (pack.paypal.refunds.length > 0) {
        doc.text(`Refunds: ${pack.paypal.refunds.length} refund event(s) recorded`)
      }
      doc.moveDown(0.8)

      // Milestones & Verifications
      doc.fillColor('#1D4ED8').fontSize(14).text('3. Milestones & Verifications')
      doc.moveDown(0.4)
      for (const m of pack.milestones) {
        doc.fillColor('#0F172A').fontSize(11).text(`Milestone [${m.key}] — Status: ${m.status}`)
        doc.fontSize(9).fillColor('#64748B')
        doc.text(`   Submissions: ${m.submissions.length} attempt(s)`)
        m.submissions.forEach((s) => {
          doc.text(`     - Attempt ${s.attempt}: SHA-256 ${s.sha256} at ${s.received_at}`)
        })
        doc.text(`   Verifications: ${m.verifications.length} run(s)`)
        m.verifications.forEach((v) => {
          doc.text(`     - Decision: ${v.decision ?? 'PENDING'}, Model: ${v.model ?? 'N/A'}, Status: ${v.status}`)
        })
        doc.moveDown(0.3)
      }
      doc.moveDown(0.6)

      // Ledger Hash Chain Audit
      doc.fillColor('#1D4ED8').fontSize(14).text('4. Immutable Ledger Audit Chain')
      doc.moveDown(0.4)
      doc.fontSize(9).fillColor('#0F172A')
      doc.text(`Total Events: ${pack.ledger.length} | Chain Integrity: ${pack.chain.valid ? 'VALID ✓' : 'BROKEN ✗'}`)
      doc.text(`Head Hash: ${pack.chain.head_hash}`)
      doc.moveDown(0.4)

      // Table of ledger events (first 10 if long to fit nicely, or all if concise)
      const displayEvents = pack.ledger.slice(0, 30)
      for (const ev of displayEvents) {
        doc.fillColor('#334155').fontSize(8).text(
          `#${ev.seq.toString().padStart(2, '0')} | ${ev.created_at.slice(11, 19)} | ${ev.type.padEnd(24, ' ')} | ${ev.actor_type.padEnd(8, ' ')} | Hash: ${ev.hash.slice(0, 16)}…`
        )
      }
      if (pack.ledger.length > 30) {
        doc.text(`... and ${pack.ledger.length - 30} more events verified in chain.`)
      }

      doc.moveDown(1)
      doc.strokeColor('#E2E8F0').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke()
      doc.moveDown(0.5)
      doc.fillColor('#64748B').fontSize(8).text(
        'ProofPay Protocol Verification Engine — All rights reserved. Cryptographically verifiable ledger record.',
        { align: 'center' }
      )

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}
