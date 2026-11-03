/**
 * Typed API client used by the UI, demo agents, and MCP server.
 * All methods map 1:1 to api-spec.md §4–§8 and phase-6-frontend.md §6.2.
 */
import type {
  ContractView,
  MilestoneView,
  VerificationView,
  LedgerEvent,
  UserView,
  DemoRunView,
  LintIssue,
  SubmissionView,
  ApiKeyView,
} from './types'

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------
export class ApiClientError extends Error {
  public readonly code: string
  public readonly status: number
  public readonly requestId: string

  constructor(code: string, message: string, status: number, requestId: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.requestId = requestId
  }
}

// ---------------------------------------------------------------------------
// Core fetcher
// ---------------------------------------------------------------------------
interface RequestOptions {
  method?: string
  body?: unknown
  idempotencyKey?: string
  signal?: AbortSignal
  responseType?: 'json' | 'blob'
}

async function request<T>(
  baseUrl: string,
  path: string,
  apiKey: string | undefined,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, idempotencyKey, signal, responseType = 'json' } = opts

  const headers: Record<string, string> = {
    Accept: responseType === 'blob' ? 'application/pdf, application/json' : 'application/json',
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })

  const requestId = res.headers.get('X-Request-Id') ?? 'unknown'

  if (!res.ok) {
    let code = 'HTTP_ERROR'
    let message = `HTTP ${res.status}`
    try {
      const json = (await res.json()) as { error?: { code?: string; message?: string } }
      if (json.error) {
        code = json.error.code ?? code
        message = json.error.message ?? message
      }
    } catch {
      // ignore parse error, use default message
    }
    throw new ApiClientError(code, message, res.status, requestId)
  }

  if (res.status === 204) return undefined as T
  if (responseType === 'blob') {
    return (await res.blob()) as unknown as T
  }
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export interface ApiClientConfig {
  baseUrl: string
  apiKey?: string
}

