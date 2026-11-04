import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'

function canonicalize(value) {
  if (value === undefined) throw new TypeError('Cannot canonicalize undefined')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']'
  }
  const obj = value
  const sortedKeys = Object.keys(obj).sort()
  const pairs = []
  for (const k of sortedKeys) {
    const val = obj[k]
    if (val !== undefined) {
      pairs.push(JSON.stringify(k) + ':' + canonicalize(val))
    }
  }
  return '{' + pairs.join(',') + '}'
}

function sha256Hex(text) {
  return createHash('sha256').update(text).digest('hex')
}

const contractId = 'c7a40b32-8419-4a0b-9df1-87a3e9c4021a'
const ZERO_HASH = '0'.repeat(64)

const events = [
  {
    seq: 1,
    type: 'CONTRACT_LOCKED',
    payload: { title: 'Q4 Market Research & Competitive Analysis', total_minor: 12000, currency: 'USD' },
    created_at: '2026-11-03T09:00:00.000Z',
  },
  {
    seq: 2,
    type: 'PAYPAL_AUTHORIZATION_CREATED',
    payload: { paypal_order_id: '9WB63728HU345672J', authorization_id: '4HJ89234KL123456M', amount_minor: 12000, status: 'CREATED' },
    created_at: '2026-11-03T09:15:00.000Z',
  },
  {
    seq: 3,
    type: 'PAYPAL_AUTHORIZATION_APPROVED',
    payload: { authorization_id: '4HJ89234KL123456M', amount_minor: 12000, status: 'COMPLETED' },
    created_at: '2026-11-03T09:16:30.000Z',
  },
  {
    seq: 4,
    type: 'SUBMISSION_VERIFIED',
    payload: { milestone_key: 'm1', decision: 'PASS', criteria_passed: 3, latency_ms: 284 },
    created_at: '2026-11-03T14:20:00.000Z',
  },
  {
    seq: 5,
    type: 'PAYPAL_CAPTURE_COMPLETED',
    payload: { milestone_key: 'm1', capture_id: '7XY99214PQ876543Z', amount_minor: 6000, remaining_minor: 6000 },
    created_at: '2026-11-03T14:20:15.000Z',
  },
]

let prev = ZERO_HASH
const hashedLedger = []
for (const ev of events) {
  const raw = [prev, contractId, String(ev.seq), ev.type, canonicalize(ev.payload), new Date(ev.created_at).toISOString()].join('|')
  const hash = sha256Hex(raw)
  hashedLedger.push({
    seq: ev.seq,
    type: ev.type,
    payload: ev.payload,
    prev_hash: prev,
    hash,
    created_at: ev.created_at,
  })
  prev = hash
}

const proofPack = {
  version: '1.0',
  contract: {
    id: contractId,
    title: 'Q4 Market Research & Competitive Analysis',
    status: 'ACTIVE',
    currency: 'USD',
    total_minor: 12000,
  },
  ledger: hashedLedger,
  summary: {
    total_events: hashedLedger.length,
    head_hash: prev,
    generated_at: new Date().toISOString(),
  },
}

fs.writeFileSync('docs/proof-pack-sample.json', JSON.stringify(proofPack, null, 2))
console.log('✓ Wrote docs/proof-pack-sample.json')

const paypalActivity = {
  contract_id: contractId,
  environment: 'sandbox',
  captured_at: new Date().toISOString(),
  timeline: [
    {
      id: 'pp_call_001',
      operation: 'CREATE_ORDER',
      method: 'POST',
      endpoint: '/v2/checkout/orders',
      status: 201,
      paypal_request_id: 'ord_req_9238f01a-1123',
      paypal_debug_id: 'dbg_9348102a9e3',
      latency_ms: 320,
      timestamp: '2026-11-03T09:14:58.000Z',
      outcome: 'COMPLETED',
      details: { intent: 'AUTHORIZE', currency: 'USD', value: '120.00' },
    },
    {
      id: 'pp_call_002',
      operation: 'AUTHORIZE_PAYMENT',
      method: 'POST',
      endpoint: '/v2/checkout/orders/9WB63728HU345672J/authorize',
      status: 201,
      paypal_request_id: 'auth_req_b823e911-3829',
      paypal_debug_id: 'dbg_aa91028471b',
      latency_ms: 412,
      timestamp: '2026-11-03T09:16:30.000Z',
      outcome: 'COMPLETED',
      details: { authorization_id: '4HJ89234KL123456M', status: 'CREATED', expiration_time: '2026-12-02T09:16:30.000Z' },
    },
    {
      id: 'pp_call_003',
      operation: 'CAPTURE_AUTHORIZATION',
      method: 'POST',
      endpoint: '/v2/payments/authorizations/4HJ89234KL123456M/capture',
      status: 201,
      paypal_request_id: 'cap_req_77264810-9921',
      paypal_debug_id: 'dbg_fe8371902bb',
      latency_ms: 489,
      timestamp: '2026-11-03T14:20:15.000Z',
      outcome: 'COMPLETED',
      details: { capture_id: '7XY99214PQ876543Z', amount: '60.00', final_capture: false },
    },
    {
      id: 'pp_webhook_001',
      operation: 'WEBHOOK_EVENT',
      event_type: 'PAYMENT.AUTHORIZATION.CREATED',
      signature_status: 'VERIFIED',
      http_status: 200,
      timestamp: '2026-11-03T09:16:32.000Z',
      outcome: 'PROCESSED',
      details: { resource_id: '4HJ89234KL123456M' },
    },
    {
      id: 'pp_webhook_002',
      operation: 'WEBHOOK_EVENT',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      signature_status: 'VERIFIED',
      http_status: 200,
      timestamp: '2026-11-03T14:20:18.000Z',
      outcome: 'PROCESSED',
      details: { resource_id: '7XY99214PQ876543Z' },
    },
  ],
}

fs.writeFileSync('docs/paypal-activity-sample.json', JSON.stringify(paypalActivity, null, 2))
console.log('✓ Wrote docs/paypal-activity-sample.json')

