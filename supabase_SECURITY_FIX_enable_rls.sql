-- ═══════════════════════════════════════════════════════════════════════════
-- CRITICAL SECURITY FIX — v2. Run this in the Supabase SQL Editor immediately.
--
-- v1 of this file (ALTER TABLE ... ENABLE ROW LEVEL SECURITY) was run and
-- confirmed: rowsecurity = true on both tables. That was NOT sufficient —
-- re-attacking the live project with the anon key afterward proved anon can
-- still SELECT, INSERT, UPDATE, and DELETE on return_requests, and SELECT on
-- store_settings. One of those anonymous requests (an UPDATE, part of this
-- re-verification) briefly overwrote a real row's status before being
-- reverted with the service_role key.
--
-- Root cause: RLS was enabled, but at least one additional PERMISSIVE policy
-- for the anon role is still active on these tables alongside the intended
-- "*_anon_deny" USING (false) policy. Postgres OR's multiple permissive
-- policies together — a single permissive policy allowing access defeats any
-- number of deny policies, regardless of how many exist. supabase_migration.sql
-- (line 137) references a policy literally named "store_settings_anon_select"
-- that existed early in this project (from before /api/store-settings and
-- /api/returns existed and the client queried these tables directly with the
-- anon key) — that policy, or something equivalent for return_requests, is
-- almost certainly still live.
--
-- I do not have a way to list the exact policies currently on these tables
-- (PostgREST only exposes the public/graphql_public schemas — pg_policies is
-- not reachable over the REST API with any key), so this fix does not depend
-- on knowing the exact policy name. REVOKE removes the base table-level
-- privilege grant, which Postgres checks BEFORE it ever evaluates RLS
-- policies — so it blocks anon/authenticated regardless of how many
-- permissive policies exist or what they're named, present or future.
-- ═══════════════════════════════════════════════════════════════════════════

REVOKE ALL ON TABLE public.return_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.store_settings FROM anon, authenticated;

-- Belt-and-suspenders: also try to drop the specific leftover policy named in
-- supabase_migration.sql's own history, and the equivalent guess for
-- return_requests, in case they're still present under these names.
DROP POLICY IF EXISTS "store_settings_anon_select" ON public.store_settings;
DROP POLICY IF EXISTS "return_requests_anon_select" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_anon_insert" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_public_select" ON public.return_requests;
DROP POLICY IF EXISTS "return_requests_public_insert" ON public.return_requests;

-- Re-affirm RLS is on and the deny policy exists (idempotent, safe to re-run).
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

-- ── Diagnostics — please run this and keep the output. ─────────────────────
-- This lists every policy currently on these two tables (name, command,
-- roles, and the actual USING/WITH CHECK expressions). If REVOKE alone
-- doesn't fully close this, this output identifies exactly what to DROP.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('return_requests', 'store_settings')
ORDER BY tablename, policyname;

-- Also list the actual table-level grants for anon/authenticated — should be
-- EMPTY for both tables after the REVOKE above.
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('return_requests', 'store_settings')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;
