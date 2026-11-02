/**
 * RECONCILE_PAYPAL Job Handler.
 * Implements phase-5-paypal-funding-and-release.md §5.8.
 */
import { reconcileContract, findStuckContracts } from '@/server/release/reconcile'
import { logger } from '@/server/util/logger'

export interface ReconcilePaypalPayload {
  contract_id?: string
  milestone_key?: string
}

export async function handleReconcilePaypal(payload: ReconcilePaypalPayload): Promise<void> {
  const log = logger.child({ job: 'RECONCILE_PAYPAL', payload })

  if (payload.contract_id) {
    log.info('Reconciling single contract')
    const res = await reconcileContract(payload.contract_id)
    log.info({ actions: res.actions }, 'Reconciliation finished for contract')
    return
  }

  // Sweep all stuck contracts
  log.info('Running global stuck contract reconciliation sweep')
  const stuckIds = await findStuckContracts()
  for (const cid of stuckIds) {
    try {
      await reconcileContract(cid)
    } catch (err) {
      log.warn({ err: String(err), contract_id: cid }, 'Failed to reconcile contract in sweep')
    }
  }
}
