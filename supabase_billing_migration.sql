-- ============================================================
-- PELYX / ReturnFlow — Billing Module SQL Migration (v2)
-- Updated: 2026-08-02 — removed Launch Offer / Founding Merchant
-- Plans: trial (app-managed) | pro | enterprise (manual) | expired
-- Safe to run in Supabase SQL editor (idempotent via IF NOT EXISTS)
-- ============================================================

-- ── 1. merchant_billing ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS merchant_billing (
  merchant_id                  text PRIMARY KEY,
  plan                         text NOT NULL DEFAULT 'trial',
  -- plan values: 'trial' | 'pro' | 'enterprise' | 'expired'
  status                       text NOT NULL DEFAULT 'active',
  -- status values: 'active' | 'expired' | 'will_expire' | 'cancelled'
  trial_ends_at                timestamptz,
  current_period_start         timestamptz,
  current_period_end           timestamptz,
  requests_used_this_period    integer NOT NULL DEFAULT 0,
  requests_limit               integer NOT NULL DEFAULT -1,
  -- -1 = unlimited (trial, enterprise); 1000 = pro
  ikas_subscription_key        text,
  -- storeAppListingSubscriptionKey from ikas (used for pro plan)
  ikas_status                  text,
  -- ACTIVE | WILL_BE_REMOVED | REMOVED
  ikas_last_synced_at          timestamptz,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. billing_usage_events ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_usage_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  event_type   text NOT NULL,  -- 'return_submission' | 'exchange_submission'
  return_id    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_usage_events_merchant_id_idx
  ON billing_usage_events (merchant_id, created_at DESC);

-- ── 3. billing_events (audit log) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS billing_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id  text NOT NULL,
  event        text NOT NULL,
  -- 'trial_started' | 'trial_expired' | 'upgraded' | 'cancelled'
  -- | 'renewed' | 'period_reset'
  data         jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_merchant_id_idx
  ON billing_events (merchant_id, created_at DESC);

-- ── 4. PostgreSQL Functions ───────────────────────────────────────────────────

-- increment_billing_usage: atomic check-and-increment.
-- Returns JSONB: { allowed, reason, requests_used, requests_limit }
CREATE OR REPLACE FUNCTION increment_billing_usage(
  p_merchant_id  text,
  p_event_type   text,
  p_return_id    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_rec  merchant_billing;
BEGIN
  -- Lock the billing row for this merchant
  SELECT * INTO v_rec
  FROM merchant_billing
  WHERE merchant_id = p_merchant_id
  FOR UPDATE;

  -- No billing record yet (new install) — allow; OAuth callback will create it
  IF NOT FOUND THEN
    RETURN '{"allowed":true,"reason":null,"requests_used":0,"requests_limit":-1}'::jsonb;
  END IF;

  -- Check if explicitly marked expired
  IF v_rec.status = 'expired' THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PLAN_EXPIRED',
      'requests_used', v_rec.requests_used_this_period,
      'requests_limit', v_rec.requests_limit
    );
  END IF;

  -- Check if trial period has elapsed
  IF v_rec.plan = 'trial' AND v_rec.trial_ends_at IS NOT NULL AND v_rec.trial_ends_at < now() THEN
    UPDATE merchant_billing
      SET status = 'expired', updated_at = now()
      WHERE merchant_id = p_merchant_id;

    INSERT INTO billing_events (merchant_id, event, data)
      VALUES (p_merchant_id, 'trial_expired', jsonb_build_object('expired_at', now()));

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PLAN_EXPIRED',
      'requests_used', v_rec.requests_used_this_period,
      'requests_limit', v_rec.requests_limit
    );
  END IF;

  -- Check usage limit (-1 = unlimited)
  IF v_rec.requests_limit <> -1 AND v_rec.requests_used_this_period >= v_rec.requests_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'PLAN_LIMIT_REACHED',
      'requests_used', v_rec.requests_used_this_period,
      'requests_limit', v_rec.requests_limit
    );
  END IF;

  -- All checks passed — increment counter
  UPDATE merchant_billing
    SET requests_used_this_period = requests_used_this_period + 1,
        updated_at = now()
    WHERE merchant_id = p_merchant_id;

  -- Log usage event
  INSERT INTO billing_usage_events (merchant_id, event_type, return_id)
    VALUES (p_merchant_id, p_event_type, p_return_id);

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', null,
    'requests_used', v_rec.requests_used_this_period + 1,
    'requests_limit', v_rec.requests_limit
  );
END;
$$;

-- reset_billing_period: called on renewal to zero out the usage counter.
CREATE OR REPLACE FUNCTION reset_billing_period(
  p_merchant_id        text,
  p_period_start       timestamptz,
  p_period_end         timestamptz
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE merchant_billing
    SET requests_used_this_period = 0,
        current_period_start = p_period_start,
        current_period_end   = p_period_end,
        status               = 'active',
        updated_at           = now()
    WHERE merchant_id = p_merchant_id;

  INSERT INTO billing_events (merchant_id, event, data)
    VALUES (p_merchant_id, 'period_reset', jsonb_build_object(
      'period_start', p_period_start,
      'period_end', p_period_end
    ));
END;
$$;
