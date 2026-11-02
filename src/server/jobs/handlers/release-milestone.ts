/**
 * RELEASE_MILESTONE Job Handler.
 * Implements phase-5-paypal-funding-and-release.md §5.6.
 */
import { releaseMilestone } from '@/server/release/service'
import { logger } from '@/server/util/logger'

export interface ReleaseMilestonePayload {
  contract_id: string
  milestone_id?: string
  milestone_key?: string
}

export async function handleReleaseMilestone(payload: ReleaseMilestonePayload): Promise<void> {
  const { contract_id, milestone_id, milestone_key } = payload
  const log = logger.child({ job: 'RELEASE_MILESTONE', contract_id, milestone_id, milestone_key })
  log.info('Executing RELEASE_MILESTONE job')

  await releaseMilestone({
    contractId: contract_id,
    milestoneId: milestone_id,
    milestoneKey: milestone_key,
  })
}
