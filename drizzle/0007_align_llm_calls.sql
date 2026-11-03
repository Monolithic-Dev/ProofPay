-- Align llm_calls table with Drizzle schema
ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'verification';
ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;
ALTER TABLE llm_calls ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES contracts(id);

ALTER TABLE llm_calls ALTER COLUMN stage DROP NOT NULL;
ALTER TABLE llm_calls ALTER COLUMN prompt_tokens DROP NOT NULL;
ALTER TABLE llm_calls ALTER COLUMN completion_tokens DROP NOT NULL;
ALTER TABLE llm_calls ALTER COLUMN latency_ms DROP NOT NULL;

CREATE INDEX IF NOT EXISTS llm_calls_day_idx ON llm_calls(created_at);
