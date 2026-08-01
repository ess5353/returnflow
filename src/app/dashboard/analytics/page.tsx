'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { TokenHelpers } from '@/helpers/token-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { BarChart2, CheckCircle2, CircleDollarSign, Minus, Package, Tag, TrendingDown, TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReturnRow = {
  id: string;
  status: string;
  reason: string;
  amount: string;
  created_at: string;
  products: { name: string; quantity: number; price: number }[] | null;
  request_type: 'return' | 'exchange' | null;
  exchange_type: string | null;
};

type AnalyticsTab = 'all' | 'return' | 'exchange';

type RangeFilter = '7d' | '30d' | '90d' | 'all' | 'custom';
type Grouping = 'day' | 'week' | 'month';

interface InsightConfig {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = '#6f55ff';
const CHART_GRID = '#eef2f6';
const CHART_TICK = '#697586';

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: '7d', label: 'Son 7 Gün' },
  { value: '30d', label: 'Son 30 Gün' },
  { value: '90d', label: 'Son 90 Gün' },
  { value: 'all', label: 'Tümü' },
  { value: 'custom', label: 'Özel' },
];

const GROUPING_LABELS: Record<Grouping, string> = { day: 'Gün', week: 'Hafta', month: 'Ay' };

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function getRangeStart(filter: RangeFilter, customStart: string): Date {
  const now = new Date();
  if (filter === '7d') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (filter === '30d') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (filter === '90d') return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  if (filter === 'custom' && customStart) return new Date(customStart + 'T00:00:00');
  return new Date(0);
}

function getRangeEnd(filter: RangeFilter, customEnd: string): Date {
  if (filter === 'custom' && customEnd) return new Date(customEnd + 'T23:59:59');
  return new Date();
}

