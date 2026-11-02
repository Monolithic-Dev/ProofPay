/**
 * Typed API client used by the UI, demo agents, and MCP server.
 * All methods map 1:1 to api-spec.md §4–§8.
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
}

async function request<T>(
  baseUrl: string,
  path: string,
  apiKey: string | undefined,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, idempotencyKey, signal } = opts

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
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
  return res.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
interface ApiClientConfig {
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
    getContract: (id: string) => r<ContractView>(`/api/v1/contracts/${id}`),
    updateContract: (id: string, patch: unknown) =>
      r<ContractView>(`/api/v1/contracts/${id}`, { method: 'PATCH', body: patch }),
    lintContract: (id: string) =>
      r<{ issues: LintIssue[] }>(`/api/v1/contracts/${id}/lint`, { method: 'POST' }),
    applyLintFix: (id: string, issueCode: string) =>
      r<ContractView>(`/api/v1/contracts/${id}/lint/apply`, {
        method: 'POST',
        body: { code: issueCode },
      }),
    proposeContract: (id: string, sellerId: string) =>
      r<ContractView>(`/api/v1/contracts/${id}/propose`, {
        method: 'POST',
        body: { seller_id: sellerId },
      }),
    acceptContract: (id: string) =>
      r<ContractView>(`/api/v1/contracts/${id}/accept`, { method: 'POST' }),
    fundContract: (id: string) =>
      r<{ approval_url: string; order_id: string }>(`/api/v1/contracts/${id}/fund`, {
        method: 'POST',
      }),
    cancelContract: (id: string, reason: string) =>
      r<ContractView>(`/api/v1/contracts/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),

    // --- Milestones ---
    getMilestone: (contractId: string, mid: string) =>
      r<MilestoneView>(`/api/v1/contracts/${contractId}/milestones/${mid}`),
    submitMilestone: (
      contractId: string,
      mid: string,
      payload: {
        content_type: 'json_records' | 'text'
        content_text: string
        note?: string
        idempotency_key?: string
      }
    ) =>
      r<SubmissionView>(
        `/api/v1/contracts/${contractId}/milestones/${mid}/submissions`,
        {
          method: 'POST',
          body: payload,
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
    retryRelease: (contractId: string, mid: string) =>
      r<MilestoneView>(
        `/api/v1/contracts/${contractId}/milestones/${mid}/retry-release`,
        { method: 'POST' }
      ),

    // --- Verifications ---
    getVerification: (vid: string) =>
      r<VerificationView>(`/api/v1/verifications/${vid}`),

    // --- Ledger ---
    getLedger: (contractId: string) =>
      r<{ events: LedgerEvent[] }>(`/api/v1/contracts/${contractId}/ledger`),
    verifyLedger: (contractId: string) =>
      r<{ valid: boolean; broken_at_seq?: number }>(
        `/api/v1/contracts/${contractId}/ledger/verify`
      ),
    getProofPack: (contractId: string) =>
      r<Blob>(`/api/v1/contracts/${contractId}/proof-pack`),

    // --- Demo ---
    runScenario: (name: string) =>
      r<DemoRunView>(`/api/v1/demo/scenarios/${name}/run`, { method: 'POST' }),
    getDemoRun: (id: string) => r<DemoRunView>(`/api/v1/demo/runs/${id}`),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>
