-- ── Refund / exchange / onboarding migration ────────────────────────────────
-- Additive only. Safe to run multiple times (idempotent column/index guards,
-- matching the pattern used in supabase_full_migration.sql /
-- supabase_billing_migration.sql). Does not touch existing data or drop
-- anything. Run this in the Supabase SQL Editor for this project.

-- ── 1. return_requests: real ikas refund / exchange tracking ────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='ikas_order_id') THEN ALTER TABLE return_requests ADD COLUMN ikas_order_id text; END IF; END $$;

-- Refund lifecycle. refund_status is the idempotency guard: the refund
-- endpoint does a conditional UPDATE ... WHERE refund_status NOT IN
-- ('succeeded') AND (refund_status NOT IN ('processing') OR
-- refund_started_at < now() - stale window) to atomically claim the row
-- before calling ikas, so double-clicks/concurrent requests/network retries
-- cannot trigger two real refunds for the same return.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_status') THEN ALTER TABLE return_requests ADD COLUMN refund_status text NOT NULL DEFAULT 'none'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_amount') THEN ALTER TABLE return_requests ADD COLUMN refund_amount numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_currency') THEN ALTER TABLE return_requests ADD COLUMN refund_currency text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refunded_line_items') THEN ALTER TABLE return_requests ADD COLUMN refunded_line_items jsonb; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_started_at') THEN ALTER TABLE return_requests ADD COLUMN refund_started_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_completed_at') THEN ALTER TABLE return_requests ADD COLUMN refund_completed_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_failure_reason') THEN ALTER TABLE return_requests ADD COLUMN refund_failure_reason text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_provider_response') THEN ALTER TABLE return_requests ADD COLUMN refund_provider_response jsonb; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='refund_attempted_by') THEN ALTER TABLE return_requests ADD COLUMN refund_attempted_by text; END IF; END $$;

-- Exchange lifecycle: the "return leg" (original item cancelled + restocked
-- via ikas cancelOrderLine) and the replacement order (created via ikas
-- createOrderWithTransactions), tracked separately since they are two
-- distinct real ikas operations, not one atomic action.
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_return_leg_status') THEN ALTER TABLE return_requests ADD COLUMN exchange_return_leg_status text NOT NULL DEFAULT 'none'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_return_leg_completed_at') THEN ALTER TABLE return_requests ADD COLUMN exchange_return_leg_completed_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_replacement_status') THEN ALTER TABLE return_requests ADD COLUMN exchange_replacement_status text NOT NULL DEFAULT 'none'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_replacement_order_id') THEN ALTER TABLE return_requests ADD COLUMN exchange_replacement_order_id text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_replacement_completed_at') THEN ALTER TABLE return_requests ADD COLUMN exchange_replacement_completed_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_replacement_failure_reason') THEN ALTER TABLE return_requests ADD COLUMN exchange_replacement_failure_reason text; END IF; END $$;

CREATE INDEX IF NOT EXISTS idx_return_requests_refund_status ON return_requests (merchant_id, refund_status);
CREATE INDEX IF NOT EXISTS idx_return_requests_ikas_order_id  ON return_requests (ikas_order_id);

-- ── 2. store_settings: per-merchant onboarding state ────────────────────────

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='onboarding_completed') THEN ALTER TABLE store_settings ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='onboarding_completed_at') THEN ALTER TABLE store_settings ADD COLUMN onboarding_completed_at timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='onboarding_current_step') THEN ALTER TABLE store_settings ADD COLUMN onboarding_current_step text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='onboarding_started_at') THEN ALTER TABLE store_settings ADD COLUMN onboarding_started_at timestamptz; END IF; END $$;

-- Existing merchants (installed before this migration) should not be forced
-- through onboarding retroactively — treat them as already onboarded.
UPDATE store_settings SET onboarding_completed = true, onboarding_completed_at = COALESCE(onboarding_completed_at, now())
  WHERE onboarding_completed = false AND updated_at < now() - interval '1 day';
