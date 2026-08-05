-- Migration: Add store_key to store_settings for multi-tenant public portal routing
-- Run once against your Supabase project.

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS store_key text UNIQUE;

-- Populate store_key for any rows created before this migration.
-- Format: first 20 chars of merchant_id (alphanumeric, lowercase) + '-' + last 10 chars of merchant_id (no dashes).
-- This is deterministic and virtually guaranteed to be unique (derived from UUID).
UPDATE store_settings
SET store_key = (
  lower(regexp_replace(merchant_id, '[^a-zA-Z0-9]', '', 'g'))
) || '-' || (
  lower(right(replace(merchant_id, '-', ''), 10))
)
WHERE store_key IS NULL;
