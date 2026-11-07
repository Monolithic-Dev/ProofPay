/**
 * Unit Tests: OpenTelemetry Distributed Tracing & W3C Trace Context
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Tracer, defaultTracer, traceExporter } from '@/server/telemetry/tracer'

describe('OpenTelemetry Distributed Tracing (Tracer)', () => {
  beforeEach(() => {
    traceExporter.clear()
  })

  describe('W3C Traceparent Header Parsing & Formatting', () => {
    it('generates valid 32-hex traceId and 16-hex spanId', () => {
      const traceId = Tracer.generateTraceId()
      const spanId = Tracer.generateSpanId()

      expect(traceId).toHaveLength(32)
      expect(spanId).toHaveLength(16)
      expect(/^[0-9a-f]+$/.test(traceId)).toBe(true)
      expect(/^[0-9a-f]+$/.test(spanId)).toBe(true)
    })

    it('formats SpanContext into standard W3C traceparent string', () => {
      const ctx = {
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: '01',
      }
      const header = Tracer.formatTraceparent(ctx)
      expect(header).toBe('00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01')
    })

    it('parses valid W3C traceparent header correctly', () => {
      const header = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01'
      const parsed = Tracer.parseTraceparent(header)

      expect(parsed).toEqual({
        traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
        spanId: '00f067aa0ba902b7',
        traceFlags: '01',
      })
    })

    it('returns null on invalid or missing traceparent header', () => {
      expect(Tracer.parseTraceparent(null)).toBeNull()
      expect(Tracer.parseTraceparent('')).toBeNull()
      expect(Tracer.parseTraceparent('invalid-format')).toBeNull()
      expect(Tracer.parseTraceparent('01-abc-123')).toBeNull()
    })
  })

  describe('Span Lifecycle & Export', () => {
    it('creates a root span when no parent context is provided', () => {
      const span = defaultTracer.startSpan('paypal.authorize')
      expect(span.name).toBe('paypal.authorize')
      expect(span.parentSpanId).toBeUndefined()
      expect(span.context.traceId).toHaveLength(32)
      expect(span.context.spanId).toHaveLength(16)
      expect(span.status.code).toBe('UNSET')
    })

    it('inherits traceId from parent context for distributed propagation', () => {
      const parentCtx = {
        traceId: '11112222333344445555666677778888',
        spanId: '9999000011112222',
        traceFlags: '01',
      }

      const childSpan = defaultTracer.startSpan('verifier.rubric', parentCtx)
      expect(childSpan.context.traceId).toBe(parentCtx.traceId)
      expect(childSpan.parentSpanId).toBe(parentCtx.spanId)
      expect(childSpan.context.spanId).not.toBe(parentCtx.spanId)
    })

    it('records successful span in exporter with withSpan helper', async () => {
      const result = await defaultTracer.withSpan(
        'paypal.capture_payment',
        null,
        async (span) => {
          span.attributes['paypal.order_id'] = 'ORDER-12345'
          return 'captured_success'
        },
        { 'contract.id': 'c-100' }
      )

      expect(result).toBe('captured_success')
      const spans = traceExporter.getSpans()
      expect(spans).toHaveLength(1)
      expect(spans[0]?.name).toBe('paypal.capture_payment')
      expect(spans[0]?.status.code).toBe('OK')
      expect(spans[0]?.attributes['paypal.order_id']).toBe('ORDER-12345')
      expect(spans[0]?.attributes['contract.id']).toBe('c-100')
      expect(spans[0]?.endTimeMs).toBeGreaterThanOrEqual(spans[0]?.startTimeMs ?? 0)
    })

    it('records error status and propagates exceptions in withSpan', async () => {
      await expect(
        defaultTracer.withSpan('verifier.consensus', null, async () => {
          throw new Error('Consensus timeout')
        })
      ).rejects.toThrow('Consensus timeout')

      const spans = traceExporter.getSpans()
      expect(spans).toHaveLength(1)
      expect(spans[0]?.status.code).toBe('ERROR')
      expect(spans[0]?.status.message).toBe('Consensus timeout')
      expect(spans[0]?.attributes['error']).toBe(true)
    })
  })
})

