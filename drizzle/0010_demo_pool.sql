-- Create pre-authorized demo_pool table (schema.ts §3.12.1)
CREATE TABLE IF NOT EXISTS demo_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'AVAILABLE',
  authorization_expires_at timestamptz,
  claimed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS demo_pool_status_expires_idx
  ON demo_pool(status, authorization_expires_at);

