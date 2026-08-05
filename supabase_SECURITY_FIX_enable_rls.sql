-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL SECURITY FIX — run this in the Supabase SQL Editor immediately.
--
-- Verified 2026-08-05: the public anon key (NEXT_PUBLIC_SUPABASE_ANON_KEY,
-- embedded in every client bundle by design) can currently read AND write
-- the `return_requests` and `store_settings` tables directly via PostgREST,
-- completely bypassing the Next.js app and every validation/auth check in it.
--
-- Confirmed live:
--   curl "$SUPABASE_URL/rest/v1/return_requests?select=*" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
--   -> returns full rows: customer_name, customer_email, order_id, amount,
--      media_urls (uploaded evidence photos/videos), admin_note, across
--      every merchant.
--
--   curl -X POST "$SUPABASE_URL/rest/v1/return_requests" \
--     -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
--     -d '{"merchant_id":"...","status":"Tamamlandı","amount":"999999",...}'
--   -> HTTP 201. Anyone can insert an already-"completed" fake return with
--      an arbitrary amount, bypassing the order-verification fix in
--      /api/returns (that fix only protects the app's own POST endpoint —
--      it cannot stop a direct call to Supabase's REST API).
--
-- All 17 other tables in this schema correctly reject anon access — this is
-- not a global RLS-disabled situation. `supabase_full_migration.sql` (and
-- the older supabase_migration.sql, whose own header comments literally
-- suggest "ALTER TABLE ... DISABLE ROW LEVEL SECURITY" as a debugging step)
-- both specify RLS enabled with an anon-deny policy for these two tables —
-- so this is a live drift from what was migrated: RLS was almost certainly
-- switched off manually on just these two tables during development/
-- debugging and never switched back on.
--
-- This does NOT touch how the app itself works: the app never uses the anon
-- key for table access (only for Supabase Storage uploads) — every table
-- read/write goes through Next.js API routes using the service_role key,
-- which bypasses RLS entirely regardless of these policies.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.return_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'return_requests'
      AND policyname = 'return_requests_anon_deny'
  ) THEN
    CREATE POLICY "return_requests_anon_deny" ON public.return_requests FOR ALL TO anon USING (false);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'store_settings'
      AND policyname = 'store_settings_anon_deny'
  ) THEN
    CREATE POLICY "store_settings_anon_deny" ON public.store_settings FOR ALL TO anon USING (false);
  END IF;
END $$;

-- Verify — both rows must show rowsecurity = true. Then re-run the anon-key
-- curl commands above and confirm they now return [] / 401, not real data.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('return_requests', 'store_settings');
