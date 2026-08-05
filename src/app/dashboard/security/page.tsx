'use client';

import { useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CheckCircle2, ShieldCheck, XCircle, RefreshCw, Lock, Key, Package2, Route,
} from 'lucide-react';
import { OPTIONAL_CHECKS } from '@/lib/security/env-check';
import { cn } from '@/lib/utils';
import { PageHelp } from '@/components/ui/page-help';

type EnvEntry = {
  key: string;
  present: boolean;
  isSecret: boolean;
  required: boolean;
  note: string;
};

type DepIssue = {
  pkg: string;
  issue: string;
  fixed: boolean;
  note: string;
};

type AuditData = {
  score: number;
  maxScore: number;
  percentage: number;
  checks: Record<string, boolean>;
  envVars: EnvEntry[];
  missingRequired: string[];
  depAudit: {
    critical: DepIssue[];
    high: DepIssue[];
    note: string;
  };
  routeAudit: {
    totalRoutes: number;
    protectedRoutes: number;
    publicRoutes: string[];
    merchantIsolation: string;
    csrfProtection: string;
  };
  auditDate: string;
  nextJsVersion: string;
};

function ScoreRing({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'text-emerald-500' : pct >= 60 ? 'text-amber-500' : 'text-red-500';
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <span className={cn('text-5xl font-bold tabular-nums', color)}>{pct}</span>
      <span className="text-sm text-muted-foreground font-medium">/ 100</span>
      <span className="text-xs text-muted-foreground">Security Score</span>
    </div>
  );
}

function Check({ label, passed }: { label: string; passed: boolean }) {
  const isOptional = OPTIONAL_CHECKS.has(label as string);
  return (
    <div className="flex items-center gap-2 text-sm">
      {passed
        ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
        : isOptional
          ? <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          : <XCircle className="h-4 w-4 text-red-500 shrink-0" />
      }
      <span className={passed ? 'text-foreground' : isOptional ? 'text-amber-600' : 'text-red-600 font-medium'}>
        {label}
        {isOptional && !passed && <span className="ml-1 text-xs font-normal text-muted-foreground">(opsiyonel)</span>}
      </span>
    </div>
  );
}

const PRODUCTION_CHECKLIST = [
  { label: 'NEXT_PUBLIC_DEPLOY_URL is set to the production https:// URL', category: 'Environment' },
  { label: 'SECRET_COOKIE_PASSWORD is set (≥32 characters)', category: 'Environment' },
  { label: 'CLIENT_SECRET is set and matches the ikas app configuration', category: 'Environment' },
  { label: 'SUPABASE_SERVICE_ROLE_KEY is set (server-only)', category: 'Environment' },
  { label: 'RESEND_API_KEY is set and domain is verified in Resend', category: 'Email' },
  { label: 'OPENAI_API_KEY is set (if AI Insights is needed)', category: 'AI' },
  { label: 'CRON_SECRET is set for webhook retry cron protection', category: 'Cron' },
  { label: 'Supabase tables created: team_members, team_invitations, audit_logs, webhooks, api_keys, api_logs, ai_insights_cache', category: 'Database' },
  { label: 'Row-Level Security (RLS) disabled on all tables (server uses service_role key)', category: 'Database' },
  { label: 'ikas app installed in the merchant store and OAuth flow completed', category: 'ikas' },
  { label: 'Custom domain configured (not vercel.app subdomain) for HSTS', category: 'Infrastructure' },
  { label: 'Vercel environment variables synced (not just .env.local)', category: 'Infrastructure' },
  { label: 'pnpm audit reviewed — only transitive dev-dependency issues remain', category: 'Dependencies' },
  { label: 'Error monitoring (Sentry or Vercel logs) configured', category: 'Observability' },
  { label: 'Test email delivery confirmed from Settings page', category: 'Email' },
  { label: 'ikas OAuth callback URL whitelisted in ikas app settings', category: 'ikas' },
];

const CHECKLIST_CATEGORIES = [...new Set(PRODUCTION_CHECKLIST.map((i) => i.category))];