export function createApiClient({ baseUrl, apiKey }: ApiClientConfig) {
  const r = <T>(path: string, opts?: RequestOptions) =>
    request<T>(baseUrl, path, apiKey, opts)

  return {
    // --- Auth ---
    me: () => r<UserView>('/api/v1/me'),
    demoLogin: (personaKey: string) =>
      r<UserView>('/api/v1/auth/demo-login', {
        method: 'POST',
        body: { persona_key: personaKey },
      }),
    logout: () => r<void>('/api/v1/auth/logout', { method: 'POST' }),

    // --- Contracts ---
    listContracts: () => r<{ contracts: ContractView[] }>('/api/v1/contracts'),
    compileContract: (prompt: string) =>
      r<{ contract: ContractView; issues: LintIssue[] }>('/api/v1/contracts/compile', {
        method: 'POST',
        body: { prompt },
      }),
    getContract: async (id: string) => {
      const res = await r<any>(`/api/v1/contracts/${id}`)
      return (res?.contract ?? res) as ContractView
    },
    updateContract: async (id: string, patch: unknown) => {
      const res = await r<any>(`/api/v1/contracts/${id}`, { method: 'PATCH', body: patch })
      return (res?.contract ?? res) as ContractView
    },
    patchContract: async (id: string, patch: unknown) => {
      const res = await r<any>(`/api/v1/contracts/${id}`, { method: 'PATCH', body: patch })
      return (res?.contract ?? res) as ContractView
    },
    lintContract: (id: string) =>
      r<{ issues: LintIssue[] }>(`/api/v1/contracts/${id}/lint`, { method: 'POST' }),
    applyLintFix: async (id: string, issueCode: string) => {
      const res = await r<any>(`/api/v1/contracts/${id}/lint/apply`, {
        method: 'POST',
        body: { code: issueCode },
      })
      return (res?.contract ?? res) as ContractView
    },
    proposeContract: async (id: string, sellerIdOrEmail: string) => {
      const res = await r<any>(`/api/v1/contracts/${id}/propose`, {
        method: 'POST',
        body: sellerIdOrEmail.includes('@')
          ? { seller_email: sellerIdOrEmail }
          : { seller_id: sellerIdOrEmail },
      })
      return (res?.contract ?? res) as ContractView
    },
    acceptContract: async (id: string) => {
      const res = await r<any>(`/api/v1/contracts/${id}/accept`, { method: 'POST' })
      return (res?.contract ?? res) as ContractView
    },
    fundContract: (id: string) =>
      r<{ approval_url: string; order_id: string }>(`/api/v1/contracts/${id}/fund`, {
        method: 'POST',
      }),
    startFunding: (id: string) =>
      r<{ approval_url: string; order_id: string }>(`/api/v1/contracts/${id}/fund`, {
        method: 'POST',
      }),
    getFundingStatus: (id: string) =>
      r<{
        verified: boolean
        authorization_id?: string
        status?: string
        authorized_at?: string
        amount_minor?: number
        cached?: boolean
        checked_at: string
      }>(`/api/v1/contracts/${id}/funding-status`),
    cancelContract: (id: string, reason: string) =>
      r<ContractView>(`/api/v1/contracts/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),

    // --- Milestones ---
    getMilestone: async (contractId: string, mid: string) => {
      const res = await r<any>(`/api/v1/contracts/${contractId}/milestones/${mid}`)
      return (res?.milestone ?? res) as MilestoneView
    },
    submitMilestone: (
      contractId: string,
      mid: string,
      payload: {
        content_type: 'json_records' | 'text'
        content?: unknown
        content_text?: string
        note?: string
        idempotency_key?: string
      }
    ) =>
      r<SubmissionView>(
        `/api/v1/contracts/${contractId}/milestones/${mid}/submissions`,
        {
          method: 'POST',
          body: {
            content_type: payload.content_type,
            content: payload.content ?? payload.content_text,
            content_text: payload.content_text ?? (typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.content)),
            note: payload.note,
          },
          idempotencyKey: payload.idempotency_key,
        }
      ),
    submitDeliverable: (
      contractId: string,
      mid: string,
      payload: {
        content_type: 'json_records' | 'text'
        content?: unknown
        content_text?: string
        note?: string
        idempotency_key?: string
      }
    ) =>
      r<SubmissionView>(
        `/api/v1/contracts/${contractId}/milestones/${mid}/submissions`,
        {
          method: 'POST',
          body: {
            content_type: payload.content_type,
            content: payload.content ?? payload.content_text,
            content_text: payload.content_text ?? (typeof payload.content === 'string' ? payload.content : JSON.stringify(payload.content)),
            note: payload.note,
          },
          idempotencyKey: payload.idempotency_key,
        }
      ),
    decideOnMilestone: (
      contractId: string,
      mid: string,
      decision: 'PASS' | 'REJECT',
      note?: string
    ) =>
      r<MilestoneView>(`/api/v1/contracts/${contractId}/milestones/${mid}/decision`, {
        method: 'POST',
        body: { decision, note },
      }),
    decideEscalation: (
      contractId: string,
      mid: string,
      decision: 'PASS' | 'REJECT',
      note?: string
    ) =>
      r<MilestoneView>(`/api/v1/contracts/${contractId}/milestones/${mid}/decision`, {
        method: 'POST',
        body: { decision, note },
      }),
    retryRelease: (contractId: string, mid: string) =>
      r<MilestoneView>(
        `/api/v1/contracts/${contractId}/milestones/${mid}/retry-release`,
        { method: 'POST' }
      ),

    // --- Verifications ---
    getVerification: async (vid: string) => {
      const res = await r<any>(`/api/v1/verifications/${vid}`)
      return (res?.verification ?? res) as VerificationView
    },

    // --- Chaos ---
    setChaos: (contractId: string, mockCode?: string) =>
      r<{ chaos_mock_code: string | null }>(`/api/v1/contracts/${contractId}/chaos`, {
        method: 'POST',
        body: { mock_code: mockCode },
      }),

    // --- Ledger & Proof Pack ---
    getLedger: (contractId: string, afterSeq?: number, limit?: number) => {
      const q = new URLSearchParams()
      if (afterSeq !== undefined) q.set('after_seq', afterSeq.toString())
      if (limit !== undefined) q.set('limit', limit.toString())
      const qs = q.toString() ? `?${q.toString()}` : ''
      return r<{ events: LedgerEvent[]; head_hash: string }>(
        `/api/v1/contracts/${contractId}/ledger${qs}`
      )
    },
    verifyLedger: (contractId: string) =>
      r<{ valid: boolean; checked: number; broken_at_seq: number | null }>(
        `/api/v1/contracts/${contractId}/ledger/verify`
      ),
    downloadProofPack: (contractId: string, format: 'json' | 'pdf' = 'json') =>
      r<Blob>(`/api/v1/contracts/${contractId}/proof-pack?format=${format}`, {
        responseType: format === 'pdf' ? 'blob' : 'json',
      }),
    getProofPack: (contractId: string) =>
      r<Blob>(`/api/v1/contracts/${contractId}/proof-pack`),

    // --- API Keys ---
    listApiKeys: () => r<{ api_keys: ApiKeyView[] }>('/api/v1/me/api-keys'),
    createApiKey: (label: string) =>
      r<{ id: string; key: string; label: string; prefix: string; created_at: string }>(
        '/api/v1/me/api-keys',
        { method: 'POST', body: { label } }
      ),
    revokeApiKey: (keyId: string) =>
      r<{ ok: boolean }>(`/api/v1/me/api-keys/${keyId}`, { method: 'DELETE' }),

    // --- Demo ---
    runScenario: (name: string) =>
      r<DemoRunView>(`/api/v1/demo/scenarios/${name}/run`, { method: 'POST' }),
    getDemoRun: (id: string) => r<DemoRunView>(`/api/v1/demo/runs/${id}`),
    getRun: (id: string) => r<DemoRunView>(`/api/v1/demo/runs/${id}`),
    getHealth: () =>
      r<{
        status: string
        features?: { chaos: boolean; demo: boolean }
      }>('/api/v1/health'),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
