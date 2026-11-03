-- Drop not-null constraints on legacy api_keys columns
ALTER TABLE IF EXISTS api_keys
  ALTER COLUMN prefix DROP NOT NULL,
  ALTER COLUMN hash DROP NOT NULL,
  ALTER COLUMN name DROP NOT NULL;
