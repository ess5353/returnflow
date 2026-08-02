-- ============================================================
-- PELYX / ReturnFlow — Billing Module SQL Migration (v3)
-- Updated: 2026-08-02
-- Plans: trial (14-day, app-managed) | pro (₺10,000/yr, unlimited)
--        | enterprise (manual) | expired
-- No request counters or limits — Pro is unlimited.
-- Safe to run in Supabase SQL editor (idempotent via IF NOT EXISTS)
-- ============================================================

-- ── 1. merchant_billing ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchant_billing (
  merchant_id           text PRIMARY KEY,
  plan                  text NOT NULL DEFAULT 'trial',
  -- plan values: 'trial' | 'pro' | 'enterprise' | 'expired'
  status                text NOT NULL DEFAULT 'active',
  -- status values: 'active' | 'expired' | 'will_expire'
  trial_ends_at         timestamptz,
  current_period_start  timestamptz,
  current_period_end    timestamptz,
  ikas_subscription_key text,
  -- storeAppListingSubscriptionKey for the returnflow-pro listing
  ikas_status           text,
  -- ACTIVE | WILL_BE_REMOVED | REMOVED (from ikas)
  ikas_last_synced_at   timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ── 2. billing_events (audit log) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  event        text NOT NULL,
  -- 'trial_started' | 'trial_expired' | 'upgraded' | 'cancelled' | 'renewed'
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_merchant_id_idx
  ON billing_events (merchant_id, created_at DESC);
