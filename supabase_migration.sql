-- ============================================================
-- PELYX / ReturnFlow — Production SQL Migration
-- Generated: 2026-07-31
-- Safe to run in Supabase SQL editor (idempotent via IF NOT EXISTS)
-- ============================================================
-- ROLLBACK NOTES:
--   • New tables (automation_rules, automation_logs): DROP TABLE ... CASCADE
--   • New columns on return_requests: DROP COLUMN ...
--   • RLS policies: DROP POLICY ... ON ...
--   • Indexes: DROP INDEX IF EXISTS ...
--   • To disable RLS: ALTER TABLE ... DISABLE ROW LEVEL SECURITY
-- ============================================================

-- ── 1. RETURN_REQUESTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS return_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id    text NOT NULL,
  rf_number      text,
  order_id       text,
  customer_name  text,
  customer_email text,
  product        text,
  products       jsonb,
  reason         text,
  description    text,
  amount         text,
  status         text NOT NULL DEFAULT 'Yeni Talep',
  admin_note     text,
  action_taken   text,
  media_urls     text[],
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Add merchant_id to existing table if column is missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_requests' AND column_name = 'merchant_id'
  ) THEN
    ALTER TABLE return_requests ADD COLUMN merchant_id text NOT NULL DEFAULT '';
  END IF;
END $$;

-- Add rf_number if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_requests' AND column_name = 'rf_number'
  ) THEN
    ALTER TABLE return_requests ADD COLUMN rf_number text;
  END IF;
END $$;

-- Add customer_email if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_requests' AND column_name = 'customer_email'
  ) THEN
    ALTER TABLE return_requests ADD COLUMN customer_email text;
  END IF;
END $$;

-- Add products (jsonb) if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_requests' AND column_name = 'products'
  ) THEN
    ALTER TABLE return_requests ADD COLUMN products jsonb;
  END IF;
END $$;

-- Add action_taken if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'return_requests' AND column_name = 'action_taken'
  ) THEN
    ALTER TABLE return_requests ADD COLUMN action_taken text;
  END IF;
END $$;

-- Backfill: existing rows with empty merchant_id get a sentinel value so NOT NULL is satisfied
-- Replace 'UNKNOWN' rows manually in Supabase dashboard after running if needed
UPDATE return_requests SET merchant_id = 'UNKNOWN' WHERE merchant_id = '' OR merchant_id IS NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_id ON return_requests (merchant_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_created ON return_requests (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_status ON return_requests (merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_rf_number ON return_requests (rf_number);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id ON return_requests (order_id);

-- RLS
ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (clean slate)
DROP POLICY IF EXISTS "return_requests_anon_deny" ON return_requests;
DROP POLICY IF EXISTS "return_requests_service_all" ON return_requests;

-- Anon key: deny all (all access goes through server-side API routes with service role)
CREATE POLICY "return_requests_anon_deny"
  ON return_requests
  FOR ALL
  TO anon
  USING (false);

-- Service role: full access (bypasses RLS by default, policy is belt-and-suspenders)
-- Note: service role bypasses RLS automatically; this policy is not needed but included for clarity
-- CREATE POLICY "return_requests_service_all" ON return_requests FOR ALL TO service_role USING (true);


-- ── 2. STORE_SETTINGS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_settings (
  merchant_id        text PRIMARY KEY,
  store_name         text,
  notification_email text,
  support_email      text,
  logo_url           text,
  primary_color      text,
  return_address     text,
  return_policy      text,
  updated_at         timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "store_settings_anon_select" ON store_settings;
DROP POLICY IF EXISTS "store_settings_anon_deny" ON store_settings;

-- Anon key: deny all writes and reads (all access goes through server-side API routes)
-- The /api/store-settings and /api/settings routes use the service role key
CREATE POLICY "store_settings_anon_deny"
  ON store_settings
  FOR ALL
  TO anon
  USING (false);


-- ── 3. AUTOMATION_RULES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     text NOT NULL,
  name            text NOT NULL,
  enabled         boolean NOT NULL DEFAULT true,
  priority        integer NOT NULL DEFAULT 0,
  condition_logic text NOT NULL DEFAULT 'AND',
  conditions      jsonb NOT NULL DEFAULT '[]',
  action          text NOT NULL,
  action_note     text,
  updated_at      timestamptz DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_id ON automation_rules (merchant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_priority ON automation_rules (merchant_id, priority ASC);
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_enabled ON automation_rules (merchant_id, enabled);

-- RLS
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_rules_anon_deny" ON automation_rules;

CREATE POLICY "automation_rules_anon_deny"
  ON automation_rules
  FOR ALL
  TO anon
  USING (false);


-- ── 4. AUTOMATION_LOGS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS automation_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       text NOT NULL,
  rule_id           uuid REFERENCES automation_rules (id) ON DELETE SET NULL,
  return_request_id uuid REFERENCES return_requests (id) ON DELETE CASCADE,
  rule_name         text,
  matched           boolean NOT NULL DEFAULT false,
  action_taken      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_logs_merchant_id ON automation_logs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_return_id ON automation_logs (return_request_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs (rule_id);

-- RLS
ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "automation_logs_anon_deny" ON automation_logs;

CREATE POLICY "automation_logs_anon_deny"
  ON automation_logs
  FOR ALL
  TO anon
  USING (false);


-- ── 5. STORAGE BUCKETS ────────────────────────────────────────────────────────
-- Run these separately in the Supabase Storage dashboard if buckets don't exist.
-- Supabase SQL editor may not support these; create via dashboard instead.
--
-- Bucket: return-files (public read, anon upload)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('return-files', 'return-files', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- Bucket: store-assets (public read, anon upload for logo)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true)
--   ON CONFLICT (id) DO NOTHING;
--
-- Storage RLS policies (run in Supabase Storage policy editor):
--   Allow anon to INSERT into return-files (customer photo uploads)
--   Allow anon to INSERT into store-assets (logo uploads from settings page)
--   Allow public SELECT on both buckets (for viewing images)
-- ============================================================
-- END OF MIGRATION
-- ============================================================
