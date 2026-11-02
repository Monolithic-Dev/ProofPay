'use client'

/**
 * React Query Client & Domain Hooks.
 * Implements phase-6-frontend.md §6.2.
 */
import React, { createContext, useContext, useState, useMemo } from 'react'
import {
  QueryClient,
  QueryClientProvider as TanstackQueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { createApiClient, type ApiClient } from '@/shared/api-client'
import type { ContractView, MilestoneView, VerificationView, LedgerEvent } from '@/shared/types'

const ApiClientContext = createContext<ApiClient | null>(null)

export function useApiClient(): ApiClient {
  const client = useContext(ApiClientContext)
  if (!client) {
    // Default to relative browser requests
    return createApiClient({ baseUrl: '' })
  }
  return client
}

export function QueryProvider({
  children,
  apiKey,
}: {
  children: React.ReactNode
  apiKey?: string
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 2000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const apiClient = useMemo(
    () => createApiClient({ baseUrl: '', apiKey }),
    [apiKey]
  )

  return (
    <ApiClientContext.Provider value={apiClient}>
      <TanstackQueryClientProvider client={queryClient}>
        {children}
      </TanstackQueryClientProvider>
    </ApiClientContext.Provider>
  )
}

export function useContracts() {
  const api = useApiClient()
  return useQuery({
    queryKey: ['contracts'],
    queryFn: async () => {
      const res = await api.listContracts()
      return res.contracts
    },
  })
}

export function useContract(id: string | undefined | null) {
  const api = useApiClient()
  return useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      if (!id) throw new Error('Contract ID is required')
      return api.getContract(id)
    },
    enabled: Boolean(id),
    refetchInterval: 5000, // fallback polling when SSE is idle
  })
}

export function useMilestone(contractId: string | undefined | null, key: string | undefined | null) {
  const api = useApiClient()
  return useQuery({
    queryKey: ['milestone', contractId, key],
    queryFn: async () => {
      if (!contractId || !key) throw new Error('Contract and Milestone key required')
      return api.getMilestone(contractId, key)
    },
    enabled: Boolean(contractId && key),
  })
}

export function useVerification(id: string | undefined | null) {
  const api = useApiClient()
  return useQuery({
    queryKey: ['verification', id],
    queryFn: async () => {
      if (!id) throw new Error('Verification ID required')
      return api.getVerification(id)
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const v = query.state.data
      return v?.status === 'RUNNING' ? 1000 : false
    },
  })
}

export function useLedger(contractId: string | undefined | null) {
  const api = useApiClient()
  return useQuery({
    queryKey: ['ledger', contractId],
    queryFn: async () => {
      if (!contractId) throw new Error('Contract ID required')
      return api.getLedger(contractId)
    },
    enabled: Boolean(contractId),
  })
}

export function useFundingStatus(contractId: string | undefined | null) {
  const api = useApiClient()
  return useQuery({
    queryKey: ['funding-status', contractId],
    queryFn: async () => {
      if (!contractId) throw new Error('Contract ID required')
      return api.getFundingStatus(contractId)
    },
    enabled: Boolean(contractId),
    refetchInterval: 30000, // 30s per spec
  })
}

export function useCurrentUser() {
  const api = useApiClient()
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me()
      } catch {
        return null
      }
    },
    staleTime: 30000,
  })
}
