-- ProofPay v2 Additive Schema Migration
-- Implements docs/v2/05-data-model-v2.md

-- 1. Counterparties Directory
CREATE TABLE IF NOT EXISTS counterparties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  notes text,
  linked_organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);
CREATE INDEX IF NOT EXISTS counterparties_org_idx ON counterparties(organization_id);

-- 2. Contract Versions
CREATE TABLE IF NOT EXISTS contract_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  version int NOT NULL,
  contract_json jsonb NOT NULL,
  contract_hash text NOT NULL,
  change_note text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contract_id, version)
);
CREATE INDEX IF NOT EXISTS contract_versions_contract_idx ON contract_versions(contract_id);

-- 3. Four-Eyes Funding Approvals
CREATE TABLE IF NOT EXISTS funding_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total_minor int NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);
CREATE INDEX IF NOT EXISTS funding_approvals_contract_idx ON funding_approvals(contract_id);
CREATE INDEX IF NOT EXISTS funding_approvals_org_idx ON funding_approvals(organization_id, status);

-- 4. Contract Templates
CREATE TABLE IF NOT EXISTS templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  slug text,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  contract_json jsonb NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS templates_org_idx ON templates(organization_id);
CREATE INDEX IF NOT EXISTS templates_category_idx ON templates(category);

-- 5. Service Accounts (AI Agents & Scoped API Keys)
CREATE TABLE IF NOT EXISTS service_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  scopes jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_contract_total_minor int,
  max_open_holds_minor int,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  UNIQUE (organization_id, name)
);

-- 6. Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  contract_id uuid REFERENCES contracts(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);

-- 7. PayPal Merchant Connections
CREATE TABLE IF NOT EXISTS paypal_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'PLATFORM_ACCOUNT' CHECK (mode IN ('PLATFORM_ACCOUNT','PARTNER_CONNECTED')),
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('NOT_CONNECTED','PENDING','ACTIVE','RESTRICTED','REVOKED')),
  paypal_merchant_id text,
  paypal_email text,
  connected_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);
