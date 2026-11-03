import { NextRequest, NextResponse } from 'next/server'
import { eq, and, inArray } from 'drizzle-orm'
import { getDb, withTx, lockContract } from '@/server/db/client'
import { contract_invitations, contracts, milestones, criteria, users, organizations } from '@/server/db/schema'
import { readSession } from '@/server/auth/session'
import { appendLedgerEvent } from '@/server/ledger/append'
import { toErrorResponse, httpStatusFor, ValidationError, NotFoundError, ConflictError } from '@/server/util/errors'
import { newRequestId } from '@/server/util/ids'
import crypto from 'node:crypto'

export async function GET(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const params = await context.params
    const token = params.token
    if (!token) throw new ValidationError('Missing invitation token')

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const db = getDb()

    const [invite] = await db
      .select()
      .from(contract_invitations)
      .where(eq(contract_invitations.token_hash, tokenHash))
      .limit(1)

    if (!invite) throw new NotFoundError('Invalid or expired invitation token')

    if (new Date(invite.expires_at) < new Date()) {
      throw new ValidationError('This invitation link has expired (14-day limit)')
    }

    // Retrieve contract details
    const [contract] = await db
      .select({
        id: contracts.id,
        title: contracts.title,
        status: contracts.status,
        total_minor: contracts.total_minor,
        currency: contracts.currency,
        contract_hash: contracts.contract_hash,
        buyer_id: contracts.buyer_id,
        buyer_org_id: contracts.buyer_org_id,
        created_at: contracts.created_at,
      })
      .from(contracts)
      .where(eq(contracts.id, invite.contract_id))
      .limit(1)

    if (!contract) throw new NotFoundError('Associated contract not found')

    // Retrieve milestones and criteria
    const contractMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.contract_id, contract.id))
      .orderBy(milestones.idx)

    const milestoneIds = contractMilestones.map((m) => m.id)
    const allCriteria = milestoneIds.length > 0
      ? await db.select().from(criteria).where(inArray(criteria.milestone_id, milestoneIds))
      : []

    // Fetch buyer details
    const [buyer] = await db
      .select({
        display_name: users.display_name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, contract.buyer_id))
      .limit(1)

    return NextResponse.json({
      invitation: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expires_at: invite.expires_at,
        accepted_at: invite.accepted_at,
      },
      contract: {
        ...contract,
        buyer: buyer || { display_name: 'Client', email: 'client@proofpay.app' },
        milestones: contractMilestones.map((m) => ({
          ...m,
          criteria: allCriteria.filter((c) => c.milestone_id === m.id),
        })),
      },
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}

export async function POST(
  req: NextRequest,
  context: any = {}
) {
  const requestId = newRequestId()

  try {
    const params = await context.params
    const token = params.token
    if (!token) throw new ValidationError('Missing invitation token')

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const db = getDb()

    const [invite] = await db
      .select()
      .from(contract_invitations)
      .where(eq(contract_invitations.token_hash, tokenHash))
      .limit(1)

    if (!invite) throw new NotFoundError('Invalid or expired invitation token')

    if (invite.accepted_at) {
      throw new ConflictError('This invitation has already been accepted')
    }

    if (new Date(invite.expires_at) < new Date()) {
      throw new ValidationError('This invitation link has expired')
    }

    const sessionUser = await readSession(req)
    const body = await req.json().catch(() => ({}))
    const action = body.action || 'accept' // 'accept' | 'decline'

    if (action === 'decline') {
      await withTx(async (tx) => {
        await lockContract(tx, invite.contract_id)
        await tx
          .update(contracts)
          .set({ status: 'CANCELLED', updated_at: new Date() })
          .where(eq(contracts.id, invite.contract_id))

        await appendLedgerEvent(tx, {
          contractId: invite.contract_id,
          type: 'contract_declined',
          actorType: 'seller',
          actorId: sessionUser?.sub,
          payload: {
            reason: body.reason || 'Invitation declined by recipient',
            email: invite.email,
          },
        })
      })

      return NextResponse.json({ ok: true, status: 'CANCELLED' }, { headers: { 'X-Request-Id': requestId } })
    }

    // Accept contract
    const updatedContract = await withTx(async (tx) => {
      await lockContract(tx, invite.contract_id)

      let sellerId = sessionUser?.sub
      let sellerOrgId = sessionUser?.org_id

      // If user not authenticated, look up or create user by invited email
      if (!sellerId) {
        const [existing] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, invite.email))
          .limit(1)

        if (existing) {
          sellerId = existing.id
        } else {
          const [newUser] = await tx
            .insert(users)
            .values({
              email: invite.email,
              display_name: invite.email.split('@')[0] || 'Seller',
              role: 'seller',
            })
            .returning()
          sellerId = newUser?.id
        }
      }

      // Update contract to ACCEPTED
      const [updated] = await tx
        .update(contracts)
        .set({
          seller_id: sellerId,
          seller_org_id: sellerOrgId,
          status: 'ACCEPTED',
          updated_at: new Date(),
        })
        .where(eq(contracts.id, invite.contract_id))
        .returning()

      // Record acceptance on invitation
      await tx
        .update(contract_invitations)
        .set({ accepted_at: new Date() })
        .where(eq(contract_invitations.id, invite.id))

      // Append immutable ledger event
      await appendLedgerEvent(tx, {
        contractId: invite.contract_id,
        type: 'contract_accepted',
        actorType: 'seller',
        actorId: sellerId,
        payload: {
          seller_id: sellerId,
          invitation_id: invite.id,
          method: 'counterparty_invitation',
        },
      })

      return updated
    })

    return NextResponse.json({
      ok: true,
      contract: updatedContract,
    }, { headers: { 'X-Request-Id': requestId } })
  } catch (err) {
    return NextResponse.json(toErrorResponse(err, requestId), {
      status: httpStatusFor(err),
      headers: { 'X-Request-Id': requestId },
    })
  }
}
