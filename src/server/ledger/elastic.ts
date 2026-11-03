/**
 * Elastic Common Schema (ECS 8.x) Exporter for ProofPay Ledger & Audits.
 * Official Sponsor Integration: Elastic (https://paypalaihackathon.devpost.com/details/elastic)
 * Transforms cryptographic ledger events, PayPal state transitions, and AI verification verdicts
 * into standard ECS events for direct Elasticsearch indexing and Kibana dashboards.
 */

export interface EcsAuditRecord {
  '@timestamp': string
  event: {
    kind: 'event'
    category: string[]
    type: string[]
    action: string
    dataset: 'proofpay.ledger' | 'proofpay.verification' | 'proofpay.paypal'
    sequence: number
    hash: string
  }
  proofpay: {
    contract_id: string
    milestone_id?: string
    actor: string
    previous_hash?: string
    canonical_hash: string
    amount_minor?: number
    currency?: string
    paypal_order_id?: string
    paypal_capture_id?: string
    paypal_authorization_id?: string
    verification_decision?: string
    verification_score?: number
  }
  message: string
}

export function formatLedgerEventToEcs(event: {
  seq: number
  type?: string
  event_type?: string
  contract_id: string
  milestone_id?: string | null
  actor?: string
  actor_type?: string
  actor_id?: string | null
  prev_hash?: string
  previous_hash?: string
  hash?: string
  current_hash?: string
  payload?: any
  payload_json?: any
  created_at: Date | string
}): EcsAuditRecord {
  const rawPayload = event.payload ?? event.payload_json ?? {}
  const payload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload
  const timestamp = new Date(event.created_at).toISOString()
  const eventType = event.type ?? event.event_type ?? 'UNKNOWN'
  const currentHash = event.hash ?? event.current_hash ?? ''
  const prevHash = event.prev_hash ?? event.previous_hash ?? ''
  const actor = event.actor ?? (event.actor_id ? `${event.actor_type || 'user'}:${event.actor_id}` : (event.actor_type || 'system'))

  let action = eventType.toLowerCase()
  let category = ['process']
  let type = ['info']
  let dataset: EcsAuditRecord['event']['dataset'] = 'proofpay.ledger'

  if (action.includes('funded') || action.includes('captured') || action.includes('voided') || action.includes('release')) {
    category = ['financial', 'audit']
    type = ['change']
    dataset = 'proofpay.paypal'
  } else if (action.includes('verification') || action.includes('passed') || action.includes('rejected')) {
    category = ['assessment', 'audit']
    type = ['info']
    dataset = 'proofpay.verification'
  }

  return {
    '@timestamp': timestamp,
    event: {
      kind: 'event',
      category,
      type,
      action: `proofpay.${action}`,
      dataset,
      sequence: event.seq,
      hash: currentHash,
    },
    proofpay: {
      contract_id: event.contract_id,
      milestone_id: event.milestone_id || undefined,
      actor,
      previous_hash: prevHash || undefined,
      canonical_hash: currentHash,
      amount_minor: payload.amount_minor,
      currency: payload.currency || 'USD',
      paypal_order_id: payload.order_id || payload.paypal_order_id,
      paypal_capture_id: payload.capture_id || payload.paypal_capture_id,
      paypal_authorization_id: payload.authorization_id || payload.paypal_authorization_id,
      verification_decision: payload.decision || payload.verdict,
      verification_score: payload.score,
    },
    message: `[ProofPay Ledger Seq #${event.seq}] ${eventType} on contract ${event.contract_id} by ${actor}`,
  }
}

/**
 * Formats a list of events into Elasticsearch Bulk API (NDJSON) format
 * ready for `POST /_bulk` indexing into index `proofpay-audit-events`.
 */
export function formatElasticBulkNdjson(events: any[], indexName = 'proofpay-audit-events'): string {
  const lines: string[] = []
  for (const ev of events) {
    const ecs = formatLedgerEventToEcs(ev)
    // Bulk action metadata
    lines.push(JSON.stringify({ index: { _index: indexName, _id: `${ecs.proofpay.contract_id}-${ecs.event.sequence}` } }))
    // Document source
    lines.push(JSON.stringify(ecs))
  }
  return lines.join('\n') + '\n'
}
