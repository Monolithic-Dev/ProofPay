/**
 * Demo Run Events SSE Route — GET /api/v1/demo/runs/[id]/events
 * Streams real-time agent transcript events to the Agent Console.
 * Implements phase-7-agents-judge-mode-mcp.md §7.3 & api-spec.md §8.
 */
import { eq } from 'drizzle-orm'
import { apiHandler } from '@/server/http/handler'
import { getDb } from '@/server/db/client'
import { demo_runs } from '@/server/db/schema'
import { NotFoundError, AppError } from '@/server/util/errors'
import type { DemoEvent } from '@/demo/scenarios/types'

export const dynamic = 'force-dynamic'

export const GET = apiHandler(
  { auth: 'user' },
  async ({ user, params, req }) => {
    const runId = params['id']!
    const db = getDb()

    // 1. Initial lookup and authorization
    const [initialRun] = await db
      .select()
      .from(demo_runs)
      .where(eq(demo_runs.id, runId))
      .limit(1)

    if (!initialRun) {
      throw new NotFoundError('DemoRun', { id: runId })
    }

    if (
      initialRun.created_by &&
      initialRun.created_by !== user!.sub &&
      user!.role !== 'admin'
    ) {
      throw new AppError('FORBIDDEN', 'You do not have permission to view this scenario run stream', 403)
    }

    const url = new URL(req.url)
    const afterIndexParam = url.searchParams.get('after_index')
    let lastIndex = afterIndexParam !== null ? parseInt(afterIndexParam, 10) : -1

    const encoder = new TextEncoder()
    let pollTimer: NodeJS.Timeout | null = null
    let pingTimer: NodeJS.Timeout | null = null
    let maxLifeTimer: NodeJS.Timeout | null = null
    let isClosed = false

    const stream = new ReadableStream({
      start(controller) {
        const cleanup = () => {
          if (isClosed) return
          isClosed = true
          if (pollTimer) clearInterval(pollTimer)
          if (pingTimer) clearInterval(pingTimer)
          if (maxLifeTimer) clearTimeout(maxLifeTimer)
          try {
            controller.close()
          } catch {
            // controller might already be closed
          }
        }

        req.signal.addEventListener('abort', cleanup)

        // Heartbeat comment every 15s
        pingTimer = setInterval(() => {
          if (isClosed) return
          try {
            controller.enqueue(encoder.encode(': ping\n\n'))
          } catch {
            cleanup()
          }
        }, 15000)

        // Poll for new events every 1.5s
        pollTimer = setInterval(async () => {
          if (isClosed) return
          try {
            const [run] = await db
              .select()
              .from(demo_runs)
              .where(eq(demo_runs.id, runId))
              .limit(1)

            if (!run) {
              cleanup()
              return
            }

            const events = (run.events as DemoEvent[]) || []

            // Emit any events beyond lastIndex
            while (lastIndex + 1 < events.length) {
              lastIndex++
              const ev = events[lastIndex]
              if (!ev) continue

              let eventType = 'run.step'
              if (ev.kind === 'waiting') {
                eventType = 'run.waiting_for_buyer'
              } else if (ev.kind === 'done') {
                eventType = 'run.done'
              }

              const payload = JSON.stringify({
                run_id: runId,
                contract_id: run.contract_id,
                status: run.status,
                index: lastIndex,
                event: ev,
              })

              controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${payload}\n\n`))
            }

            // Close stream once run has completed and all events emitted
            if (
              (run.status === 'DONE' || run.status === 'FAILED') &&
              lastIndex >= events.length - 1
            ) {
              cleanup()
            }
          } catch {
            cleanup()
          }
        }, 1500)

        // Max stream life 30 minutes
        maxLifeTimer = setTimeout(cleanup, 30 * 60 * 1000)
      },
      cancel() {
        if (pollTimer) clearInterval(pollTimer)
        if (pingTimer) clearInterval(pingTimer)
        if (maxLifeTimer) clearTimeout(maxLifeTimer)
        isClosed = true
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive',
      },
    })
  }
)
