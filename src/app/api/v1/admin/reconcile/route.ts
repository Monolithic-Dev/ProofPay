/**
 * Admin Reconcile API route — POST /api/v1/admin/reconcile
 * Implements phase-5-paypal-funding-and-release.md §5.8 (C-7).
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { apiHandler } from '@/server/http/handler'
import { requireRole } from '@/server/auth/guards'
import { enqueueJob } from '@/server/jobs/queue'
import { getDb } from '@/server/db/client'

const AdminReconcileSchema = z.object({
  contract_id: z.string().uuid(),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: AdminReconcileSchema,
  },
  async ({ user, body }) => {
    // Admin only
    requireRole(user!, 'admin')

    const { contract_id } = body!
    const db = getDb()

    await enqueueJob(
      db,
      'RECONCILE_PAYPAL',
      { contract_id },
      { dedupeKey: `reconcile:admin:${contract_id}:${Date.now()}` }
    )

    return NextResponse.json(
      {
        success: true,
        contract_id,
        message: 'Reconciliation enqueued',
      },
      { status: 200 }
    )
  }
)
