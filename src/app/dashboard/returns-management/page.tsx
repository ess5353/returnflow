'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { TokenHelpers } from '@/helpers/token-helpers';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import {
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileX,
  Filter,
  MessageSquare,
  RefreshCw,
  Search,
  SlidersHorizontal,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────────────────

type ReturnRow = {
  id: string;
  order_id: string;
  rf_number: string;
  customer_name: string;
  customer_email: string | null;
  product: string;
  products: { name: string; quantity: number; price: number }[] | null;
  reason: string;
  description: string | null;
  admin_note: string | null;
  amount: string;
  status: string;
  created_at: string;
  updated_at: string | null;
  media_urls: string[] | null;
};

type AutomationLog = {
  id: string;
  rule_name: string | null;
  matched: boolean;
  action_taken: string | null;
  created_at: string;
};

type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
type DateFilter = 'all' | 'today' | '7d' | '30d' | '90d';

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ['Tümü', 'Yeni Talep', 'Onaylandı', 'Reddedildi'] as const;

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'En Yeni' },
  { value: 'oldest', label: 'En Eski' },
  { value: 'amount_desc', label: 'Tutar (Yüksek → Düşük)' },
  { value: 'amount_asc', label: 'Tutar (Düşük → Yüksek)' },
];

const DATE_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'Tüm Zamanlar' },
  { value: 'today', label: 'Bugün' },
  { value: '7d', label: 'Son 7 Gün' },
  { value: '30d', label: 'Son 30 Gün' },
  { value: '90d', label: 'Son 90 Gün' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusVariant(status: string): 'pending' | 'approved' | 'rejected' | 'secondary' {
  if (status === 'Onaylandı') return 'approved';
  if (status === 'Reddedildi') return 'rejected';
  if (status === 'Yeni Talep') return 'pending';
  return 'secondary';
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function filterByDate(rows: ReturnRow[], df: DateFilter): ReturnRow[] {
  if (df === 'all') return rows;
  const now = new Date();
  return rows.filter((r) => {
    const d = new Date(r.created_at);
    if (df === 'today') return d.toDateString() === now.toDateString();
    if (df === '7d') return d >= new Date(now.getTime() - 7 * 86400000);
    if (df === '30d') return d >= new Date(now.getTime() - 30 * 86400000);
    if (df === '90d') return d >= new Date(now.getTime() - 90 * 86400000);
    return true;
  });
}

function sortRows(rows: ReturnRow[], key: SortKey): ReturnRow[] {
  return [...rows].sort((a, b) => {
    if (key === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (key === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (key === 'amount_desc') return Number(b.amount) - Number(a.amount);
    if (key === 'amount_asc') return Number(a.amount) - Number(b.amount);
    return 0;
  });
}

// ─── Request Activity (real data only; no fabricated timeline) ───────────────

function RequestActivity({ row }: { row: ReturnRow }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Talep Aktivitesi</p>
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border overflow-hidden">
        <ActivityRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Oluşturulma" value={formatDateTime(row.created_at)} />
        <ActivityRow
          icon={<Badge variant={statusVariant(row.status)} className="text-[10px]">{row.status}</Badge>}
          label="Güncel Durum"
          value={row.status}
          hideValue
        />
        {row.updated_at && row.updated_at !== row.created_at && (
          <ActivityRow icon={<RefreshCw className="h-3.5 w-3.5" />} label="Son Güncelleme" value={formatDateTime(row.updated_at)} />
        )}
        {row.admin_note && (
          <ActivityRow icon={<MessageSquare className="h-3.5 w-3.5" />} label="Mağaza Notu" value={row.admin_note} multiline />
        )}
      </div>
      {/* When status_history table exists, render entries here sorted by created_at */}
    </div>
  );
}

function ActivityRow({
  icon,
  label,
  value,
  hideValue = false,
  multiline = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  hideValue?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {!hideValue && (
          <p className={cn('text-xs text-foreground font-medium mt-0.5', multiline ? 'whitespace-pre-wrap leading-relaxed' : 'truncate')}>
            {value as string}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Automation activity ──────────────────────────────────────────────────────

function AutomationActivity({ logs, loading }: { logs: AutomationLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Otomasyon</p>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }

  if (logs.length === 0) return null;

  const matched = logs.find((l) => l.matched);

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Otomasyon</p>
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border overflow-hidden">
        {matched ? (
          <div className="flex items-start gap-3 px-3 py-2.5">
            <Zap className="h-3.5 w-3.5 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Eşleşen Kural</p>
              <p className="text-xs font-semibold text-foreground mt-0.5 truncate">{matched.rule_name ?? '—'}</p>
              {matched.action_taken && (
                <p className={cn(
                  'text-[11px] font-medium mt-0.5',
                  matched.action_taken === 'Onaylandı' ? 'text-emerald-600' : 'text-red-500',
                )}>
                  → {matched.action_taken}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(matched.created_at)}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-3 py-2.5">
            <Zap className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Sonuç</p>
              <p className="text-xs text-foreground mt-0.5">
                {logs.length} kural değerlendirildi — hiçbiri eşleşmedi.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function TableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          <td className="px-3 py-3"><Skeleton className="h-4 w-4 rounded" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3.5 w-20" /></td>
          <td className="px-3 py-3"><Skeleton className="h-3.5 w-24" /></td>
          <td className="px-3 py-3 hidden sm:table-cell"><Skeleton className="h-3.5 w-32" /></td>
          <td className="px-3 py-3 hidden md:table-cell"><Skeleton className="h-3.5 w-20" /></td>
          <td className="px-3 py-3 hidden lg:table-cell"><Skeleton className="h-3.5 w-16" /></td>
          <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-md" /></td>
          <td className="px-3 py-3 hidden sm:table-cell"><Skeleton className="h-3.5 w-20" /></td>
        </tr>
      ))}
    </>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function ReturnsManagementPage() {
  const [rows, setRows] = useState<ReturnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & sort
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tümü');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const headerCheckRef = useRef<HTMLInputElement>(null);

  // Drawer
  const [drawerRow, setDrawerRow] = useState<ReturnRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const lastOpenedIdRef = useRef<string | null>(null);

  // Dialogs
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [bulkNoteOpen, setBulkNoteOpen] = useState(false);
  const [bulkNote, setBulkNote] = useState('');
  const [bulkNoteLoading, setBulkNoteLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const { settings, loadSettings } = useStoreSettings();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchRows = useCallback(async (t: string) => {
    setError(null);
    const res = await fetch('/api/returns', { headers: { Authorization: `JWT ${t}` } });
    if (!res.ok) {
      setError('İade talepleri alınamadı. Lütfen tekrar deneyin.');
      setLoading(false);
      return;
    }
    const { data } = await res.json();
    const fresh = (data as ReturnRow[]) || [];
    setRows(fresh);
    setDrawerRow((prev) => (prev ? (fresh.find((r) => r.id === prev.id) ?? null) : null));
    setLoading(false);
  }, []);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    const init = async () => {
      const t = await TokenHelpers.getTokenForIframeApp();
      setToken(t);
      if (t) await fetchRows(t);
      await loadSettings();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync admin note when drawer opens with new request ────────────────────

  useEffect(() => {
    if (!drawerRow) return;
    if (lastOpenedIdRef.current !== drawerRow.id) {
      lastOpenedIdRef.current = drawerRow.id;
      setAdminNote(drawerRow.admin_note ?? '');
    }
  }, [drawerRow]);

  // ── Fetch automation logs when drawer opens a new return ─────────────────

  const drawerRowId = drawerRow?.id ?? null;
  useEffect(() => {
    if (!drawerRowId || !token) { setAutomationLogs([]); return; }
    setLogsLoading(true);
    fetch(`/api/returns/${drawerRowId}/logs`, { headers: { Authorization: `JWT ${token}` } })
      .then((r) => r.json())
      .then(({ data }) => setAutomationLogs(data ?? []))
      .catch(() => setAutomationLogs([]))
      .finally(() => setLogsLoading(false));
  }, [drawerRowId, token]);

  // ── Header checkbox indeterminate state ───────────────────────────────────

  const filtered = useMemo(() => {
    let r = rows;
    if (statusFilter !== 'Tümü') r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          (x.rf_number || '').toLowerCase().includes(q) ||
          (x.order_id || '').toLowerCase().includes(q) ||
          (x.customer_name || '').toLowerCase().includes(q) ||
          (x.customer_email || '').toLowerCase().includes(q),
      );
    }
    r = filterByDate(r, dateFilter);
    return sortRows(r, sortKey);
  }, [rows, statusFilter, search, dateFilter, sortKey]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageIds = useMemo(() => new Set(pageRows.map((r) => r.id)), [pageRows]);
  const allPageSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const somePageSelected = pageRows.some((r) => selected.has(r.id));

  useEffect(() => {
    if (!headerCheckRef.current) return;
    headerCheckRef.current.checked = allPageSelected;
    headerCheckRef.current.indeterminate = !allPageSelected && somePageSelected;
  }, [allPageSelected, somePageSelected]);

  // reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter, sortKey]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () => {
    if (allPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => new Set([...prev, ...pageIds]));
    }
  };

  const openDrawer = (row: ReturnRow) => {
    setDrawerRow(row);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const updateStatus = async (id: string, status: string) => {
    if (!token) return;
    setUpdatingStatus(true);
    const res = await fetch(`/api/returns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    if (!res.ok) { toast('Durum güncellenemedi', 'error'); return; }
    await fetchRows(token);
    toast(status === 'Onaylandı' ? 'Talep onaylandı' : 'Talep reddedildi', 'success');
  };

  const saveNote = async () => {
    if (!drawerRow || !token) return;
    setSavingNote(true);
    const res = await fetch(`/api/returns/${drawerRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ admin_note: adminNote }),
    });
    setSavingNote(false);
    if (!res.ok) { toast('Not kaydedilemedi', 'error'); return; }
    await fetchRows(token);
    toast('Not kaydedildi', 'success');
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!selected.size || !token) return;
    setBulkActionLoading(true);
    const ids = Array.from(selected);
    const res = await fetch('/api/returns/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ ids, status }),
    });
    setBulkActionLoading(false);
    if (!res.ok) { toast('Toplu durum güncellenemedi', 'error'); return; }
    setSelected(new Set());
    await fetchRows(token);
    toast(`${ids.length} talep güncellendi`, 'success');
  };

  const bulkSaveNote = async () => {
    if (!selected.size || !bulkNote.trim() || !token) return;
    setBulkNoteLoading(true);
    const ids = Array.from(selected);
    const res = await fetch('/api/returns/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ ids, admin_note: bulkNote }),
    });
    setBulkNoteLoading(false);
    if (!res.ok) { toast('Toplu not kaydedilemedi', 'error'); return; }
    setBulkNoteOpen(false);
    setBulkNote('');
    setSelected(new Set());
    await fetchRows(token);
    toast(`${ids.length} talebe not eklendi`, 'success');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedCount = selected.size;

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      {/* Main layout with optional drawer */}
      <div className="flex h-full overflow-hidden">
        {/* Content area */}
        <div className={cn('flex-1 overflow-y-auto transition-all duration-300', drawerOpen ? 'lg:mr-[420px]' : '')}>
          <div className="p-6 md:p-8 space-y-5 pb-20">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">İade Yönetimi</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">Tüm iade taleplerini görüntüleyin, filtreleyin ve yönetin.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { if (token) { setLoading(true); fetchRows(token); } }}
                className="shrink-0 gap-2"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Yenile
              </Button>
            </div>

            {/* Search + filters bar */}
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="RF No, Sipariş No, Müşteri, E-posta..."
                    className="pl-8 h-8 text-xs"
                  />
                </div>
                {/* Status pills */}
                <div className="flex flex-wrap gap-1.5 shrink-0">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                        statusFilter === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {/* Advanced toggle */}
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    showAdvanced ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filtrele
                </button>
              </div>

              {/* Advanced filters */}
              {showAdvanced && (
                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">Tarih:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {DATE_OPTIONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDateFilter(d.value)}
                          className={cn(
                            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                            dateFilter === d.value ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium text-muted-foreground">Sırala:</span>
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {SORT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              {/* Result count */}
              {!loading && !error && (
                <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {filtered.length === 0 ? 'Sonuç bulunamadı' : `${filtered.length} talep${selectedCount > 0 ? ` · ${selectedCount} seçili` : ''}`}
                  </p>
                  {selectedCount > 0 && (
                    <p className="text-xs font-medium text-primary">{selectedCount} kayıt seçili</p>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-3 py-3 w-10">
                        <input
                          ref={headerCheckRef}
                          type="checkbox"
                          onChange={toggleAll}
                          aria-label="Tümünü seç"
                          className="rounded"
                          style={{ accentColor: '#6f55ff' }}
                        />
                      </th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">RF No</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Müşteri</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Sipariş</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Sebep</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Tutar</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Durum</th>
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden sm:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <TableSkeletonRows />
                    ) : error ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <FileX className="h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <Button variant="outline" size="sm" onClick={() => { if (token) { setLoading(true); fetchRows(token); } }}>Tekrar Dene</Button>
                          </div>
                        </td>
                      </tr>
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <FileX className="h-8 w-8 text-muted-foreground/40" />
                            <p className="text-sm font-medium text-muted-foreground">
                              {rows.length === 0 ? 'Henüz iade talebi yok.' : 'Filtreyle eşleşen talep bulunamadı.'}
                            </p>
                            {rows.length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setSearch(''); setStatusFilter('Tümü'); setDateFilter('all'); }}
                              >
                                Filtreleri Temizle
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((row) => {
                        const isSelected = selected.has(row.id);
                        const isActive = drawerRow?.id === row.id && drawerOpen;
                        return (
                          <tr
                            key={row.id}
                            onClick={() => openDrawer(row)}
                            className={cn(
                              'border-b border-border cursor-pointer transition-colors hover:bg-muted/40',
                              isActive && 'bg-primary/5',
                              isSelected && 'bg-primary/5',
                            )}
                          >
                            <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleRow(row.id)}
                                aria-label={`Seç: ${row.rf_number}`}
                                style={{ accentColor: '#6f55ff' }}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <span className="font-mono text-xs font-semibold text-foreground">{row.rf_number}</span>
                            </td>
                            <td className="px-3 py-3">
                              <p className="text-xs font-medium text-foreground truncate max-w-[140px]">{row.customer_name}</p>
                              {row.customer_email && (
                                <p className="text-[11px] text-muted-foreground truncate max-w-[140px]">{row.customer_email}</p>
                              )}
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">{row.order_id}</span>
                            </td>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-xs text-muted-foreground truncate max-w-[160px] block">{row.reason}</span>
                            </td>
                            <td className="px-3 py-3 hidden lg:table-cell">
                              <span className="text-xs font-semibold">₺{Number(row.amount).toLocaleString('tr-TR')}</span>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                            </td>
                            <td className="px-3 py-3 hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">{formatDate(row.created_at)}</span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && !error && pageCount > 1 && (
                <div className="flex items-center justify-between border-t border-border px-4 py-3">
                  <p className="text-xs text-muted-foreground">
                    {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} / {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={safePage === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                      aria-label="Önceki sayfa"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors',
                            safePage === p ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      disabled={safePage === pageCount}
                      onClick={() => setPage((p) => p + 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                      aria-label="Sonraki sayfa"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Detail drawer */}
        <div
          className={cn(
            'fixed right-0 top-0 h-full w-full max-w-[420px] bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out overflow-hidden',
            drawerOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          {drawerRow && (
            <>
              {/* Drawer header */}
              <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4 shrink-0">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-muted-foreground">{drawerRow.rf_number}</p>
                  <h2 className="mt-0.5 text-base font-bold truncate">{drawerRow.customer_name}</h2>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant(drawerRow.status)}>{drawerRow.status}</Badge>
                  <button
                    onClick={closeDrawer}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    aria-label="Kapat"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Drawer body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  <InfoCell label="Sipariş No" value={drawerRow.order_id} />
                  <InfoCell label="Tutar" value={`₺${Number(drawerRow.amount).toLocaleString('tr-TR')}`} />
                  <InfoCell label="E-posta" value={drawerRow.customer_email ?? '—'} span />
                  <InfoCell label="İade Sebebi" value={drawerRow.reason} span />
                </div>

                {/* Products */}
                {drawerRow.products && drawerRow.products.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">İade Edilen Ürünler</p>
                    <div className="space-y-1.5">
                      {drawerRow.products.map((item, i) => (
                        <div key={i} className="rounded-lg bg-muted px-3 py-2">
                          <p className="text-xs font-medium">{item.name}</p>
                          <p className="text-[11px] text-muted-foreground">{item.quantity} adet · ₺{item.price}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <InfoCell label="Ürün" value={drawerRow.product} />
                )}

                {/* Description */}
                {drawerRow.description && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Açıklama</p>
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed">{drawerRow.description}</p>
                  </div>
                )}

                {/* Media */}
                {drawerRow.media_urls && drawerRow.media_urls.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Kanıt Dosyaları</p>
                    <div className="grid grid-cols-2 gap-2">
                      {drawerRow.media_urls.map((url, i) => {
                        const isVideo = /\.(mp4|mov|webm)/i.test(url);
                        return isVideo ? (
                          <video key={i} controls className="w-full rounded-lg border border-border">
                            <source src={url} />
                          </video>
                        ) : (
                          <button
                            key={i}
                            onClick={() => setLightboxUrl(url)}
                            className="relative group w-full rounded-lg border border-border overflow-hidden"
                          >
                            <img src={url} alt="Return media" className="w-full object-cover aspect-square" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
                              <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Request activity */}
                <RequestActivity row={drawerRow} />

                {/* Automation activity */}
                <AutomationActivity logs={automationLogs} loading={logsLoading} />

                {/* Admin note */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Mağaza Notu</p>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="Bu talep için not bırak..."
                    className="text-xs"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveNote}
                    disabled={savingNote}
                    className="mt-2 w-full text-xs"
                  >
                    {savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                  </Button>
                </div>

                {/* Status actions */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => updateStatus(drawerRow.id, 'Onaylandı')}
                    disabled={updatingStatus || drawerRow.status === 'Onaylandı'}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Onayla
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => updateStatus(drawerRow.id, 'Reddedildi')}
                    disabled={updatingStatus || drawerRow.status === 'Reddedildi'}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reddet
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer backdrop (mobile) */}
        {drawerOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={closeDrawer}
          />
        )}
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-2xl">
          <span className="text-sm font-semibold text-foreground mr-2">{selectedCount} seçili</span>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => bulkUpdateStatus('Onaylandı')}
            disabled={bulkActionLoading}
          >
            <Check className="h-3.5 w-3.5" />
            Onayla
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
            onClick={() => bulkUpdateStatus('Reddedildi')}
            disabled={bulkActionLoading}
          >
            <X className="h-3.5 w-3.5" />
            Reddet
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => { setBulkNote(''); setBulkNoteOpen(true); }}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Not Ekle
          </Button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-2 flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Seçimi Temizle"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Bulk note dialog */}
      <Dialog.Root open={bulkNoteOpen} onOpenChange={setBulkNoteOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] animate-in fade-in duration-150" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[60] w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <Dialog.Title className="text-base font-bold">Toplu Not Ekle</Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
              {selectedCount} talebe aynı notu ekleyeceksiniz.
            </Dialog.Description>
            <Textarea
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              rows={4}
              placeholder="Not yazın..."
              className="mt-4 text-xs"
            />
            <div className="mt-4 flex gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" className="flex-1">İptal</Button>
              </Dialog.Close>
              <Button className="flex-1" onClick={bulkSaveNote} disabled={bulkNoteLoading || !bulkNote.trim()}>
                {bulkNoteLoading ? 'Kaydediliyor...' : 'Kaydet'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Image lightbox */}
      <Dialog.Root open={!!lightboxUrl} onOpenChange={(open) => { if (!open) setLightboxUrl(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] animate-in fade-in duration-150" />
          <Dialog.Content
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] max-w-3xl w-full max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 outline-none"
            aria-describedby={undefined}
          >
            <Dialog.Title className="sr-only">Resim Önizlemesi</Dialog.Title>
            {lightboxUrl && (
              <img src={lightboxUrl} alt="Kanıt" className="w-full h-full max-h-[90vh] object-contain rounded-xl" />
            )}
            <Dialog.Close asChild>
              <button className="absolute -top-3 -right-3 flex h-8 w-8 items-center justify-center rounded-full bg-card border border-border shadow-lg text-muted-foreground hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DashboardShell>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function InfoCell({ label, value, span = false }: { label: string; value: string; span?: boolean }) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xs font-medium text-foreground truncate">{value}</p>
    </div>
  );
}
