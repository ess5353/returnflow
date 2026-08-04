'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Line, LineChart, Legend,
} from 'recharts';
import {
  AlertTriangle, Bot, Brain, CheckCircle2, ChevronRight,
  Info, RefreshCw, Sparkles, TrendingDown, TrendingUp, XCircle,
  BarChart2, Package, MessageSquare, Zap, DollarSign, Users,
  Lightbulb, Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Insight, InsightsPayload, InsightSection, InsightSeverity, MerchantStats } from '@/lib/insights/types';
import { PageHelp } from '@/components/ui/page-help';

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTION_META: Record<InsightSection, { label: string; icon: React.ElementType }> = {
  executive_summary: { label: 'Yönetici Özeti', icon: Activity },
  return_trends: { label: 'İade Trendleri', icon: TrendingDown },
  exchange_trends: { label: 'Değişim Trendleri', icon: TrendingUp },
  top_returned_products: { label: 'En Çok İade Edilen Ürünler', icon: Package },
  top_return_reasons: { label: 'En Sık İade Sebepleri', icon: MessageSquare },
  automation_performance: { label: 'Otomasyon Performansı', icon: Zap },
  financial_impact: { label: 'Finansal Etki', icon: DollarSign },
  customer_behaviour: { label: 'Müşteri Davranışı', icon: Users },
  actionable_recommendations: { label: 'Aksiyon Önerileri', icon: Lightbulb },
};

const SEVERITY_CONFIG: Record<InsightSeverity, { label: string; icon: React.ElementType; bg: string; border: string; icon_class: string; badge: string }> = {
  positive: {
    label: 'Olumlu',
    icon: CheckCircle2,
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon_class: 'text-green-600',
    badge: 'bg-green-100 text-green-700',
  },
  info: {
    label: 'Bilgi',
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon_class: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-700',
  },
  warning: {
    label: 'Dikkat',
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon_class: 'text-amber-600',
    badge: 'bg-amber-100 text-amber-700',
  },
  critical: {
    label: 'Kritik',
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon_class: 'text-red-600',
    badge: 'bg-red-100 text-red-700',
  },
};

const SECTIONS_ORDER: InsightSection[] = [
  'executive_summary', 'return_trends', 'exchange_trends',
  'top_returned_products', 'top_return_reasons', 'automation_performance',
  'financial_impact', 'customer_behaviour', 'actionable_recommendations',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor(diff / 60000);
  if (hours >= 1) return `${hours} saat önce`;
  if (minutes >= 1) return `${minutes} dakika önce`;
  return 'Az önce';
}

function fmt(n: number): string {
  return n.toLocaleString('tr-TR');
}

// ─── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }: { insight: Insight }) {
  const cfg = SEVERITY_CONFIG[insight.severity];
  const Icon = cfg.icon;

  return (
    <div className={cn('rounded-xl border p-4 space-y-3', cfg.bg, cfg.border)}>
      <div className="flex items-start gap-3">
        <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', cfg.icon_class)} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground">{insight.title}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', cfg.badge)}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
        </div>
      </div>

      {/* Confidence bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Güven</span>
          <span className="text-xs font-medium text-muted-foreground">%{insight.confidence}</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-black/10">
          <div
            className={cn('h-1.5 rounded-full transition-all', {
              'bg-green-500': insight.severity === 'positive',
              'bg-blue-500': insight.severity === 'info',
              'bg-amber-500': insight.severity === 'warning',
              'bg-red-500': insight.severity === 'critical',
            })}
            style={{ width: `${insight.confidence}%` }}
          />
        </div>
      </div>

      {/* Recommendation */}
      <div className="flex items-start gap-2 rounded-lg bg-white/60 px-3 py-2">
        <ChevronRight className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="text-xs text-foreground">{insight.recommendation}</p>
      </div>
    </div>
  );
}

// ─── Section Block ────────────────────────────────────────────────────────────

