'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/hooks/use-auth';
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
  ArrowLeftRight,
  ArrowUpDown,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileX,
  Filter,
  MessageSquare,
  Package,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  X,
  Zap,
  ZoomIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ExportModal } from '@/components/returns/export-modal';
import { PageHelp } from '@/components/ui/page-help';

// ─── Types ──────────────────────────────────────────────────────────────────

type ExchangeType = 'same_product_size' | 'same_product_color' | 'different_product';

const EXCHANGE_TYPE_LABELS: Record<ExchangeType, string> = {
  same_product_size: 'Aynı ürün, farklı beden',
  same_product_color: 'Aynı ürün, farklı renk',
  different_product: 'Farklı ürün',
};

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
  request_type: 'return' | 'exchange';
  exchange_type: ExchangeType | null;
  exchange_variant: string | null;
  exchange_price_diff: number | null;
};

type AutomationLog = {
  id: string;
  rule_name: string | null;
  matched: boolean;
  action_taken: string | null;
  created_at: string;
};

type ReturnNote = {
  id: string;
  author: string;
  message: string;
  created_at: string;
};

type ReturnAuditLog = {
  id: string;
  user_label: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
type DateFilter = 'all' | 'today' | '7d' | '30d' | '90d';
type TypeTab = 'return' | 'exchange';

const PAGE_SIZE = 20;

const RETURN_STATUS_OPTIONS = ['Tümü', 'Yeni Talep', 'İncelemede', 'Onaylandı', 'Kargo Bekleniyor', 'Kargo Alındı', 'İade Edildi', 'Tamamlandı', 'Reddedildi'] as const;
const EXCHANGE_STATUS_OPTIONS = ['Tümü', 'Yeni Talep', 'İncelemede', 'Onaylandı', 'Kargo Bekleniyor', 'Kargo Alındı', 'Kargoya Verildi', 'Tamamlandı', 'Reddedildi'] as const;

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

function statusVariant(status: string): 'pending' | 'approved' | 'rejected' | 'secondary' | 'shipped' {
  if (status === 'Onaylandı' || status === 'Tamamlandı' || status === 'İade Edildi') return 'approved';
  if (status === 'Reddedildi') return 'rejected';
  if (status === 'Yeni Talep' || status === 'İncelemede') return 'pending';
  if (status === 'Kargoya Verildi' || status === 'Kargo Bekleniyor' || status === 'Kargo Alındı') return 'shipped';
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

// ─── Request Activity + Internal Notes ───────────────────────────────────────

function RequestActivity({
  row,
  notes,
  notesLoading,
  noteInput,
  submittingNote,
  onNoteInputChange,
  onAddNote,
  onDeleteNote,
}: {
  row: ReturnRow;
  notes: ReturnNote[];
  notesLoading: boolean;
  noteInput: string;
  submittingNote: boolean;
  onNoteInputChange: (v: string) => void;
  onAddNote: () => void;
  onDeleteNote: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktivite & Dahili Notlar</p>
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border overflow-hidden">
        <ActivityRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Oluşturulma" value={formatDateTime(row.created_at)} />
        {notesLoading && (
          <div className="px-3 py-3">
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}
        {notes.map((note) => (
          <NoteRow key={note.id} note={note} onDelete={onDeleteNote} />
        ))}
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
      <div className="flex gap-2">
        <textarea
          value={noteInput}
          onChange={(e) => onNoteInputChange(e.target.value)}
          placeholder="Dahili not ekle... (Ctrl+Enter)"
          rows={2}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onAddNote(); }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={onAddNote}
          disabled={submittingNote || !noteInput.trim()}
          className="h-auto px-3 self-stretch"
          aria-label="Not ekle"
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
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

function NoteRow({ note, onDelete }: { note: ReturnNote; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-start gap-3 px-3 py-2.5 group">
      <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-primary/70 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {note.author}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <p className="text-[10px] text-muted-foreground">{formatDateTime(note.created_at)}</p>
            <button
              onClick={() => onDelete(note.id)}
              className="opacity-0 group-hover:opacity-100 flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-red-600 transition-all"
              aria-label="Notu sil"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
        <p className="text-xs text-foreground mt-0.5 leading-relaxed whitespace-pre-wrap break-words">
          {note.message}
        </p>
      </div>
    </div>
  );
}

// ─── Audit timeline ──────────────────────────────────────────────────────────

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'return.created': 'İade oluşturuldu',
  'return.approved': 'İade onaylandı',
  'return.rejected': 'İade reddedildi',
  'return.shipment_awaited': 'Kargo bekleniyor',
  'return.shipment_received': 'Kargo alındı',
  'return.refunded': 'İade işlendi',
  'return.completed': 'İade tamamlandı',
  'exchange.created': 'Değişim oluşturuldu',
  'exchange.approved': 'Değişim onaylandı',
  'exchange.shipment_awaited': 'Kargo bekleniyor',
  'exchange.shipment_received': 'Kargo alındı',
  'exchange.completed': 'Değişim tamamlandı',
};

function AuditTimeline({ logs, loading }: { logs: ReturnAuditLog[]; loading: boolean }) {
  if (loading) {
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Denetim Geçmişi</p>
        <Skeleton className="h-14 w-full rounded-xl" />
      </div>
    );
  }
  if (logs.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Denetim Geçmişi</p>
      <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border overflow-hidden">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 px-3 py-2.5">
            <ClipboardList className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">
                  {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDateTime(log.created_at)}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">{log.user_label}</p>
            </div>
          </div>
        ))}
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

  // Type tab (returns vs exchanges)
  const [typeTab, setTypeTab] = useState<TypeTab>('return');

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

  // Exchange-specific drawer state
  const [exchangePriceDiff, setExchangePriceDiff] = useState('');
  const [savingPriceDiff, setSavingPriceDiff] = useState(false);

  // Export
  const [exportOpen, setExportOpen] = useState(false);


  const { authHeader: token, can } = useAuth();
  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [notes, setNotes] = useState<ReturnNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [auditLogs, setAuditLogs] = useState<ReturnAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const { settings, loadSettings } = useStoreSettings();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchRows = useCallback(async (t: string) => {
    setError(null);
    const res = await fetch('/api/returns', { headers: { Authorization: t } });
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
    if (token) {
      fetchRows(token).catch(() => null);
      loadSettings(token).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Sync admin note + exchange price diff when drawer opens ──────────────

  useEffect(() => {
    if (!drawerRow) return;
    if (lastOpenedIdRef.current !== drawerRow.id) {
      lastOpenedIdRef.current = drawerRow.id;
      setAdminNote(drawerRow.admin_note ?? '');
      setExchangePriceDiff(drawerRow.exchange_price_diff !== null ? String(drawerRow.exchange_price_diff) : '');
      setNoteInput('');
    }
  }, [drawerRow]);

  // ── Fetch automation logs when drawer opens a new return ─────────────────

  const drawerRowId = drawerRow?.id ?? null;
  useEffect(() => {
    if (!drawerRowId || !token) {
      setAutomationLogs([]);
      setNotes([]);
      setAuditLogs([]);
      return;
    }
    setLogsLoading(true);
    setNotesLoading(true);
    setAuditLoading(true);
    fetch(`/api/returns/${drawerRowId}/logs`, { headers: { Authorization: token ?? '' } })
      .then((r) => r.json())
      .then(({ data }) => setAutomationLogs(data ?? []))
      .catch(() => setAutomationLogs([]))
      .finally(() => setLogsLoading(false));
    fetch(`/api/returns/${drawerRowId}/notes`, { headers: { Authorization: token ?? '' } })
      .then((r) => r.json())
      .then(({ data }) => setNotes(data ?? []))
      .catch(() => setNotes([]))
      .finally(() => setNotesLoading(false));
    fetch(`/api/returns/${drawerRowId}/audit`, { headers: { Authorization: token ?? '' } })
      .then((r) => r.json())
      .then(({ data }) => setAuditLogs(data ?? []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, [drawerRowId, token]);

  // ── Header checkbox indeterminate state ───────────────────────────────────

  const filtered = useMemo(() => {
    let r = rows.filter((x) => (x.request_type ?? 'return') === typeTab);
    if (statusFilter !== 'Tümü') r = r.filter((x) => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(
        (x) =>
          (x.rf_number || '').toLowerCase().includes(q) ||
          (x.order_id || '').toLowerCase().includes(q) ||
          (x.customer_name || '').toLowerCase().includes(q) ||
          (x.customer_email || '').toLowerCase().includes(q) ||
          (x.exchange_variant || '').toLowerCase().includes(q),
      );
    }
    r = filterByDate(r, dateFilter);
    return sortRows(r, sortKey);
  }, [rows, typeTab, statusFilter, search, dateFilter, sortKey]);

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

  // reset page when filters or tab change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, dateFilter, sortKey, typeTab]);

  // reset status filter when tab changes
  useEffect(() => {
    setStatusFilter('Tümü');
  }, [typeTab]);

  // Force tab to match operation_mode when settings load
  useEffect(() => {
    const mode = settings?.operation_mode;
    if (mode === 'return_only') setTypeTab('return');
    else if (mode === 'exchange_only') setTypeTab('exchange');
  }, [settings?.operation_mode]);

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
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    if (!res.ok) { toast('Durum güncellenemedi', 'error'); return; }

    // Note: the customer notification email is sent server-side by the PATCH
    // handler above (src/app/api/returns/[id]/route.ts) for every status in
    // emailTemplateMap — do not also send it from here, or the customer gets
    // the same email twice.

    await fetchRows(token);
    const label = status === 'Onaylandı' ? 'Talep onaylandı'
      : status === 'Reddedildi' ? 'Talep reddedildi'
      : status === 'Tamamlandı' ? 'Tamamlandı olarak işaretlendi'
      : status === 'Kargo Bekleniyor' ? 'Durum güncellendi: Kargo bekleniyor'
      : status === 'Kargo Alındı' ? 'Kargo teslim alındı olarak işaretlendi'
      : status === 'İade Edildi' ? 'İade işlendi olarak işaretlendi'
      : status === 'İncelemede' ? 'Talep incelemeye alındı'
      : 'Durum güncellendi';
    toast(label, 'success');
  };

  const saveNote = async () => {
    if (!drawerRow || !token) return;
    setSavingNote(true);
    const res = await fetch(`/api/returns/${drawerRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ admin_note: adminNote }),
    });
    setSavingNote(false);
    if (!res.ok) { toast('Not kaydedilemedi', 'error'); return; }
    await fetchRows(token);
    toast('Not kaydedildi', 'success');
  };

  const savePriceDiff = async () => {
    if (!drawerRow || !token) return;
    setSavingPriceDiff(true);
    const val = exchangePriceDiff.trim() === '' ? null : Number(exchangePriceDiff);
    const res = await fetch(`/api/returns/${drawerRow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ exchange_price_diff: val }),
    });
    setSavingPriceDiff(false);
    if (!res.ok) { toast('Fiyat farkı kaydedilemedi', 'error'); return; }
    await fetchRows(token);
    toast('Fiyat farkı kaydedildi', 'success');
  };

  const addNote = async () => {
    if (!noteInput.trim() || !token || !drawerRow) return;
    setSubmittingNote(true);
    const res = await fetch(`/api/returns/${drawerRow.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ author: 'Yönetici', message: noteInput.trim() }),
    });
    if (res.ok) {
      const { data } = await res.json();
      setNotes((prev) => [...prev, data as ReturnNote]);
      setNoteInput('');
    } else {
      toast('Not eklenemedi', 'error');
    }
    setSubmittingNote(false);
  };

  const deleteNote = async (noteId: string) => {
    if (!token || !drawerRow) return;
    const res = await fetch(`/api/returns/${drawerRow.id}/notes/${noteId}`, {
      method: 'DELETE',
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } else {
      toast('Not silinemedi', 'error');
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (!selected.size || !token) return;
    setBulkActionLoading(true);
    const ids = Array.from(selected);
    const res = await fetch('/api/returns/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
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
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
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
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">İade & Değişim Yönetimi</h1>
                  <PageHelp title="İade Yönetimi" content={<p>Tüm talepleri filtreleyin, arayın, sıralayın. Talebi tıklayın → sağ panelde detaylar açılır → durum güncelleyin, not ekleyin. CSV dışa aktarımı için sağ üstteki Dışa Aktar butonunu kullanın.</p>} />
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">Tüm iade ve değişim taleplerini görüntüleyin, filtreleyin ve yönetin.</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExportOpen(true)}
                  className="gap-2"
                >
                  <Download className="h-3.5 w-3.5" />
                  Dışa Aktar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { if (token) { setLoading(true); fetchRows(token); } }}
                  className="gap-2"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Yenile
                </Button>
              </div>
            </div>

            {/* Type tab — hidden when mode forces single type */}
            {settings?.operation_mode !== 'return_only' && settings?.operation_mode !== 'exchange_only' && (
              <div className="flex rounded-xl border border-border overflow-hidden text-sm font-semibold w-fit">
                <button
                  onClick={() => setTypeTab('return')}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 transition-colors',
                    typeTab === 'return' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  İadeler
                  <span className={cn('text-xs rounded-md px-1.5 py-0.5', typeTab === 'return' ? 'bg-white/20 text-background' : 'bg-muted text-muted-foreground')}>
                    {rows.filter((r) => (r.request_type ?? 'return') === 'return').length}
                  </span>
                </button>
                <button
                  onClick={() => setTypeTab('exchange')}
                  className={cn(
                    'flex items-center gap-2 px-5 py-2.5 transition-colors',
                    typeTab === 'exchange' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                  Değişimler
                  <span className={cn('text-xs rounded-md px-1.5 py-0.5', typeTab === 'exchange' ? 'bg-white/20 text-background' : 'bg-muted text-muted-foreground')}>
                    {rows.filter((r) => r.request_type === 'exchange').length}
                  </span>
                </button>
              </div>
            )}

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
                  {(typeTab === 'exchange' ? EXCHANGE_STATUS_OPTIONS : RETURN_STATUS_OPTIONS).map((s) => (
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
                      <th className="px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">{typeTab === 'exchange' ? 'Değişim Türü' : 'Sebep'}</th>
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
                              <span className="text-xs text-muted-foreground truncate max-w-[160px] block">
                                {row.request_type === 'exchange'
                                  ? (EXCHANGE_TYPE_LABELS[row.exchange_type as ExchangeType] ?? '—')
                                  : row.reason}
                              </span>
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
                  {drawerRow.request_type !== 'exchange' && (
                    <InfoCell label="İade Sebebi" value={drawerRow.reason} span />
                  )}
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

                {/* Exchange info */}
                {drawerRow.request_type === 'exchange' && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Değişim Bilgileri</p>
                    <div className="rounded-xl border border-border bg-muted/40 divide-y divide-border overflow-hidden mb-3">
                      <div className="flex items-start gap-3 px-3 py-2.5">
                        <ArrowLeftRight className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Değişim Türü</p>
                          <p className="text-xs font-medium text-foreground mt-0.5">
                            {EXCHANGE_TYPE_LABELS[drawerRow.exchange_type as ExchangeType] ?? '—'}
                          </p>
                        </div>
                      </div>
                      {drawerRow.exchange_variant && (
                        <div className="flex items-start gap-3 px-3 py-2.5">
                          <Package className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              {drawerRow.exchange_type === 'same_product_size' ? 'İstenen Beden'
                                : drawerRow.exchange_type === 'same_product_color' ? 'İstenen Renk'
                                : 'İstenen Ürün'}
                            </p>
                            <p className="text-xs font-semibold text-foreground mt-0.5">{drawerRow.exchange_variant}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Price difference */}
                    <div>
                      <label className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
                        Fiyat Farkı (₺)
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={exchangePriceDiff}
                          onChange={(e) => setExchangePriceDiff(e.target.value)}
                          placeholder="0"
                          className="text-xs h-8 flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={savePriceDiff}
                          disabled={savingPriceDiff}
                          className="h-8 text-xs px-3 shrink-0"
                        >
                          {savingPriceDiff ? '...' : 'Kaydet'}
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        + müşteri ödeme yapar · − mağaza iade eder
                      </p>
                    </div>
                  </div>
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
                        const isVideo = /\.(mp4|mov|webm)(\?|$)/i.test(url);
                        const videoType = /\.webm(\?|$)/i.test(url) ? 'video/webm' : /\.mov(\?|$)/i.test(url) ? 'video/quicktime' : 'video/mp4';
                        return isVideo ? (
                          <video key={i} controls className="w-full rounded-lg border border-border">
                            <source src={url} type={videoType} />
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

                {/* Request activity + internal notes */}
                <RequestActivity
                  row={drawerRow}
                  notes={notes}
                  notesLoading={notesLoading}
                  noteInput={noteInput}
                  submittingNote={submittingNote}
                  onNoteInputChange={setNoteInput}
                  onAddNote={addNote}
                  onDeleteNote={deleteNote}
                />

                {/* Audit timeline */}
                <AuditTimeline logs={auditLogs} loading={auditLoading} />

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

                {/* Status actions — full lifecycle */}
                {(can('returns.approve') || can('returns.reject') || can('returns.complete')) && (
                <div className="space-y-2 pt-3 border-t border-border">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Durum Güncelle</p>

                  {/* Review stage */}
                  {can('returns.approve') && drawerRow.status === 'Yeni Talep' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-amber-200 text-amber-600 hover:bg-amber-50"
                      onClick={() => updateStatus(drawerRow.id, 'İncelemede')}
                      disabled={updatingStatus}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      İncelemeye Al
                    </Button>
                  )}

                  {/* Approve */}
                  {can('returns.approve') && !['Onaylandı', 'Kargo Bekleniyor', 'Kargo Alındı', 'İade Edildi', 'Kargoya Verildi', 'Tamamlandı'].includes(drawerRow.status) && (
                  <Button
                    size="sm"
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => updateStatus(drawerRow.id, 'Onaylandı')}
                    disabled={updatingStatus}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Onayla
                  </Button>
                  )}

                  {/* Post-approval lifecycle */}
                  {can('returns.complete') && drawerRow.status === 'Onaylandı' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={() => updateStatus(drawerRow.id, 'Kargo Bekleniyor')}
                      disabled={updatingStatus}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Kargo Bekleniyor
                    </Button>
                  )}

                  {can('returns.complete') && drawerRow.status === 'Kargo Bekleniyor' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={() => updateStatus(drawerRow.id, 'Kargo Alındı')}
                      disabled={updatingStatus}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Kargo Alındı
                    </Button>
                  )}

                  {/* Return-only: refund step */}
                  {can('returns.complete') && drawerRow.request_type !== 'exchange' && drawerRow.status === 'Kargo Alındı' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-violet-200 text-violet-600 hover:bg-violet-50"
                      onClick={() => updateStatus(drawerRow.id, 'İade Edildi')}
                      disabled={updatingStatus}
                    >
                      <Check className="h-3.5 w-3.5" />
                      İade İşlendi
                    </Button>
                  )}

                  {/* Exchange-only: dispatch replacement */}
                  {can('returns.complete') && drawerRow.request_type === 'exchange' && drawerRow.status === 'Kargo Alındı' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                      onClick={() => updateStatus(drawerRow.id, 'Kargoya Verildi')}
                      disabled={updatingStatus}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Yeni Ürün Kargoya Verildi
                    </Button>
                  )}

                  {/* Complete */}
                  {can('returns.complete') && (drawerRow.status === 'İade Edildi' || drawerRow.status === 'Kargoya Verildi') && (
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => updateStatus(drawerRow.id, 'Tamamlandı')}
                      disabled={updatingStatus}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Tamamlandı olarak kapat
                    </Button>
                  )}

                  {/* Reject — always available unless already done */}
                  {can('returns.reject') && !['Tamamlandı', 'Reddedildi'].includes(drawerRow.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => updateStatus(drawerRow.id, 'Reddedildi')}
                    disabled={updatingStatus}
                  >
                    <X className="h-3.5 w-3.5" />
                    Reddet
                  </Button>
                  )}
                </div>
                )}
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
          {can('returns.approve') && (
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => bulkUpdateStatus('Onaylandı')}
            disabled={bulkActionLoading}
          >
            <Check className="h-3.5 w-3.5" />
            Onayla
          </Button>
          )}
          {can('returns.reject') && (
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
          )}
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

      {/* Export modal */}
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} token={token ?? ''} />

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
