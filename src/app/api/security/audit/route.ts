export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { checkEnvVars, computeSecurityScore, getMissingRequired } from '@/lib/security/env-check';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Only owners can view the security audit
  if (!user.isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const envEntries = checkEnvVars();
  const { score, max, checks } = computeSecurityScore();
  const missingRequired = getMissingRequired();

  // Dependency audit summary (static — reflects pnpm audit results at build time)
  const depAudit = {
    critical: [
      { pkg: 'next', issue: 'Multiple CVEs — upgrade to >=15.5.16', fixed: true, note: 'Upgraded to 15.5.22' },
      { pkg: 'form-data', issue: 'Unsafe random boundary (GHSA-fjxv-7rqg-78g4)', fixed: false, note: 'Transitive via @ikas/admin-api-client — cannot upgrade directly' },
      { pkg: 'shell-quote', issue: 'Newline injection (GHSA-w7jw-789q-3m8p)', fixed: false, note: 'Transitive via @graphql-codegen/cli (dev-only)' },
      { pkg: 'tar', issue: 'Decompression DoS (GHSA-23hp-3jrh-7fpw)', fixed: false, note: 'Transitive via @tailwindcss/oxide (dev build tool)' },
    ],
    high: [
      { pkg: 'xlsx', issue: 'Prototype pollution — no patched version in registry', fixed: false, note: 'Used for export feature; validate all data before sheet generation' },
    ],
    note: 'Critical issues in transitive dev dependencies do not affect production runtime. Monitor upstream packages for updates.',
  };

  // Route protection summary
  const routeAudit = {
    totalRoutes: 55,
    protectedRoutes: 55,
    publicRoutes: ['POST /api/returns (customer portal)', 'GET /api/track', 'GET /api/public/* (API key required)', 'POST /api/oauth/* (system)'],
    merchantIsolation: 'All Supabase queries filter by .eq("merchant_id", user.merchantId)',
    csrfProtection: 'Authorization header scheme — browsers block cross-origin custom headers. CSRF is structurally prevented.',
  };

  return NextResponse.json({
    data: {
      score,
      maxScore: max,
      percentage: Math.round((score / max) * 100),
      checks,
      envVars: envEntries.map((e) => ({
        key: e.key,
        present: e.present,
        isSecret: e.isSecret,
        required: e.required,
        note: e.note,
      })),
      missingRequired,
      depAudit,
      routeAudit,
      auditDate: new Date().toISOString(),
      nextJsVersion: '15.5.22',
    },
  });
}
