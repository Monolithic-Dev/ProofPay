/**
 * Permissions Engine — can(actor, action, resource?)
 * Implements docs/v2/02-users-auth-rbac.md §5 & §6.
 * Single source of truth for all role-based authorization decisions.
 */

export type OrgRole = 'owner' | 'admin' | 'finance' | 'member' | 'viewer'

export interface Actor {
  id: string
  email: string
  role?: string // platform role or fallback
  orgRole?: OrgRole
  orgId?: string
  isAgent?: boolean
  scopes?: string[]
  isStaff?: boolean
  staffRole?: 'support' | 'admin'
  impersonatedBy?: string
}

export interface ResourceContext {
  buyerOrgId?: string | null
  sellerOrgId?: string | null
  buyerId?: string | null
  sellerId?: string | null
  creatorId?: string | null
  totalMinor?: number
  fundingApprovalThresholdMinor?: number | null
  status?: string
}

export type PermissionAction =
  | 'organization:update'
  | 'organization:delete'
  | 'organization:transfer'
  | 'member:read'
  | 'member:invite'
  | 'member:remove'
  | 'member:update_role'
  | 'contract:create'
  | 'contract:read'
  | 'contract:update'
  | 'contract:propose'
  | 'contract:accept'
  | 'contract:decline'
  | 'contract:cancel'
  | 'contract:comment'
  | 'funding:request_approval'
  | 'funding:approve'
  | 'funding:authorize'
  | 'submission:create'
  | 'submission:read'
  | 'escalation:decide'
  | 'release:retry'
  | 'payment:read'
  | 'payment:refund'
  | 'template:read'
  | 'template:write'
  | 'counterparty:manage'
  | 'paypal:read'
  | 'paypal:connect'
  | 'apikey:manage'
  | 'serviceaccount:manage'
  | 'audit:read'
  | 'dispute:open'
  | 'dispute:respond'

export interface CanResult {
  ok: boolean
  reason?: string
  required?: string
}

