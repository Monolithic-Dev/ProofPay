-- Align api_keys column names with schema.ts
ALTER TABLE IF EXISTS api_keys
  ADD COLUMN IF NOT EXISTS key_prefix text,
  ADD COLUMN IF NOT EXISTS key_hash text,
  ADD COLUMN IF NOT EXISTS label text,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

DO $$ BEGIN
  UPDATE api_keys SET
    key_prefix = COALESCE(key_prefix, prefix),
    key_hash = COALESCE(key_hash, hash),
    label = COALESCE(label, name);
EXCEPTION WHEN undefined_column THEN null; END $$;

ALTER TABLE IF EXISTS api_keys
  ALTER COLUMN prefix DROP NOT NULL,
  ALTER COLUMN hash DROP NOT NULL,
  ALTER COLUMN name DROP NOT NULL;
