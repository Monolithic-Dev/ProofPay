/**
 * Safe JSON Patch application with schema validation.
 * Implements phase-3-auth-and-contracts.md §3.8.
 */
import { applyPatch, type Operation } from 'fast-json-patch'
import { ContractSchema, type Contract } from '@/server/contracts/schema'

export interface PatchResult {
  ok: boolean
  contract?: Contract
  reason?: string
}

export function applyPatchSafe(contract: unknown, patch: unknown): PatchResult {
  if (!Array.isArray(patch)) {
    return { ok: false, reason: 'Patch must be an array of RFC 6902 operations' }
  }

  try {
    // Clone contract to prevent mutating original in case of failure
    const clone = JSON.parse(JSON.stringify(contract))
    const result = applyPatch(clone, patch as Operation[], true, false)

    if (!result.newDocument) {
      return { ok: false, reason: 'Patch application returned empty document' }
    }

    const validated = ContractSchema.safeParse(result.newDocument)
    if (!validated.success) {
      return {
        ok: false,
        reason: `Patched contract failed schema validation: ${validated.error.issues.map((i) => i.message).join(', ')}`,
      }
    }

    return {
      ok: true,
      contract: validated.data,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, reason: `Failed to apply patch: ${msg}` }
  }
}
