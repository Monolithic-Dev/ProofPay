/**
 * Interactive Zero-Login Demo API for N1 Loophole Finder — /api/v1/demo/loophole
 * Lets judges run real deterministic red-team probes against preset or edited
 * ContractSchema documents and apply RFC 6902 patches + live re-test.
 */
import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { Operation } from 'fast-json-patch'
import { apiHandler } from '@/server/http/handler'
import { applyPatchSafe } from '@/server/contracts/lint/patch'
import {
  DEMO_LOOPHOLE_PRESETS,
  scanContractForLoopholes,
} from '@/server/contracts/loophole-finder'
import { ValidationError } from '@/server/util/errors'

const DemoLoopholePostSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('scan'),
    contract: z.record(z.unknown()),
  }),
  z.object({
    action: z.literal('apply_and_retest'),
    contract: z.record(z.unknown()),
    strategy_tag: z.string().min(1),
    patch_ops: z.array(
      z.object({
        op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
        path: z.string().min(1),
        value: z.unknown().optional(),
        from: z.string().optional(),
      })
    ).min(1),
  }),
])

export const GET = apiHandler({ auth: 'none' }, async () => {
  const initialPreset = DEMO_LOOPHOLE_PRESETS[0]!
  const initialScan = await scanContractForLoopholes(initialPreset.contract)
  return NextResponse.json(
    {
      presets: DEMO_LOOPHOLE_PRESETS,
      initial_scan: initialScan,
    },
    { status: 200 }
  )
})

export const POST = apiHandler(
  {
    auth: 'none',
    body: DemoLoopholePostSchema,
  },
  async ({ body }) => {
    if (body!.action === 'scan') {
      const scan = await scanContractForLoopholes(body!.contract)
      return NextResponse.json({ contract: body!.contract, scan }, { status: 200 })
    }

    const patchResult = applyPatchSafe(body!.contract, body!.patch_ops as Operation[])
    if (!patchResult.ok || !patchResult.contract) {
      throw new ValidationError(patchResult.reason ?? 'Patch failed schema validation')
    }

    const rescan = await scanContractForLoopholes(patchResult.contract)
    const stillOpen = rescan.confirmed_loopholes.some(
      (l) => l.strategy_tag === body!.strategy_tag
    )

    return NextResponse.json(
      {
        contract: patchResult.contract,
        scan: rescan,
        closed_strategy: body!.strategy_tag,
        verified_closed: !stillOpen,
      },
      { status: 200 }
    )
  }
)

