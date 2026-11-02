ALTER TABLE contracts ADD COLUMN IF NOT EXISTS funding_at_risk boolean NOT NULL DEFAULT false;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS chaos_mock_code text;
ALTER TABLE contracts ADD COLUMN IF NOT EXISTS demo_run_id uuid;

ALTER TABLE submissions ADD COLUMN IF NOT EXISTS note text;

ALTER TABLE verifications ADD COLUMN IF NOT EXISTS stage1_json jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS stage2_json jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS stage3_json jsonb;
ALTER TABLE verifications ADD COLUMN IF NOT EXISTS model_fast text;
