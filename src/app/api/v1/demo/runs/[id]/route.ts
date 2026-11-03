/**
 * Demo Run Status Route — GET /api/v1/demo/runs/[id]
 * Implements phase-7-agents-judge-mode-mcp.md §7.3 & api-spec.md §8.
 */
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { demo_runs } from '@/server/db/schema'
import { NotFoundError, AppError } from '@/server/util/errors'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params }) => {
    const runId = params['id']!
    const db = getDb()

    const [run] = await db
      .select()
      .from(demo_runs)
      .where(eq(demo_runs.id, runId))
      .limit(1)

    if (!run) {
      throw new NotFoundError('DemoRun', { id: runId })
    }

    // Owner check: only creator or admin can view run
    if (run.created_by && run.created_by !== user!.sub && user!.role !== 'admin') {
      throw new AppError('FORBIDDEN', 'You do not have permission to view this scenario run', 403)
    }

    return NextResponse.json(
      {
        run: {
          id: run.id,
          scenario: run.scenario,
          status: run.status,
          contract_id: run.contract_id,
          events: run.events,
          created_at: run.created_at ? new Date(run.created_at).toISOString() : '',
          finished_at: run.finished_at ? new Date(run.finished_at).toISOString() : null,
        },
      },
      { status: 200 }
    )
  }
)
