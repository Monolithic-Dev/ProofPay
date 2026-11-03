import { describe, it, expect } from 'vitest'
import { can, Actor, ResourceContext } from '@/server/auth/permissions'

describe('RBAC Permissions Engine (docs/v2/02-users-auth-rbac.md)', () => {
  const buyerOrgId = 'org-buyer-100'
  const sellerOrgId = 'org-seller-200'

  describe('Owner Role', () => {
    const owner: Actor = {
      id: 'usr-owner-1',
      email: 'owner@agency.com',
      orgRole: 'owner',
      orgId: buyerOrgId,
    }

    it('allows owner to update and delete organization', () => {
      expect(can(owner, 'organization:update').ok).toBe(true)
      expect(can(owner, 'organization:delete').ok).toBe(true)
      expect(can(owner, 'organization:transfer').ok).toBe(true)
    })

    it('allows owner to manage members and contracts', () => {
      expect(can(owner, 'member:invite').ok).toBe(true)
      expect(can(owner, 'member:remove').ok).toBe(true)
      expect(can(owner, 'contract:create').ok).toBe(true)
      expect(can(owner, 'funding:authorize').ok).toBe(true)
    })
  })

  describe('Admin Role', () => {
    const admin: Actor = {
      id: 'usr-admin-1',
      email: 'admin@agency.com',
      orgRole: 'admin',
      orgId: buyerOrgId,
    }

    it('allows admin to manage members, contracts, and apikeys', () => {
      expect(can(admin, 'member:invite').ok).toBe(true)
      expect(can(admin, 'contract:create').ok).toBe(true)
      expect(can(admin, 'apikey:manage').ok).toBe(true)
      expect(can(admin, 'organization:update').ok).toBe(true)
    })

    it('forbids admin from deleting organization or transferring ownership', () => {
      const deleteRes = can(admin, 'organization:delete')
      expect(deleteRes.ok).toBe(false)
      expect(deleteRes.required).toBe('owner')

      const transferRes = can(admin, 'organization:transfer')
      expect(transferRes.ok).toBe(false)
      expect(transferRes.required).toBe('owner')
    })
  })

  describe('Finance Role', () => {
    const finance: Actor = {
      id: 'usr-fin-1',
      email: 'finance@agency.com',
      orgRole: 'finance',
      orgId: buyerOrgId,
    }

    it('allows finance to view payments, approve and authorize funding, and refund', () => {
      expect(can(finance, 'payment:read').ok).toBe(true)
      expect(can(finance, 'funding:approve').ok).toBe(true)
      expect(can(finance, 'funding:authorize').ok).toBe(true)
      expect(can(finance, 'payment:refund').ok).toBe(true)
      expect(can(finance, 'audit:read').ok).toBe(true)
    })

    it('forbids finance from member management and organization edits', () => {
      expect(can(finance, 'member:invite').ok).toBe(false)
      expect(can(finance, 'member:remove').ok).toBe(false)
      expect(can(finance, 'organization:update').ok).toBe(false)
    })
  })

  describe('Member Role & Threshold Policies', () => {
    const member: Actor = {
      id: 'usr-mem-1',
      email: 'member@agency.com',
      orgRole: 'member',
      orgId: buyerOrgId,
    }

    it('allows member to create contracts, read, and comment', () => {
      expect(can(member, 'contract:create').ok).toBe(true)
      expect(can(member, 'contract:read').ok).toBe(true)
      expect(can(member, 'contract:comment').ok).toBe(true)
    })

    it('forbids member from administrative and money actions', () => {
      expect(can(member, 'member:invite').ok).toBe(false)
      expect(can(member, 'organization:update').ok).toBe(false)
      expect(can(member, 'payment:refund').ok).toBe(false)
      expect(can(member, 'apikey:manage').ok).toBe(false)
    })

    it('enforces funding approval threshold policy on members', () => {
      const ctxUnderThreshold: ResourceContext = {
        totalMinor: 5000,
        fundingApprovalThresholdMinor: 10000,
      }
      expect(can(member, 'funding:authorize', ctxUnderThreshold).ok).toBe(true)

      const ctxOverThreshold: ResourceContext = {
        totalMinor: 15000,
        fundingApprovalThresholdMinor: 10000,
      }
      const overRes = can(member, 'funding:authorize', ctxOverThreshold)
      expect(overRes.ok).toBe(false)
      expect(overRes.required).toBe('finance')
    })

    it('verifies seller-side requirement for contract acceptance', () => {
      const buyerCtx: ResourceContext = {
        buyerOrgId: buyerOrgId,
        sellerOrgId: sellerOrgId,
      }
      expect(can(member, 'contract:accept', buyerCtx).ok).toBe(false)

      const sellerMember: Actor = {
        ...member,
        orgId: sellerOrgId,
      }
      expect(can(sellerMember, 'contract:accept', buyerCtx).ok).toBe(true)
    })
  })

  describe('Viewer Role', () => {
    const viewer: Actor = {
      id: 'usr-view-1',
      email: 'auditor@external.com',
      orgRole: 'viewer',
      orgId: buyerOrgId,
    }

    it('allows read operations', () => {
      expect(can(viewer, 'contract:read').ok).toBe(true)
      expect(can(viewer, 'payment:read').ok).toBe(true)
      expect(can(viewer, 'audit:read').ok).toBe(true)
      expect(can(viewer, 'member:read').ok).toBe(true)
    })

    it('forbids write/mutate operations', () => {
      expect(can(viewer, 'contract:create').ok).toBe(false)
      expect(can(viewer, 'contract:comment').ok).toBe(false)
      expect(can(viewer, 'funding:authorize').ok).toBe(false)
      expect(can(viewer, 'submission:create').ok).toBe(false)
    })
  })

  describe('Service Accounts & Autonomous Agents (§5.4)', () => {
    const agentActor: Actor = {
      id: 'agent-10',
      email: 'procurebot@service.proofpay.com',
      isAgent: true,
      scopes: ['contracts:read', 'contracts:write', 'submissions:write'],
      orgId: buyerOrgId,
    }

    it('allows actions granted by explicit scopes', () => {
      expect(can(agentActor, 'contract:read').ok).toBe(true)
      expect(can(agentActor, 'contract:create').ok).toBe(true)
      expect(can(agentActor, 'submission:create').ok).toBe(true)
    })

    it('forbids actions outside granted scopes', () => {
      const readOnlyAgent: Actor = {
        ...agentActor,
        scopes: ['contracts:read'],
      }
      expect(can(readOnlyAgent, 'contract:create').ok).toBe(false)
      expect(can(readOnlyAgent, 'submission:create').ok).toBe(false)
    })

    it('strictly forbids money movements, refunds, and cancels even if agent is active', () => {
      expect(can(agentActor, 'funding:authorize').ok).toBe(false)
      expect(can(agentActor, 'payment:refund').ok).toBe(false)
      expect(can(agentActor, 'contract:cancel').ok).toBe(false)
      expect(can(agentActor, 'escalation:decide').ok).toBe(false)
      expect(can(agentActor, 'release:retry').ok).toBe(false)
      expect(can(agentActor, 'organization:delete').ok).toBe(false)
    })
  })

  describe('Staff & Impersonation Constraints (§4 & §5.5)', () => {
    it('strictly forbids platform staff from executing money operations', () => {
      const staffAdmin: Actor = {
        id: 'staff-1',
        email: 'staff@proofpay.com',
        isStaff: true,
        staffRole: 'admin',
      }
      expect(can(staffAdmin, 'funding:authorize').ok).toBe(false)
      expect(can(staffAdmin, 'escalation:decide').ok).toBe(false)
      expect(can(staffAdmin, 'release:retry').ok).toBe(false)
      expect(can(staffAdmin, 'payment:refund').ok).toBe(false)
      expect(can(staffAdmin, 'contract:read').ok).toBe(true)
    })

    it('enforces read-only constraint when impersonatedBy is present', () => {
      const impersonatedUser: Actor = {
        id: 'usr-owner-1',
        email: 'owner@agency.com',
        orgRole: 'owner',
        impersonatedBy: 'staff-admin-99',
      }
      expect(can(impersonatedUser, 'contract:read').ok).toBe(true)
      expect(can(impersonatedUser, 'contract:create').ok).toBe(false)
      expect(can(impersonatedUser, 'funding:authorize').ok).toBe(false)
    })
  })
})
