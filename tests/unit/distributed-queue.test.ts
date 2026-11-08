/**
 * Unit Tests: Distributed Job Queue & Dead-Letter Queue (DLQ) Engine
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { DistributedJobQueue } from '@/server/queue/distributed'

describe('Distributed Job Queue & Dead-Letter Queue (DLQ)', () => {
  let queue: DistributedJobQueue<{ contractId: string; amountMinor: number }>

  beforeEach(() => {
    queue = new DistributedJobQueue('test-settlement-queue', { maxAttempts: 3 })
  })

  describe('add & deduplication', () => {
    it('enqueues a new job with initial waiting state', async () => {
      const job = await queue.add('RELEASE_MILESTONE', { contractId: 'c-1', amountMinor: 5000 })
      expect(job.id).toBeTruthy()
      expect(job.type).toBe('RELEASE_MILESTONE')
      expect(job.state).toBe('waiting')
      expect(job.attemptsMade).toBe(0)
      expect(job.maxAttempts).toBe(3)
    })

    it('deduplicates identical jobId and prevents duplicate processing', async () => {
      const job1 = await queue.add(
        'RELEASE_MILESTONE',
        { contractId: 'c-1', amountMinor: 5000 },
        { jobId: 'release_c1_m1' }
      )
      const job2 = await queue.add(
        'RELEASE_MILESTONE',
        { contractId: 'c-1', amountMinor: 5000 },
        { jobId: 'release_c1_m1' }
      )

      expect(job1.id).toBe(job2.id)
      const metrics = await queue.getMetrics()
      expect(metrics.waiting).toBe(1)
    })
  })

  describe('job processing lifecycle & completion', () => {
    it('claims next available job and marks as active then completed', async () => {
      await queue.add('VERIFY_SUBMISSION', { contractId: 'c-2', amountMinor: 1000 })

      const claimed = await queue.getNextJob()
      expect(claimed).not.toBeNull()
      expect(claimed?.state).toBe('active')
      expect(claimed?.processedAt).toBeTypeOf('number')

      await queue.completeJob(claimed!.id)
      expect(claimed?.state).toBe('completed')
      expect(claimed?.finishedAt).toBeTypeOf('number')

      const metrics = await queue.getMetrics()
      expect(metrics.completed).toBe(1)
      expect(metrics.active).toBe(0)
      expect(metrics.waiting).toBe(0)
    })
  })

  describe('retry backoff & Dead-Letter Queue (DLQ) routing', () => {
    it('retries job up to maxAttempts before routing to DLQ', async () => {
      const job = await queue.add('RECONCILE_PAYPAL', { contractId: 'c-3', amountMinor: 0 }, { attempts: 2 })

      // First failure
      const claimed1 = await queue.getNextJob()
      const res1 = await queue.failJob(claimed1!.id, new Error('PayPal gateway 503 timeout'))
      expect(res1).toBe('retrying')
      expect(job.attemptsMade).toBe(1)
      expect(job.state).toBe('waiting')

      // Second failure (terminal)
      const claimed2 = await queue.getNextJob()
      const res2 = await queue.failJob(claimed2!.id, new Error('PayPal gateway 503 timeout'))
      expect(res2).toBe('moved_to_dlq')
      expect(job.attemptsMade).toBe(2)
      expect(job.state).toBe('failed')

      const metrics = await queue.getMetrics()
      expect(metrics.failed).toBe(1)
      expect(metrics.dlqCount).toBe(1)

      const dlq = queue.getDlqJobs()
      expect(dlq).toHaveLength(1)
      expect(dlq[0]?.id).toBe(job.id)
      expect(dlq[0]?.failedReason).toBe('PayPal gateway 503 timeout')
    })
  })
})

