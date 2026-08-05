-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL SECURITY FIX — v3. Run this in the Supabase SQL Editor immediately.
--
-- v1 (ENABLE ROW LEVEL SECURITY) was applied and confirmed (rowsecurity =
-- true), but did NOT close the hole: anon could still SELECT/INSERT/UPDATE/
-- DELETE on return_requests and SELECT on store_settings.
--
-- v2 (REVOKE ALL ... FROM anon, authenticated) was proposed but not applied
-- as the primary fix per instruction — the actual permissive policies were
-- inspected directly in pg_policies and identified by name:
--
--   return_requests: allow_select_return_requests
--                     allow_insert_return_requests
--                     allow_update_return_requests
--   store_settings:  "Allow all store settings"
--
-- These are PERMISSIVE policies. Postgres ORs all permissive policies
-- together for a given command, so any one of these granting access defeats
-- the "*_anon_deny" USING (false) policy regardless of it also being present.
--
-- This version explicitly DROPs those exact policies (primary fix — removes
-- the insecure grants completely, not just table-level REVOKE). It also
-- drops a couple of very likely companion names (a DELETE-scoped policy
-- almost certainly exists too: a direct anon DELETE succeeded in testing
-- against return_requests, but no delete-named policy was reported — it may
-- be misnamed or scoped FOR ALL), and ends with a dynamic catch-all block
-- that finds and drops ANY remaining PERMISSIVE policy applying to anon or
-- public on these two tables, so nothing is left behind under a name nobody
-- has seen yet. A table-level REVOKE is kept at the end purely as
-- belt-and-suspenders defense-in-depth, not as the fix itself.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Drop the exact insecure policies identified in pg_policies ──────────
DROP POLICY IF EXISTS "allow_select_return_requests" ON public.return_requests;
DROP POLICY IF EXISTS "allow_insert_return_requests" ON public.return_requests;
DROP POLICY IF EXISTS "allow_update_return_requests" ON public.return_requests;
DROP POLICY IF EXISTS "allow_delete_return_requests" ON public.return_requests;
DROP POLICY IF EXISTS "Allow all store settings" ON public.store_settings;

-- ── 2. Known historical/likely-named leftovers from earlier migrations ─────
DROP POLICY IF EXISTS "store_settings_anon_select" ON public.store_settings;
DROP POLICY IF EXISTS "return_requests_anon_select" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_anon_insert" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_anon_update" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_public_select" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_public_insert" ON public.return_requests;

-- ── 3. Catch-all: drop ANY remaining permissive policy on these two tables
--       that applies to anon or public, whatever it's named. ──────────────
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('return_requests', 'store_settings')
      AND permissive = 'PERMISSIVE'
      AND (roles @> ARRAY['anon']::name[] OR roles @> ARRAY['public']::name[])
      -- keep the intentional deny policies — they're USING(false) and safe
      AND policyname NOT IN ('return_requests_anon_deny', 'store_settings_anon_deny')
  LOOP
    RAISE NOTICE 'Dropping insecure policy % on %.%', pol.policyname, pol.schemaname, pol.tablename;
    EXECUTE format('DROP POLICY %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ── 4. Re-affirm RLS is on and the deny-all policy exists ──────────────────
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

-- ── 5. Defense-in-depth only (not the primary fix) ──────────────────────────
REVOKE ALL ON TABLE public.return_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.store_settings FROM anon, authenticated;

-- ── 6. Verify — both queries should now show ONLY the *_anon_deny policy
--       (or nothing) for anon/public, and the grants list should be empty. ─
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('return_requests', 'store_settings')
ORDER BY tablename, policyname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('return_requests', 'store_settings')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
