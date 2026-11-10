/**
 * N1 Loophole Finder Patch Apply API — POST /api/v1/contracts/[id]/loophole-scan/apply
 * Applies a validated RFC 6902 JSON Patch closing a confirmed loophole on a DRAFT contract,
 * persists it via applyLoopholePatchToDraft, and re-runs loophole scanning to confirm closure.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Operation } from 'fast-json-patch'
import { apiHandler } from '@/server/http/handler'
import { applyLoopholePatchToDraft } from '@/server/contracts/service'
import { scanContractForLoopholes } from '@/server/contracts/loophole-finder'

const PatchOperationSchema = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
  path: z.string().min(1),
  value: z.unknown().optional(),
  from: z.string().optional(),
})

const ApplyLoopholeBodySchema = z.object({
  strategy_tag: z.string().min(1),
  patch_ops: z.array(PatchOperationSchema).min(1),
  description: z.string().max(300).optional(),
})

export const POST = apiHandler(
  {
    auth: 'user',
    body: ApplyLoopholeBodySchema,
  },
  async ({ user, params, body }) => {
    const contractId = params['id']!
    const updatedContract = await applyLoopholePatchToDraft(contractId, user!, {
      strategyTag: body!.strategy_tag,
      patchOps: body!.patch_ops as Operation[],
      description: body!.description,
    })

    const rescan = await scanContractForLoopholes({
      ...(updatedContract.contract_json || {}),
      id: updatedContract.id,
      version: updatedContract.version,
    })

    return NextResponse.json(
      {
        contract: updatedContract,
        patch_applied: true,
        remaining_loopholes: rescan.loopholes_confirmed,
        rescan,
      },
      { status: 200 }
    )
  }
)