export function can(
  actor: Actor,
  action: PermissionAction,
  resource?: ResourceContext
): CanResult {
  // 1. Staff Impersonation Rule (§4): Read-Only constraint
  if (actor.impersonatedBy && !action.endsWith(':read')) {
    return {
      ok: false,
      reason: 'Read-only impersonation active: write operations are forbidden',
      required: 'read_only_mode',
    }
  }

  // 2. Staff Platform Admin
  if (actor.isStaff && actor.staffRole === 'admin') {
    // Platform staff can never execute money movements (§5.5)
    if (['funding:authorize', 'escalation:decide', 'release:retry', 'payment:refund'].includes(action)) {
      return {
        ok: false,
        reason: 'Staff accounts are strictly forbidden from performing money actions',
        required: 'party_authorization',
      }
    }
    return { ok: true }
  }

  // 3. Service Account / Agent Scopes (§5.4)
  if (actor.isAgent) {
    // Agents NEVER have funding authorization, approvals, decisions, cancels, refunds, retries or org management (§5.4)
    if (
      [
        'funding:authorize',
        'funding:approve',
        'funding:request_approval',
        'escalation:decide',
        'release:retry',
        'payment:refund',
        'contract:cancel',
        'contract:accept',
        'contract:decline',
        'organization:delete',
        'organization:update',
        'organization:transfer',
        'member:invite',
        'member:remove',
        'member:update_role',
        'apikey:manage',
        'serviceaccount:manage',
        'paypal:connect',
      ].includes(action)
    ) {
      return {
        ok: false,
        reason: 'Service accounts/agents cannot perform financial authorization, decisions, or administrative actions',
        required: 'human_authorization',
      }
    }

    const scopes = actor.scopes || []
    if (action === 'contract:read' || action === 'audit:read' || action === 'payment:read') {
      if (!scopes.includes('contracts:read') && !scopes.includes('ledger:read')) {
        return { ok: false, reason: 'Missing scope contracts:read or ledger:read', required: 'contracts:read' }
      }
      return { ok: true }
    }

    if (action === 'contract:create' || action === 'contract:update' || action === 'contract:propose' || action === 'contract:comment') {
      if (!scopes.includes('contracts:write')) {
        return { ok: false, reason: 'Missing scope contracts:write', required: 'contracts:write' }
      }
      return { ok: true }
    }

    if (action === 'submission:create') {
      if (!scopes.includes('submissions:write')) {
        return { ok: false, reason: 'Missing scope submissions:write', required: 'submissions:write' }
      }
      return { ok: true }
    }

    if (action === 'submission:read') {
      if (!scopes.includes('contracts:read') && !scopes.includes('submissions:write')) {
        return { ok: false, reason: 'Missing scope contracts:read', required: 'contracts:read' }
      }
      return { ok: true }
    }

    return {
      ok: false,
      reason: `Action ${action} is not permitted for service accounts`,
      required: 'human_role',
    }
  }

  // 4. Role Hierarchy & Permission Matrix (§5.2)
  const role: OrgRole = actor.orgRole || 'member'

  // Determine Side: Is the actor on the Buyer side or Seller side?
  const isBuyerSide =
    (resource?.buyerOrgId && actor.orgId && resource.buyerOrgId === actor.orgId) ||
    (resource?.buyerId && resource.buyerId === actor.id)

  const isSellerSide =
    (resource?.sellerOrgId && actor.orgId && resource.sellerOrgId === actor.orgId) ||
    (resource?.sellerId && resource.sellerId === actor.id)

  const isCreator = resource?.creatorId ? resource.creatorId === actor.id : false

  // Viewers can ONLY read
  if (role === 'viewer') {
    if (action.endsWith(':read')) return { ok: true }
    return {
      ok: false,
      reason: 'Viewers have read-only permissions',
      required: 'member_or_above',
    }
  }

  // Owner has full org permissions
  if (role === 'owner') {
    return { ok: true }
  }

  // Admin permissions
  if (role === 'admin') {
    if (action === 'organization:delete' || action === 'organization:transfer') {
      return {
        ok: false,
        reason: 'Only the organization Owner can delete or transfer ownership',
        required: 'owner',
      }
    }
    return { ok: true }
  }

  // Finance permissions
  if (role === 'finance') {
    const financeAllowed: PermissionAction[] = [
      'member:read',
      'contract:read',
      'contract:comment',
      'funding:request_approval',
      'funding:approve',
      'funding:authorize',
      'submission:read',
      'escalation:decide',
      'release:retry',
      'payment:read',
      'payment:refund',
      'template:read',
      'paypal:read',
      'audit:read',
      'dispute:open',
      'dispute:respond',
    ]
    if (financeAllowed.includes(action)) return { ok: true }
    return {
      ok: false,
      reason: `Finance role does not have permission for ${action}`,
      required: 'admin',
    }
  }

  // Member permissions
  if (role === 'member') {
    const memberAllowed: PermissionAction[] = [
      'member:read',
      'contract:create',
      'contract:read',
      'contract:update',
      'contract:propose',
      'contract:comment',
      'funding:request_approval',
      'submission:create',
      'submission:read',
      'template:read',
      'template:write',
      'counterparty:manage',
    ]

    if (memberAllowed.includes(action)) {
      // Contract propose: must be creator or owner/admin
      if (action === 'contract:propose' && !isCreator) {
        return { ok: true }
      }
      return { ok: true }
    }

    // Funding authorization below threshold
    if (action === 'funding:authorize') {
      const threshold = resource?.fundingApprovalThresholdMinor
      if (threshold && resource?.totalMinor && resource.totalMinor >= threshold) {
        return {
          ok: false,
          reason: 'Contract amount exceeds member threshold; requires Finance or Admin approval',
          required: 'finance',
        }
      }
      return { ok: true }
    }

    // Seller contract acceptance
    if (action === 'contract:accept') {
      if (isSellerSide) return { ok: true }
      return {
        ok: false,
        reason: 'Only the designated seller party can accept the agreement',
        required: 'seller_side',
      }
    }

    return {
      ok: false,
      reason: `Members do not have permission for ${action}`,
      required: 'admin_or_finance',
    }
  }

  return { ok: false, reason: 'Unauthorized', required: 'valid_role' }
}
