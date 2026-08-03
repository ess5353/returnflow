-- ============================================================
-- PELYX / ReturnFlow — Full Production SQL Migration
-- Version: 2026-08-03
-- Safe to run in the Supabase SQL editor (idempotent via IF NOT EXISTS).
-- Run this file on a fresh Supabase project to set up all tables.
-- Re-running on an existing project is safe — no data is dropped.
-- ============================================================
-- STORAGE BUCKETS: See the "Storage Buckets" section at the bottom.
-- Supabase SQL editor supports storage.buckets INSERT natively.
-- ============================================================

-- ── 0. EXTENSIONS ────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── 1. RETURN_REQUESTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS return_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         text NOT NULL,
  rf_number           text,
  order_id            text,
  customer_name       text,
  customer_email      text,
  product             text,
  products            jsonb,
  reason              text,
  description         text,
  amount              text,
  status              text NOT NULL DEFAULT 'Yeni Talep',
  admin_note          text,
  action_taken        text,
  media_urls          text[],
  request_type        text NOT NULL DEFAULT 'return',
  exchange_type       text,
  exchange_variant    text,
  priority            integer,
  exchange_price_diff numeric,
  carrier             text,
  tracking_number     text,
  shipping_status     text,
  shipping_date       timestamptz,
  delivered_date      timestamptz,
  updated_at          timestamptz DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column additions for upgrades on existing deployments
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='merchant_id') THEN ALTER TABLE return_requests ADD COLUMN merchant_id text NOT NULL DEFAULT ''; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='rf_number') THEN ALTER TABLE return_requests ADD COLUMN rf_number text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='customer_email') THEN ALTER TABLE return_requests ADD COLUMN customer_email text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='products') THEN ALTER TABLE return_requests ADD COLUMN products jsonb; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='action_taken') THEN ALTER TABLE return_requests ADD COLUMN action_taken text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='request_type') THEN ALTER TABLE return_requests ADD COLUMN request_type text NOT NULL DEFAULT 'return'; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_type') THEN ALTER TABLE return_requests ADD COLUMN exchange_type text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_variant') THEN ALTER TABLE return_requests ADD COLUMN exchange_variant text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='priority') THEN ALTER TABLE return_requests ADD COLUMN priority integer; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='exchange_price_diff') THEN ALTER TABLE return_requests ADD COLUMN exchange_price_diff numeric; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='carrier') THEN ALTER TABLE return_requests ADD COLUMN carrier text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='tracking_number') THEN ALTER TABLE return_requests ADD COLUMN tracking_number text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='shipping_status') THEN ALTER TABLE return_requests ADD COLUMN shipping_status text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='shipping_date') THEN ALTER TABLE return_requests ADD COLUMN shipping_date timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='delivered_date') THEN ALTER TABLE return_requests ADD COLUMN delivered_date timestamptz; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='return_requests' AND column_name='updated_at') THEN ALTER TABLE return_requests ADD COLUMN updated_at timestamptz DEFAULT now(); END IF; END $$;

UPDATE return_requests SET merchant_id = 'UNKNOWN' WHERE merchant_id = '' OR merchant_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_id       ON return_requests (merchant_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_created  ON return_requests (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_return_requests_merchant_status   ON return_requests (merchant_id, status);
CREATE INDEX IF NOT EXISTS idx_return_requests_rf_number         ON return_requests (rf_number);
CREATE INDEX IF NOT EXISTS idx_return_requests_order_id          ON return_requests (order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_request_type      ON return_requests (merchant_id, request_type);

ALTER TABLE return_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_requests_anon_deny" ON return_requests;
CREATE POLICY "return_requests_anon_deny" ON return_requests FOR ALL TO anon USING (false);


-- ── 2. STORE_SETTINGS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS store_settings (
  merchant_id             text PRIMARY KEY,
  store_name              text,
  notification_email      text,
  support_email           text,
  logo_url                text,
  primary_color           text,
  return_address          text,
  return_policy           text,
  contact_phone           text,
  return_instructions     text,
  return_deadline_days    integer,
  operation_mode          text NOT NULL DEFAULT 'both',
  updated_at              timestamptz DEFAULT now()
);

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='contact_phone') THEN ALTER TABLE store_settings ADD COLUMN contact_phone text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='return_instructions') THEN ALTER TABLE store_settings ADD COLUMN return_instructions text; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='return_deadline_days') THEN ALTER TABLE store_settings ADD COLUMN return_deadline_days integer; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='store_settings' AND column_name='operation_mode') THEN ALTER TABLE store_settings ADD COLUMN operation_mode text NOT NULL DEFAULT 'both'; END IF; END $$;

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "store_settings_anon_deny" ON store_settings;
CREATE POLICY "store_settings_anon_deny" ON store_settings FOR ALL TO anon USING (false);


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

CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_id       ON automation_rules (merchant_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_priority ON automation_rules (merchant_id, priority ASC);
CREATE INDEX IF NOT EXISTS idx_automation_rules_merchant_enabled  ON automation_rules (merchant_id, enabled);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_rules_anon_deny" ON automation_rules;
CREATE POLICY "automation_rules_anon_deny" ON automation_rules FOR ALL TO anon USING (false);


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

CREATE INDEX IF NOT EXISTS idx_automation_logs_merchant_id ON automation_logs (merchant_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_return_id   ON automation_logs (return_request_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id     ON automation_logs (rule_id);

ALTER TABLE automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "automation_logs_anon_deny" ON automation_logs;
CREATE POLICY "automation_logs_anon_deny" ON automation_logs FOR ALL TO anon USING (false);


-- ── 5. MERCHANT_BILLING ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchant_billing (
  merchant_id           text PRIMARY KEY,
  plan                  text NOT NULL DEFAULT 'trial',
  status                text NOT NULL DEFAULT 'active',
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  ikas_subscription_key text,
  ikas_status           text,
  ikas_last_synced_at   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE merchant_billing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "merchant_billing_anon_deny" ON merchant_billing;
CREATE POLICY "merchant_billing_anon_deny" ON merchant_billing FOR ALL TO anon USING (false);


-- ── 6. BILLING_EVENTS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  event        text NOT NULL,
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_events_merchant ON billing_events (merchant_id, created_at DESC);

ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "billing_events_anon_deny" ON billing_events;
CREATE POLICY "billing_events_anon_deny" ON billing_events FOR ALL TO anon USING (false);


-- ── 7. AUTH_TOKENS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auth_tokens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       text NOT NULL,
  authorized_app_id text NOT NULL UNIQUE,
  sales_channel_id  text,
  type              text,
  deleted           boolean NOT NULL DEFAULT false,
  access_token      text,
  token_type        text,
  expires_in        integer,
  expire_date       timestamptz,
  refresh_token     text,
  scope             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_tokens_merchant_id       ON auth_tokens (merchant_id);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_authorized_app_id ON auth_tokens (authorized_app_id);

ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_tokens_anon_deny" ON auth_tokens;
CREATE POLICY "auth_tokens_anon_deny" ON auth_tokens FOR ALL TO anon USING (false);


-- ── 8. RETURN_NOTES ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS return_notes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_request_id uuid NOT NULL REFERENCES return_requests (id) ON DELETE CASCADE,
  merchant_id       text NOT NULL,
  author            text,
  message           text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_return_notes_return_id   ON return_notes (return_request_id);
CREATE INDEX IF NOT EXISTS idx_return_notes_merchant_id ON return_notes (merchant_id);

ALTER TABLE return_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "return_notes_anon_deny" ON return_notes;
CREATE POLICY "return_notes_anon_deny" ON return_notes FOR ALL TO anon USING (false);


-- ── 9. WEBHOOKS ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  name        text NOT NULL,
  url         text NOT NULL,
  secret      text NOT NULL,
  enabled     boolean NOT NULL DEFAULT true,
  events      text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_merchant_id ON webhooks (merchant_id);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhooks_anon_deny" ON webhooks;
CREATE POLICY "webhooks_anon_deny" ON webhooks FOR ALL TO anon USING (false);


-- ── 10. WEBHOOK_DELIVERIES ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id    uuid NOT NULL REFERENCES webhooks (id) ON DELETE CASCADE,
  merchant_id   text NOT NULL,
  event         text NOT NULL,
  payload       jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'pending',
  response_code integer,
  response_body text,
  retry_count   integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  delivered_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id   ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_merchant_id  ON webhook_deliveries (merchant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status       ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_retry        ON webhook_deliveries (status, next_retry_at) WHERE status = 'retrying';

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "webhook_deliveries_anon_deny" ON webhook_deliveries;
CREATE POLICY "webhook_deliveries_anon_deny" ON webhook_deliveries FOR ALL TO anon USING (false);


-- ── 11. NOTIFICATIONS ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id       text NOT NULL,
  type              text NOT NULL,
  title             text NOT NULL,
  message           text NOT NULL,
  read              boolean NOT NULL DEFAULT false,
  related_return_id uuid REFERENCES return_requests (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_merchant_id   ON notifications (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_merchant_read ON notifications (merchant_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_anon_deny" ON notifications;
CREATE POLICY "notifications_anon_deny" ON notifications FOR ALL TO anon USING (false);


-- ── 12. AUDIT_LOGS ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  user_label   text,
  action       text NOT NULL,
  entity_type  text,
  entity_id    text,
  metadata     jsonb,
  ip_address   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id  ON audit_logs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON audit_logs (merchant_id, action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity       ON audit_logs (entity_type, entity_id);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_logs_anon_deny" ON audit_logs;
CREATE POLICY "audit_logs_anon_deny" ON audit_logs FOR ALL TO anon USING (false);


-- ── 13. API_KEYS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  name         text NOT NULL,
  key_hash     text NOT NULL UNIQUE,
  key_prefix   text NOT NULL,
  enabled      boolean NOT NULL DEFAULT true,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_merchant_id ON api_keys (merchant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash    ON api_keys (key_hash);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_keys_anon_deny" ON api_keys;
CREATE POLICY "api_keys_anon_deny" ON api_keys FOR ALL TO anon USING (false);


-- ── 14. API_LOGS ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_logs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      text NOT NULL,
  api_key_id       uuid REFERENCES api_keys (id) ON DELETE SET NULL,
  key_prefix       text,
  endpoint         text NOT NULL,
  method           text NOT NULL,
  response_code    integer,
  response_time_ms integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_merchant_id  ON api_logs (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key_id   ON api_logs (api_key_id, created_at DESC);

ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_logs_anon_deny" ON api_logs;
CREATE POLICY "api_logs_anon_deny" ON api_logs FOR ALL TO anon USING (false);


-- ── 15. TEAM_MEMBERS ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_members (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id        text NOT NULL,
  authorized_app_id  text,
  email              text NOT NULL,
  name               text,
  role               text NOT NULL DEFAULT 'viewer',
  custom_permissions text[],
  status             text NOT NULL DEFAULT 'invited',
  invited_at         timestamptz,
  joined_at          timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_members_merchant_id ON team_members (merchant_id);
CREATE INDEX IF NOT EXISTS idx_team_members_email       ON team_members (email);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_members_anon_deny" ON team_members;
CREATE POLICY "team_members_anon_deny" ON team_members FOR ALL TO anon USING (false);


-- ── 16. TEAM_INVITATIONS ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS team_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  member_id   uuid NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_token     ON team_invitations (token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_member_id ON team_invitations (member_id);

ALTER TABLE team_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_invitations_anon_deny" ON team_invitations;
CREATE POLICY "team_invitations_anon_deny" ON team_invitations FOR ALL TO anon USING (false);


-- ── 17. EMAIL_TEMPLATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   text NOT NULL,
  template_type text NOT NULL,
  subject       text NOT NULL,
  html          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, template_type)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_merchant_id ON email_templates (merchant_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "email_templates_anon_deny" ON email_templates;
CREATE POLICY "email_templates_anon_deny" ON email_templates FOR ALL TO anon USING (false);


-- ── 18. EXPORT_JOBS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS export_jobs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id text NOT NULL,
  format      text NOT NULL DEFAULT 'xlsx',
  filters     jsonb NOT NULL DEFAULT '{}',
  columns     text[] NOT NULL DEFAULT '{}',
  row_count   integer NOT NULL DEFAULT 0,
  file_name   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_merchant_id ON export_jobs (merchant_id, created_at DESC);

ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "export_jobs_anon_deny" ON export_jobs;
CREATE POLICY "export_jobs_anon_deny" ON export_jobs FOR ALL TO anon USING (false);


-- ── 19. AI_INSIGHTS_CACHE ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_insights_cache (
  merchant_id  text PRIMARY KEY,
  insights     jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ai_insights_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_insights_cache_anon_deny" ON ai_insights_cache;
CREATE POLICY "ai_insights_cache_anon_deny" ON ai_insights_cache FOR ALL TO anon USING (false);


-- ── 20. STORAGE BUCKETS ───────────────────────────────────────────────────────
-- These INSERT statements are idempotent via ON CONFLICT DO NOTHING.
-- Run in the Supabase SQL editor or via the Supabase CLI.
--
-- return-files: Stores customer-uploaded photos and documents.
--   Public read (signed URLs used in dashboard). Anon INSERT allowed for
--   customer portal uploads.
--
-- store-assets: Stores merchant logo and branding assets.
--   Public read. Service-role write only (uploaded through dashboard settings).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'return-files',
  'return-files',
  true,
  10485760,  -- 10 MB (matches client-side validation)
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf','video/mp4','video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'store-assets',
  'store-assets',
  true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow anon INSERT into return-files (customer uploads)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'return_files_anon_insert'
  ) THEN
    CREATE POLICY "return_files_anon_insert"
      ON storage.objects FOR INSERT TO anon
      WITH CHECK (bucket_id = 'return-files');
  END IF;
END $$;

-- Storage RLS: allow public SELECT on return-files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'return_files_public_select'
  ) THEN
    CREATE POLICY "return_files_public_select"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'return-files');
  END IF;
END $$;

-- Storage RLS: allow public SELECT on store-assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'store_assets_public_select'
  ) THEN
    CREATE POLICY "store_assets_public_select"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'store-assets');
  END IF;
END $$;

-- Storage RLS: allow authenticated INSERT into store-assets (dashboard settings)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'store_assets_service_insert'
  ) THEN
    CREATE POLICY "store_assets_service_insert"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'store-assets');
  END IF;
END $$;


-- ── 21. VERIFICATION QUERIES ──────────────────────────────────────────────────
-- Run these after the migration to confirm all tables were created.
-- Expected output: 19 rows, one per table.

SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'return_requests', 'store_settings', 'automation_rules', 'automation_logs',
    'merchant_billing', 'billing_events', 'auth_tokens', 'return_notes',
    'webhooks', 'webhook_deliveries', 'notifications', 'audit_logs',
    'api_keys', 'api_logs', 'team_members', 'team_invitations',
    'email_templates', 'export_jobs', 'ai_insights_cache'
  )
ORDER BY table_name;

-- Verify storage buckets
SELECT id, name, public FROM storage.buckets WHERE id IN ('return-files', 'store-assets');

-- ============================================================
-- END OF MIGRATION
-- ============================================================
