/**
 * OpenTelemetry Distributed Tracing & Observability Engine.
 * Enterprise Pillar 2 & 4 — Operational Resilience & Non-Repudiation Observability.
 *
 * Provides vendor-neutral distributed tracing for:
 *   - Next.js API route handlers
 *   - PayPal SDK network calls (authorizations, captures, voids)
 *   - AI verification pipeline spans (rubric, adversarial, deterministic)
 *   - Merkle & RFC 3161 timestamping checkpoints
 *
 * Follows W3C Trace Context (traceparent / tracestate).
 */
import { randomBytes } from 'crypto'

export interface SpanContext {
  traceId: string
  spanId: string
  traceFlags: string
}

export interface Span {
  name: string
  context: SpanContext
  parentSpanId?: string
  startTimeMs: number
  endTimeMs?: number
  attributes: Record<string, string | number | boolean>
  events: Array<{ name: string; timestampMs: number; attributes?: Record<string, unknown> }>
  status: { code: 'OK' | 'ERROR' | 'UNSET'; message?: string }
}

export class InMemoryTraceExporter {
  private spans: Span[] = []

  export(span: Span): void {
    this.spans.push(span)
    // Keep max 500 in memory for debugging / metrics
    if (this.spans.length > 500) {
      this.spans.shift()
    }
  }

  getSpans(): readonly Span[] {
    return this.spans
  }

  clear(): void {
    this.spans = []
  }
}

export const traceExporter = new InMemoryTraceExporter()

export class Tracer {
  private name: string

  constructor(name: string) {
    this.name = name
  }

  /**
   * Generates a 16-byte random hex trace ID (W3C standard)
   */
  static generateTraceId(): string {
    return randomBytes(16).toString('hex')
  }

  /**
   * Generates an 8-byte random hex span ID (W3C standard)
   */
  static generateSpanId(): string {
    return randomBytes(8).toString('hex')
  }

  /**
   * Parses incoming W3C traceparent header: 00-{traceId}-{parentSpanId}-{flags}
   */
  static parseTraceparent(traceparent?: string | null): SpanContext | null {
    if (!traceparent) return null
    const parts = traceparent.trim().split('-')
    if (parts.length < 4) return null
    const [version, traceId, spanId, flags] = parts
    if (version !== '00' || !traceId || !spanId) return null
    return {
      traceId,
      spanId,
      traceFlags: flags || '01',
    }
  }

  /**
   * Serializes SpanContext to W3C traceparent header
   */
  static formatTraceparent(context: SpanContext): string {
    return `00-${context.traceId}-${context.spanId}-${context.traceFlags}`
  }

  /**
   * Starts a new span, optionally linked to a parent context
   */
  startSpan(name: string, parentContext?: SpanContext | null, initialAttributes?: Record<string, string | number | boolean>): Span {
    const traceId = parentContext?.traceId || Tracer.generateTraceId()
    const spanId = Tracer.generateSpanId()

    return {
      name,
      context: {
        traceId,
        spanId,
        traceFlags: parentContext?.traceFlags || '01',
      },
      parentSpanId: parentContext?.spanId,
      startTimeMs: Date.now(),
      attributes: {
        'service.name': this.name,
        ...(initialAttributes || {}),
      },
      events: [],
      status: { code: 'UNSET' },
    }
  }

  /**
   * Ends a span and exports it
   */
  endSpan(span: Span, status: 'OK' | 'ERROR' = 'OK', errorMessage?: string): void {
    span.endTimeMs = Date.now()
    span.status = {
      code: status,
      message: errorMessage,
    }
    traceExporter.export(span)
  }

  /**
   * Convenient wrapper to trace an async function call
   */
  async withSpan<T>(
    name: string,
    parentContext: SpanContext | null | undefined,
    fn: (span: Span) => Promise<T>,
    attributes?: Record<string, string | number | boolean>
  ): Promise<T> {
    const span = this.startSpan(name, parentContext, attributes)
    try {
      const result = await fn(span)
      this.endSpan(span, 'OK')
      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      span.attributes['error'] = true
      span.attributes['error.message'] = msg
      this.endSpan(span, 'ERROR', msg)
      throw err
    }
  }
}

export const defaultTracer = new Tracer('proofpay-core')

