-- 0001_ledger_trigger.sql: Enforces append-only immutable ledger events (data-model.md §3.8)

CREATE OR REPLACE FUNCTION ledger_no_mutate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_events is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ledger_events_no_update ON ledger_events;

CREATE TRIGGER ledger_events_no_update
  BEFORE UPDATE OR DELETE ON ledger_events
  FOR EACH ROW EXECUTE FUNCTION ledger_no_mutate();