function autoGrouping(start: Date, end: Date): Grouping {
  const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 31) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatGroupKey(date: Date, grouping: Grouping): string {
  if (grouping === 'day') return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  if (grouping === 'week') return getStartOfWeek(date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  return date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
}

function buildTimeline(rows: ReturnRow[], grouping: Grouping, start: Date, end: Date) {
  const map = new Map<string, number>();

  const iter = new Date(start);
  iter.setHours(0, 0, 0, 0);
  const cap = new Date(end);
  cap.setHours(23, 59, 59, 999);

  while (iter <= cap) {
    const key = formatGroupKey(iter, grouping);
    if (!map.has(key)) map.set(key, 0);
    if (grouping === 'day') iter.setDate(iter.getDate() + 1);
    else if (grouping === 'week') iter.setDate(iter.getDate() + 7);
    else iter.setMonth(iter.getMonth() + 1);
  }

  for (const r of rows) {
    const key = formatGroupKey(new Date(r.created_at), grouping);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

function ChartTooltip(props: Record<string, unknown>) {
  const { active, payload, label } = props as {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
  };
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-foreground mb-0.5">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} talep</p>
    </div>
  );
}

// ─── Insight card ─────────────────────────────────────────────────────────────

function InsightCard({ icon: Icon, label, value, sub, trend, trendLabel }: InsightConfig) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-xs flex gap-3 items-start">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-bold text-foreground leading-tight mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        {trend && trendLabel && (
          <span
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
              trend === 'up' && 'bg-emerald-50 text-emerald-700',
              trend === 'down' && 'bg-red-50 text-red-700',
              trend === 'neutral' && 'bg-muted text-muted-foreground',
            )}
          >
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {trendLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Analytics page ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTab>('all');
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [grouping, setGrouping] = useState<Grouping>('day');
  const { settings, loadSettings } = useStoreSettings();

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    setMounted(true);
    TokenHelpers.getTokenForIframeApp().then(setToken);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const loadData = useCallback(async (t: string) => {
    const res = await fetch('/api/returns', { headers: { Authorization: `JWT ${t}` } });
    const result = await res.json();
    if (result.data) setRows(result.data as ReturnRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (token) loadData(token);
  }, [token, loadData]);

  // Update grouping automatically when range filter changes
  useEffect(() => {
    if (rangeFilter === 'custom') return;
    const start = getRangeStart(rangeFilter, '');
    setGrouping(autoGrouping(start, new Date()));
  }, [rangeFilter]);

  // ── Computed values ──────────────────────────────────────────────────────────

  const rangeStart = useMemo(() => getRangeStart(rangeFilter, customStart), [rangeFilter, customStart]);
  const rangeEnd = useMemo(() => getRangeEnd(rangeFilter, customEnd), [rangeFilter, customEnd]);

  const filtered = useMemo(() => {
    let r = rows.filter((x) => { const d = new Date(x.created_at); return d >= rangeStart && d <= rangeEnd; });
    if (analyticsTab === 'return') r = r.filter((x) => (x.request_type ?? 'return') === 'return');
    if (analyticsTab === 'exchange') r = r.filter((x) => x.request_type === 'exchange');
    return r;
  }, [rows, rangeStart, rangeEnd, analyticsTab]);

  const prevFiltered = useMemo(() => {
    if (rangeFilter === 'all') return null;
    if (rangeFilter === 'custom' && (!customStart || !customEnd)) return null;
    const duration = rangeEnd.getTime() - rangeStart.getTime();
    if (duration <= 0) return null;
    const prevStart = new Date(rangeStart.getTime() - duration);
    const prevEnd = new Date(rangeStart.getTime() - 1);
    return rows.filter((r) => { const d = new Date(r.created_at); return d >= prevStart && d <= prevEnd; });
  }, [rows, rangeStart, rangeEnd, rangeFilter, customStart, customEnd]);

  const pending = useMemo(() => filtered.filter((r) => r.status === 'Yeni Talep').length, [filtered]);
  const approved = useMemo(() => filtered.filter((r) => r.status === 'Onaylandı').length, [filtered]);
  const rejected = useMemo(() => filtered.filter((r) => r.status === 'Reddedildi').length, [filtered]);
  const resolved = approved + rejected;

  const totalAmount = useMemo(
    () => filtered.reduce((s, r) => s + parseFloat(r.amount || '0'), 0),
    [filtered],
  );
  const avgAmount = filtered.length > 0 ? totalAmount / filtered.length : 0;

  const EXCHANGE_TYPE_LABELS: Record<string, string> = {
    same_product_size: 'Farklı beden',
    same_product_color: 'Farklı renk',
    different_product: 'Farklı ürün',
  };

  const reasonCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of filtered) {
      const key = analyticsTab === 'exchange' && r.exchange_type
        ? (EXCHANGE_TYPE_LABELS[r.exchange_type] ?? r.exchange_type)
        : r.reason;
      map[key] = (map[key] || 0) + 1;
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, analyticsTab]);

  const productStats = useMemo(() => {
    const map: Record<string, { count: number; amount: number }> = {};
    for (const r of filtered) {
      if (r.products) {
        for (const p of r.products) {
          if (!map[p.name]) map[p.name] = { count: 0, amount: 0 };
          map[p.name].count += p.quantity;
          map[p.name].amount += p.price * p.quantity;
        }
      }
    }
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [filtered]);

  const timelineData = useMemo(
    () => buildTimeline(filtered, grouping, rangeStart, rangeEnd),
    [filtered, grouping, rangeStart, rangeEnd],
  );

  // ── Insights ─────────────────────────────────────────────────────────────────

  const insights = useMemo<InsightConfig[]>(() => {
    const list: InsightConfig[] = [];

    // Period comparison
    if (prevFiltered !== null && (prevFiltered.length > 0 || filtered.length > 0)) {
      const prev = prevFiltered.length;
      const curr = filtered.length;
      const pct = prev === 0 ? null : Math.round(((curr - prev) / prev) * 100);
      const trend: 'up' | 'down' | 'neutral' =
        pct === null ? 'up' : pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
      const trendLabel =
        pct === null
          ? 'İlk dönem'
          : pct === 0
            ? 'Değişim yok'
            : `${pct > 0 ? '+' : ''}${pct}%`;
      list.push({
        icon: trend === 'down' ? TrendingDown : TrendingUp,
        label: 'Dönem Karşılaştırması',
        value: `${curr} iade`,
        sub: `Önceki dönem: ${prev} iade`,
        trend,
        trendLabel,
      });
    }

    // Approval rate
    if (resolved > 0) {
      const rate = Math.round((approved / resolved) * 100);
      list.push({
        icon: CheckCircle2,
        label: 'Onay Oranı',
        value: `%${rate}`,
        sub: `${approved} onay · ${rejected} red`,
      });
    }

    // Most common reason
    if (reasonCounts.length > 0) {
      const [topReason, topCount] = reasonCounts[0];
      const pct = filtered.length > 0 ? Math.round((topCount / filtered.length) * 100) : 0;
      list.push({
        icon: Tag,
        label: 'En Sık İade Sebebi',
        value: topReason,
        sub: `${topCount} iade — tüm iadelerin %${pct}'i`,
      });
    }

    // Most returned product
    if (productStats.length > 0) {
      const [topProduct, stats] = productStats[0];
      list.push({
        icon: Package,
        label: 'En Çok İade Edilen Ürün',
        value: topProduct,
        sub: `${stats.count} adet · ₺${stats.amount.toLocaleString('tr-TR')} toplam`,
      });
    }

    // Total return value
    if (filtered.length > 0) {
      list.push({
        icon: CircleDollarSign,
        label: 'Toplam İade Değeri',
        value: `₺${totalAmount.toLocaleString('tr-TR')}`,
        sub: `Ort. ₺${avgAmount.toFixed(0)} / iade`,
      });
    }

    return list;
  }, [filtered, prevFiltered, reasonCounts, productStats, approved, rejected, resolved, totalAmount, avgAmount]);

  // ── Layout ────────────────────────────────────────────────────────────────────

  const exchangeCount = useMemo(() => filtered.filter((r) => r.request_type === 'exchange').length, [filtered]);
  const returnCount = useMemo(() => filtered.filter((r) => (r.request_type ?? 'return') === 'return').length, [filtered]);

  const overviewStats = analyticsTab === 'all'
    ? [
        { label: 'Toplam Talep', value: filtered.length },
        { label: 'İade', value: returnCount },
        { label: 'Değişim', value: exchangeCount },
        { label: 'Bekleyen', value: pending },
      ]
    : [
        { label: analyticsTab === 'exchange' ? 'Toplam Değişim' : 'Toplam İade', value: filtered.length },
        { label: 'Bekleyen', value: pending },
        { label: 'Onaylanan', value: approved },
        { label: 'Reddedilen', value: rejected },
      ];

  const isEmpty = !loading && filtered.length === 0;

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 md:p-8 space-y-6">
        {/* Header + date range filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Analiz</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">İade ve değişim verilerinden otomatik oluşturulan istatistikler.</p>

            {/* Analytics type tab */}
            <div className="mt-3 flex rounded-lg border border-border overflow-hidden text-xs font-medium w-fit">
              {([
                { value: 'all', label: 'Tümü' },
                { value: 'return', label: 'İadeler' },
                { value: 'exchange', label: 'Değişimler' },
              ] as { value: AnalyticsTab; label: string }[]).map((t) => (
                <button
                  key={t.value}
                  onClick={() => setAnalyticsTab(t.value)}
                  className={`px-4 py-1.5 transition-colors ${
                    analyticsTab === t.value ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap gap-1.5">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setRangeFilter(o.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    rangeFilter === o.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {rangeFilter === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <span className="text-xs text-muted-foreground">—</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded-lg border border-border px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            )}
          </div>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
            : overviewStats.map((s) => (
                <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-xs">
                  <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                  <p className="mt-1.5 text-2xl font-bold tracking-tight">{s.value}</p>
                </div>
              ))}
        </div>

        {/* Insights */}
        {loading ? (
          <div>
            <Skeleton className="h-4 w-20 mb-3 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          </div>
        ) : insights.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold mb-3">İçgörüler</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {insights.map((ins, i) => (
                <InsightCard key={i} {...ins} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Empty state */}
        {isEmpty && (
          <div className="rounded-xl border border-border bg-card p-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mx-auto mb-4">
              <BarChart2 className="h-6 w-6 text-muted-foreground" />
            </div>
            <h2 className="text-base font-semibold">Bu dönemde iade bulunmuyor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Farklı bir tarih aralığı seçin.</p>
          </div>
        )}

        {/* Charts — shown only when data exists */}
        {!isEmpty && (
          <>
            {/* Timeline */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-border p-4">
                <div>
                  <h2 className="text-sm font-semibold">
                    {analyticsTab === 'exchange' ? 'Değişim Trendi' : analyticsTab === 'return' ? 'İade Trendi' : 'Talep Trendi'}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Seçili dönemde talep hacmi</p>
                </div>
                <div className="flex gap-1.5">
                  {(['day', 'week', 'month'] as Grouping[]).map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrouping(g)}
                      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                        grouping === g ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {GROUPING_LABELS[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 pb-2">
                {!mounted ? (
                  <Skeleton className="h-52 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={timelineData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: CHART_TICK }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: CHART_TICK }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={(p) => <ChartTooltip {...(p as Record<string, unknown>)} />} cursor={{ fill: '#f8fafc' }} />
                      <Bar dataKey="count" fill={PRIMARY} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Reasons + Products */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Reasons */}
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="border-b border-border p-4">
                  <h2 className="text-sm font-semibold">{analyticsTab === 'exchange' ? 'Değişim Türleri' : 'İade Sebepleri'}</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Türüne göre dağılım</p>
                </div>
                <div className="p-4">
                  {!mounted ? (
                    <Skeleton className="h-40 w-full" />
                  ) : reasonCounts.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">Veri yok</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={reasonCounts.length * 48}>
                        <BarChart
                          data={reasonCounts.map(([reason, count]) => ({ reason, count }))}
                          layout="vertical"
                          margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: CHART_TICK }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <YAxis
                            type="category"
                            dataKey="reason"
                            width={130}
                            tick={{ fontSize: 10, fill: CHART_TICK }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip content={(p) => <ChartTooltip {...(p as Record<string, unknown>)} />} cursor={{ fill: '#f8fafc' }} />
                          <Bar dataKey="count" fill={PRIMARY} radius={[0, 4, 4, 0]} maxBarSize={24} />
                        </BarChart>
                      </ResponsiveContainer>

                      <div className="mt-4 divide-y divide-border">
                        {reasonCounts.map(([reason, count]) => (
                          <div key={reason} className="flex items-center justify-between py-2 text-xs">
                            <span className="font-medium text-foreground">{reason}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-muted-foreground">{count} iade</span>
                              <span className="w-9 text-right font-mono text-muted-foreground">
                                %{filtered.length > 0 ? Math.round((count / filtered.length) * 100) : 0}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Products */}
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="border-b border-border p-4">
                  <h2 className="text-sm font-semibold">En Çok İade Edilen Ürünler</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Ürün bazında iade adedi ve değeri</p>
                </div>
                {productStats.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">
                      Ürün verisi bulunamadı.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">İadeler ürün detayı içermediğinde bu alan boş kalır.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {productStats.slice(0, 10).map(([name, stats], i) => (
                      <div key={name} className="flex items-center gap-3 px-4 py-3">
                        <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground">{name}</p>
                          <p className="text-xs text-muted-foreground">₺{stats.amount.toLocaleString('tr-TR')}</p>
                        </div>
                        <span className="shrink-0 text-xs font-semibold">{stats.count} adet</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