function SectionBlock({
  section,
  insights,
  stats,
}: {
  section: InsightSection;
  insights: Insight[];
  stats: MerchantStats;
}) {
  const meta = SECTION_META[section];
  const Icon = meta.icon;

  return (
    <div id={`section-${section}`} className="space-y-3 scroll-mt-4">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-3.5 w-3.5 text-primary" />
        </div>
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {insights.length}
        </span>
      </div>

      {/* Section-specific charts */}
      {(section === 'return_trends' || section === 'exchange_trends') && stats.weeklyTrend.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Son 8 Hafta</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={stats.weeklyTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="returns" name="İade" stroke="#ef4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="exchanges" name="Değişim" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {section === 'top_returned_products' && stats.topReturnedProducts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={Math.max(120, stats.topReturnedProducts.length * 36)}>
            <BarChart
              data={stats.topReturnedProducts}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={120}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v, _name, entry) => [`${v} iade (%${(entry.payload as { pct?: number })?.pct ?? 0})`, 'Adet']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} fill="#ef4444">
                {stats.topReturnedProducts.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#ef4444' : `rgba(239,68,68,${0.7 - i * 0.12})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {section === 'top_return_reasons' && stats.topReturnReasons.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height={Math.max(120, stats.topReturnReasons.length * 36)}>
            <BarChart
              data={stats.topReturnReasons}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                width={120}
                tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 18) + '…' : v}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v, _name, entry) => [`${v} talep (%${(entry.payload as { pct?: number })?.pct ?? 0})`, 'Adet']}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {stats.topReturnReasons.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#f59e0b' : `rgba(245,158,11,${0.7 - i * 0.1})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {section === 'automation_performance' && stats.topAutomationRules.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-xs font-medium text-muted-foreground">Kural Performansı</p>
          <div className="space-y-2">
            {stats.topAutomationRules.map((rule, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-32 truncate text-xs text-muted-foreground">{rule.ruleName}</span>
                <div className="flex-1 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-violet-500"
                    style={{ width: `${Math.round((rule.count / (stats.topAutomationRules[0]?.count || 1)) * 100)}%` }}
                  />
                </div>
                <span className="w-8 text-right text-xs font-medium">{rule.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2">
        {insights.map((insight) => (
          <InsightCard key={insight.id} insight={insight} />
        ))}
      </div>
    </div>
  );
}

// ─── Summary Stats Bar ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const { authHeader: token } = useAuth();
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cached, setCached] = useState(false);

  const fetchInsights = useCallback(async (tk: string, force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    const url = `/api/insights${force ? '?refresh=1' : ''}`;
    const res = await fetch(url, { headers: { Authorization: tk } });
    if (res.ok) {
      const json = await res.json();
      setPayload(json.data as InsightsPayload);
      setCached(json.cached ?? false);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const init = useCallback(async () => {
    if (token) await fetchInsights(token!);
    else setLoading(false);
  }, [fetchInsights]);

  useEffect(() => { AppBridgeHelper.closeLoader(); }, []);
  useEffect(() => { init(); }, [init]);

  const stats = payload?.stats;
  const insights = payload?.insights ?? [];
  const insightsBySection = SECTIONS_ORDER.reduce<Record<InsightSection, Insight[]>>(
    (acc, s) => { acc[s] = insights.filter((i) => i.section === s); return acc; },
    {} as Record<InsightSection, Insight[]>,
  );

  // Quick nav
  const sectionsWithData = SECTIONS_ORDER.filter((s) => insightsBySection[s].length > 0);

  return (
    <DashboardShell>
      <div className="flex h-full min-h-screen">
        {/* Side nav */}
        <nav className="sticky top-0 hidden h-screen w-48 shrink-0 overflow-y-auto border-r border-border py-6 lg:block">
          <div className="px-4 pb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bölümler</span>
          </div>
          <div className="space-y-0.5 px-3">
            {sectionsWithData.map((s) => {
              const meta = SECTION_META[s];
              const Icon = meta.icon;
              const criticalCount = insightsBySection[s].filter((i) => i.severity === 'critical').length;
              return (
                <a
                  key={s}
                  href={`#section-${s}`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{meta.label}</span>
                  {criticalCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                      {criticalCount}
                    </span>
                  )}
                </a>
              );
            })}
          </div>
        </nav>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-8 p-6 pb-24">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <h1 className="text-lg font-semibold">AI Insights</h1>
                  <PageHelp title="AI Insights" content={<p>Yapay zeka ile iade verilerinizi analiz eder: en sık iade edilen ürünler, ortak nedenler ve dönemsel anomaliler. OpenAI API anahtarı tanımlıysa AI destekli, değilse istatistiksel analiz çalışır.</p>} />
                  {payload?.aiPowered && (
                    <span className="flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                      <Sparkles className="h-3 w-3" />
                      AI Destekli
                    </span>
                  )}
                  {payload && !payload.aiPowered && (
                    <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                      <BarChart2 className="h-3 w-3" />
                      İstatistiksel
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {payload
                    ? `${cached ? 'Önbellekten · ' : ''}${timeAgo(payload.generatedAt)} üretildi · 12 saat geçerli`
                    : 'Veriler analiz ediliyor…'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => fetchInsights(token!, true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', refreshing && 'animate-spin')} />
                Yenile
              </Button>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                {[1,2,3].map((i) => (
                  <div key={i} className="space-y-3">
                    <Skeleton className="h-6 w-40 rounded" />
                    <div className="grid gap-3 lg:grid-cols-2">
                      <Skeleton className="h-36 rounded-xl" />
                      <Skeleton className="h-36 rounded-xl" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary stats */}
            {!loading && stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  label="Toplam Talep"
                  value={fmt(stats.totalRequests)}
                  sub={`${fmt(stats.totalReturns)} iade · ${fmt(stats.totalExchanges)} değişim`}
                  icon={Activity}
                />
                <StatCard
                  label="Otomasyon Oranı"
                  value={`%${stats.automationMatchRate}`}
                  sub={`${fmt(stats.totalAutomated)} otomatik işlem`}
                  icon={Zap}
                />
                <StatCard
                  label="Toplam Tutar"
                  value={`₺${fmt(Math.round(stats.totalAmount))}`}
                  sub={`Ort. ₺${stats.avgAmount.toFixed(0)} / talep`}
                  icon={DollarSign}
                />
                <StatCard
                  label="Ort. Çözüm"
                  value={`${stats.avgResolutionDays} gün`}
                  sub={`${fmt(stats.totalUniqueCustomers)} müşteri`}
                  icon={Users}
                />
              </div>
            )}

            {/* Sections */}
            {!loading && payload && (
              <div className="space-y-10">
                {sectionsWithData.map((section) => (
                  <SectionBlock
                    key={section}
                    section={section}
                    insights={insightsBySection[section]}
                    stats={stats!}
                  />
                ))}
              </div>
            )}

            {/* No data state */}
            {!loading && !payload && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-24 text-center">
                <Bot className="h-12 w-12 text-muted-foreground/40" />
                <div>
                  <p className="font-medium text-muted-foreground">İçgörüler yüklenemedi</p>
                  <p className="mt-1 text-sm text-muted-foreground">Lütfen sayfayı yenileyin.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => fetchInsights(token!, true)}>
                  Tekrar Dene
                </Button>
              </div>
            )}

            {/* OpenAI setup hint */}
            {payload && !payload.aiPowered && (
              <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-violet-600" />
                  <div className="text-xs text-violet-800">
                    <strong>AI destekli içgörüleri etkinleştirin:</strong> Vercel ortam değişkenlerine{' '}
                    <code className="rounded bg-violet-100 px-1">OPENAI_API_KEY</code> ekleyin.
                    Bu sayede içgörüler OpenAI tarafından daha derinlemesine yorumlanır.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
