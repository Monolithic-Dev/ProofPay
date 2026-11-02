'use client'

/**
 * Live Contract Events via Server-Sent Events (SSE).
 * Reconnects with exponential backoff (1s -> 10s) and resumes from last seen seq.
 * Automatically invalidates React Query caches on incoming ledger events.
 * Implements phase-6-frontend.md §6.2.
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

export interface ContractUpdatedEvent {
  contract_id: string
  type: string
  milestone_key?: string
  seq: number
}

export function useContractEvents(contractId: string | undefined | null) {
  const queryClient = useQueryClient()
  const lastSeqRef = useRef<number>(0)
  const seenSeqsRef = useRef<Set<number>>(new Set())
  const [isConnected, setIsConnected] = useState(false)
  const [latestEvent, setLatestEvent] = useState<ContractUpdatedEvent | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const backoffMsRef = useRef<number>(1000)

  const handleEvent = useCallback(
    (ev: ContractUpdatedEvent) => {
      // Deduplicate by seq
      if (seenSeqsRef.current.has(ev.seq)) return
      seenSeqsRef.current.add(ev.seq)
      if (ev.seq > lastSeqRef.current) {
        lastSeqRef.current = ev.seq
      }

      setLatestEvent(ev)

      if (contractId) {
        queryClient.invalidateQueries({ queryKey: ['contract', contractId] })
        queryClient.invalidateQueries({ queryKey: ['ledger', contractId] })
        if (ev.milestone_key) {
          queryClient.invalidateQueries({
            queryKey: ['milestone', contractId, ev.milestone_key],
          })
        }
      }
    },
    [contractId, queryClient]
  )

  useEffect(() => {
    if (!contractId || typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return
    }

    let es: EventSource | null = null
    let isDisposed = false

    function connect() {
      if (isDisposed) return

      const url = `/api/v1/contracts/${contractId}/events?after_seq=${lastSeqRef.current}`
      es = new EventSource(url)

      es.onopen = () => {
        setIsConnected(true)
        backoffMsRef.current = 1000 // reset backoff on successful connect
      }

      es.addEventListener('contract.updated', (event: MessageEvent) => {
        try {
          const parsed = JSON.parse(event.data) as ContractUpdatedEvent
          handleEvent(parsed)
        } catch {
          // ignore malformed message
        }
      })

      es.onerror = () => {
        setIsConnected(false)
        if (es) {
          es.close()
          es = null
        }

        if (!isDisposed) {
          // Schedule reconnect with exponential backoff (1s -> 10s)
          const waitTime = backoffMsRef.current
          backoffMsRef.current = Math.min(backoffMsRef.current * 1.5, 10000)
          reconnectTimeoutRef.current = setTimeout(connect, waitTime)
        }
      }
    }

    connect()

    return () => {
      isDisposed = true
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
      if (es) {
        es.close()
        es = null
      }
      setIsConnected(false)
    }
  }, [contractId, handleEvent])

  return {
    isConnected,
    latestEvent,
    lastSeq: lastSeqRef.current,
  }
}