export default function SecurityPage() {
  const { authHeader: token, isOwner } = useAuth();
  const { settings, loadSettings } = useStoreSettings();
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/security/audit', { headers: { Authorization: token ?? '' } })
      .then(async (r) => {
        if (!r.ok) {
          setError(r.status === 403 ? 'Only owners can view the security dashboard.' : 'Failed to load audit data.');
          return;
        }
        const j = await r.json();
        setAudit(j.data);
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Güvenlik Denetimi</h1>
              <PageHelp title="Güvenlik" content={<p>Kritik ortam değişkenleri, HTTPS kullanımı ve güvenlik kontrollerinin özeti. Eksik değişkenler kırmızı işaretlenir. Skoru 100&apos;e yaklaştırmak için eksik yapılandırmaları tamamlayın.</p>} />
            </div>
            <p className="text-sm text-muted-foreground">Security hardening &amp; production readiness</p>
          </div>
        </div>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {audit && (
          <>
            {/* Score + checks */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-center">
                <ScoreRing pct={audit.percentage} />
              </div>
              <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 space-y-2">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Security Checks</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-4">
                  {Object.entries(audit.checks).map(([label, passed]) => (
                    <Check key={label} label={label} passed={passed} />
                  ))}
                </div>
              </div>
            </div>

            {/* Missing env vars alert */}
            {audit.missingRequired.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Missing Required Environment Variables</p>
                  <ul className="mt-1 space-y-0.5">
                    {audit.missingRequired.map((k) => (
                      <li key={k} className="text-xs font-mono text-red-600">{k}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Environment Variables */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Environment Variables</p>
              </div>
              <div className="divide-y divide-border">
                {audit.envVars.map((e) => (
                  <div key={e.key} className="flex items-start gap-3 px-4 py-2.5">
                    {e.present
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                      : e.required
                        ? <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="text-xs font-mono text-foreground">{e.key}</code>
                        {e.isSecret && (
                          <Lock className="h-3 w-3 text-muted-foreground" />
                        )}
                        {e.required
                          ? <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>
                          : <Badge variant="secondary" className="text-[10px] px-1.5 py-0 opacity-60">Optional</Badge>
                        }
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{e.note}</p>
                    </div>
                    <span className={cn('text-xs font-medium shrink-0', e.present ? 'text-emerald-600' : e.required ? 'text-red-600' : 'text-amber-600')}>
                      {e.present ? 'Set' : 'Missing'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dependency Audit */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Package2 className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Dependency Audit</p>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-auto">pnpm audit</Badge>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">{audit.depAudit.note}</p>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Critical</p>
                <div className="space-y-2">
                  {audit.depAudit.critical.map((d) => (
                    <div key={d.pkg} className="flex items-start gap-2 text-xs">
                      {d.fixed
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        : <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      }
                      <div>
                        <span className="font-mono font-semibold">{d.pkg}</span>
                        <span className="text-muted-foreground ml-1">{d.issue}</span>
                        <p className="text-muted-foreground italic">{d.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">High</p>
                <div className="space-y-2">
                  {audit.depAudit.high.map((d) => (
                    <div key={d.pkg} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-mono font-semibold">{d.pkg}</span>
                        <span className="text-muted-foreground ml-1">{d.issue}</span>
                        <p className="text-muted-foreground italic">{d.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Next.js version: <code className="font-mono">{audit.nextJsVersion}</code></p>
              </div>
            </div>

            {/* Route Audit */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <Route className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Route Protection</p>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3 text-center">
                    <p className="text-2xl font-bold text-emerald-700">{audit.routeAudit.protectedRoutes}</p>
                    <p className="text-xs text-emerald-600">Protected routes</p>
                  </div>
                  <div className="rounded-lg bg-muted border border-border px-4 py-3 text-center">
                    <p className="text-2xl font-bold">{audit.routeAudit.totalRoutes}</p>
                    <p className="text-xs text-muted-foreground">Total routes</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Public (unauthenticated) routes</p>
                  <ul className="space-y-0.5">
                    {audit.routeAudit.publicRoutes.map((r) => (
                      <li key={r} className="text-xs font-mono text-muted-foreground">• {r}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-semibold text-foreground">Merchant isolation:</span> {audit.routeAudit.merchantIsolation}</p>
                  <p><span className="font-semibold text-foreground">CSRF:</span> {audit.routeAudit.csrfProtection}</p>
                </div>
              </div>
            </div>

            {/* Production Checklist */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-semibold">Production Checklist</p>
              </div>
              <div className="p-4 space-y-4">
                {CHECKLIST_CATEGORIES.map((cat) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</p>
                    <div className="space-y-1.5">
                      {PRODUCTION_CHECKLIST.filter((i) => i.category === cat).map((item) => (
                        <div key={item.label} className="flex items-start gap-2">
                          <input type="checkbox" className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded accent-primary" />
                          <span className="text-xs text-foreground">{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Last audit: {new Date(audit.auditDate).toLocaleString('tr-TR')}
            </p>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
