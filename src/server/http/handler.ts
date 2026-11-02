/**
 * Unified API handler wrapper — implements phase-3-auth-and-contracts.md §3.2 & api-spec.md §3.
 * Handles request_id, auth, rate limiting, body size limits, error mapping, and security headers.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { z, ZodError } from 'zod'
import { newRequestId } from '@/server/util/ids'
import { toErrorResponse, httpStatusFor, AppError } from '@/server/util/errors'
import { requireUser, type SessionUser } from '@/server/auth/guards'
import { rateLimit, clientIp } from '@/server/util/rate-limit'
import { withIdempotency } from '@/server/util/idempotency'

export interface HandlerConfig<TBody = unknown, TQuery = unknown> {
  auth?: 'none' | 'user'
  rateLimit?: {
    limit: number
    windowMs: number
    byIp?: boolean
  }
  maxBytes?: number
  body?: z.ZodType<TBody>
  query?: z.ZodType<TQuery>
  idempotent?: boolean
}

export interface HandlerContext<TBody = unknown, TQuery = unknown> {
  req: NextRequest
  requestId: string
  user?: SessionUser
  body?: TBody
  query?: TQuery
  params: Record<string, string>
}

export function apiHandler<TResponse, TBody = unknown, TQuery = unknown>(
  config: HandlerConfig<TBody, TQuery>,
  fn: (ctx: HandlerContext<TBody, TQuery>) => Promise<NextResponse<TResponse> | Response>
) {
  return async (req: NextRequest, { params }: { params?: Promise<Record<string, string>> | Record<string, string> } = {}): Promise<Response> => {
    const requestId = newRequestId()
    const resolvedParams = params ? (params instanceof Promise ? await params : params) : {}

    try {
      // 1. Rate limiting check
      if (config.rateLimit) {
        const ip = clientIp(req)
        const key = config.rateLimit.byIp
          ? `rate:${req.nextUrl.pathname}:${ip}`
          : `rate:${req.nextUrl.pathname}:${req.headers.get('authorization') || ip}`

        const limitRes = rateLimit({
          key,
          limit: config.rateLimit.limit,
          windowMs: config.rateLimit.windowMs,
        })

        if (!limitRes.ok) {
          return NextResponse.json(
            {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please slow down.',
                request_id: requestId,
              },
            },
            {
              status: 429,
              headers: {
                'X-Request-Id': requestId,
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(limitRes.resetAt / 1000)),
              },
            }
          )
        }
      }

      // 2. Auth check
      let user: SessionUser | undefined
      if (config.auth === 'user') {
        user = await requireUser(req)
      }

      // 3. Request body parsing and size check
      let parsedBody: TBody | undefined
      if (config.body && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
        const maxBytes = config.maxBytes ?? 50 * 1024 // default 50 KB
        const rawText = await req.text()

        if (Buffer.byteLength(rawText, 'utf8') > maxBytes) {
          throw new AppError(
            'VALIDATION_FAILED',
            `Payload exceeds maximum allowed size of ${maxBytes} bytes`,
            400
          )
        }

        let jsonPayload: unknown = {}
        try {
          jsonPayload = rawText ? JSON.parse(rawText) : {}
        } catch {
          throw new AppError('BAD_REQUEST', 'Invalid JSON payload', 400)
        }

        const bodyResult = config.body.safeParse(jsonPayload)
        if (!bodyResult.success) {
          throw bodyResult.error
        }
        parsedBody = bodyResult.data
      }

      // 4. Query parsing
      let parsedQuery: TQuery | undefined
      if (config.query) {
        const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries())
        const queryResult = config.query.safeParse(queryParams)
        if (!queryResult.success) {
          throw queryResult.error
        }
        parsedQuery = queryResult.data
      }

      // 5. Idempotent route execution
      const idempotencyKey = req.headers.get('idempotency-key') || req.headers.get('Idempotency-Key')
      if (config.idempotent && idempotencyKey && user) {
        const cached = await withIdempotency(
          {
            userId: user.sub,
            route: req.nextUrl.pathname,
            key: idempotencyKey,
            requestBody: parsedBody,
          },
          async () => {
            const resp = await fn({
              req,
              requestId,
              user,
              body: parsedBody,
              query: parsedQuery,
              params: resolvedParams,
            })
            const data = await resp.json()
            return { status: resp.status, body: data }
          }
        )

        return NextResponse.json(cached.body, {
          status: cached.status,
          headers: { 'X-Request-Id': requestId },
        })
      }

      // 6. Normal execution
      const response = await fn({
        req,
        requestId,
        user,
        body: parsedBody,
        query: parsedQuery,
        params: resolvedParams,
      })

      // Attach X-Request-Id header to response
      response.headers.set('X-Request-Id', requestId)
      return response
    } catch (err: unknown) {
      if (err instanceof ZodError) {
        const details = err.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        }))
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_FAILED',
              message: 'Request schema validation failed',
              details,
              request_id: requestId,
            },
          },
          { status: 400, headers: { 'X-Request-Id': requestId } }
        )
      }

      const status = httpStatusFor(err)
      const errorBody = toErrorResponse(err, requestId)
      return NextResponse.json(errorBody, {
        status,
        headers: { 'X-Request-Id': requestId },
      })
    }
  }
}
