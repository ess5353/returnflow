'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { EXPORT_COLUMNS, DEFAULT_COLUMNS, formatRow, type ExportFormat, type ExportFilters, type ExportJob } from '@/lib/export/columns';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Square,
  X,
} from 'lucide-react';

// ── Status options ────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['', 'Yeni Talep', 'İncelemede', 'Onaylandı', 'Reddedildi', 'Tamamlandı', 'Kargoya Verildi'];
const TYPE_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'return', label: 'İade' },
  { value: 'exchange', label: 'Değişim' },
];
const AUTOMATION_OPTIONS = [
  { value: '', label: 'Tümü' },
  { value: 'automated', label: 'Otomatik İşlendi' },
  { value: 'manual', label: 'Manuel' },
];

// ── Format icons/labels ───────────────────────────────────────────────────────

const FORMAT_DEFS: { value: ExportFormat; label: string; icon: React.ReactNode; mime: string; ext: string }[] = [
  { value: 'xlsx', label: 'Excel', icon: <FileSpreadsheet className="h-4 w-4" />, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  { value: 'csv', label: 'CSV', icon: <FileText className="h-4 w-4" />, mime: 'text/csv;charset=utf-8', ext: 'csv' },
  { value: 'pdf', label: 'PDF', icon: <FileText className="h-4 w-4 text-red-500" />, mime: 'application/pdf', ext: 'pdf' },
];

// ── Client-side file generators ───────────────────────────────────────────────

async function generateXlsx(rows: Record<string, string>[]): Promise<Blob> {
  const { utils, write } = await import('xlsx');
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Talepler');
  const buf = write(wb, { type: 'array', bookType: 'xlsx' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function generateCsv(rows: Record<string, string>[]): Blob {
  if (rows.length === 0) return new Blob(['﻿'], { type: 'text/csv;charset=utf-8' });
  const headers = Object.keys(rows[0]);
  const escape = (v: string) => (v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h] ?? '')).join(','))];
  return new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
}

async function generatePdf(rows: Record<string, string>[], fileName: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  await import('jspdf-autotable'); // side-effect: patches jsPDF.prototype with .autoTable()

  const isLandscape = Object.keys(rows[0] ?? {}).length > 5;
  const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

  const headers = Object.keys(rows[0] ?? {});
  const body = rows.map((r) => headers.map((h) => r[h] ?? ''));

  doc.setFontSize(10);
  doc.text(fileName, 14, 12);

  // jspdf-autotable patches doc via prototype — TypeScript doesn't know about it
  (doc as unknown as Record<string, (opts: unknown) => void>).autoTable({
    head: [headers],
    body,
    startY: 18,
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [249, 250, 251] },
  });

  return new Blob([doc.output('arraybuffer')], { type: 'application/pdf' });
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Progress hook ─────────────────────────────────────────────────────────────

function useAnimatedProgress() {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    setProgress(0);
    let p = 0;
    timerRef.current = setInterval(() => {
      p = p < 40 ? p + 8 : p < 75 ? p + 2 : p < 90 ? p + 0.4 : p;
      setProgress(Math.min(p, 90));
    }, 120);
  }, []);

  const finish = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 1200);
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setProgress(0);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { progress, start, finish, reset };
}

// ── Main component ────────────────────────────────────────────────────────────

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  token: string;
}

export function ExportModal({ open, onClose, token }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [filters, setFilters] = useState<ExportFilters>({});
  const [columns, setColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [generating, setGenerating] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [history, setHistory] = useState<ExportJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { progress, start, finish, reset } = useAnimatedProgress();

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    const res = await fetch('/api/exports', { headers: { Authorization: `JWT ${token}` } });
    if (res.ok) {
      const { data } = await res.json();
      setHistory(data ?? []);
    }
    setHistoryLoading(false);
  }, [token]);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  const toggleColumn = (key: string) => {
    setColumns((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const setFilter = <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const buildFileName = () => {
    const d = new Date().toISOString().slice(0, 10);
    return `iade-talepleri-${d}`;
  };

  const runExport = async (overrideFilters?: ExportFilters, overrideCols?: string[], overrideFormat?: ExportFormat) => {
    if (!token) return;
    const activeFilters = overrideFilters ?? filters;
    const activeCols = overrideCols ?? columns;
    const activeFormat = overrideFormat ?? format;

    if (activeCols.length === 0) { toast('En az bir sütun seçin', 'error'); return; }

    setGenerating(true);
    start();

    try {
      // Build query params
      const params = new URLSearchParams();
      if (activeFilters.dateFrom) params.set('dateFrom', activeFilters.dateFrom);
      if (activeFilters.dateTo) params.set('dateTo', activeFilters.dateTo);
      if (activeFilters.status) params.set('status', activeFilters.status);
      if (activeFilters.requestType) params.set('requestType', activeFilters.requestType);
      if (activeFilters.automation) params.set('automation', activeFilters.automation);
      if (activeFilters.customer) params.set('customer', activeFilters.customer);
      if (activeFilters.product) params.set('product', activeFilters.product);

      const res = await fetch(`/api/exports/data?${params.toString()}`, {
        headers: { Authorization: `JWT ${token}` },
      });

      if (!res.ok) { toast('Veri alınamadı', 'error'); reset(); setGenerating(false); return; }

      const { data: rawRows } = await res.json();
      const formattedRows = (rawRows as Record<string, unknown>[]).map((r) => formatRow(r, activeCols));
      const fileName = buildFileName();

      let blob: Blob;
      if (activeFormat === 'xlsx') blob = await generateXlsx(formattedRows);
      else if (activeFormat === 'csv') blob = generateCsv(formattedRows);
      else blob = await generatePdf(formattedRows, fileName);

      finish();
      triggerDownload(blob, `${fileName}.${activeFormat}`);

      // Save metadata (fire-and-forget)
      fetch('/api/exports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
        body: JSON.stringify({
          format: activeFormat,
          filters: activeFilters,
          columns: activeCols,
          row_count: formattedRows.length,
          file_name: `${fileName}.${activeFormat}`,
        }),
      }).then(() => loadHistory()).catch(() => {});

      toast(`${formattedRows.length} satır dışa aktarıldı`, 'success');
    } catch (err) {
      console.error('Export error:', err);
      toast('Dışa aktarma başarısız', 'error');
      reset();
    } finally {
      setGenerating(false);
    }
  };

  const reDownload = (job: ExportJob) => {
    runExport(job.filters, job.columns, job.format as ExportFormat);
  };

  const formatLabel = (f: ExportFormat) => FORMAT_DEFS.find((d) => d.value === f)?.label ?? f.toUpperCase();
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl max-h-[90vh] flex flex-col bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <Download className="h-4.5 w-4.5 text-primary" />
              <Dialog.Title className="font-semibold text-base">Dışa Aktar</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Body (scrollable) */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Format picker */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Format</p>
              <div className="flex gap-2">
                {FORMAT_DEFS.map((f) => (
                  <button
                    key={f.value}
                    onClick={() => setFormat(f.value)}
                    className={cn(
                      'flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors flex-1 justify-center',
                      format === f.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {f.icon}
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2"
              >
                Filtreler
                {showFilters ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showFilters && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Başlangıç</label>
                    <Input type="date" value={filters.dateFrom ?? ''} onChange={(e) => setFilter('dateFrom', e.target.value)} className="text-xs h-8" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Bitiş</label>
                    <Input type="date" value={filters.dateTo ?? ''} onChange={(e) => setFilter('dateTo', e.target.value)} className="text-xs h-8" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Durum</label>
                    <select
                      value={filters.status ?? ''}
                      onChange={(e) => setFilter('status', e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Tümü</option>
                      {STATUS_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Talep Türü</label>
                    <select
                      value={filters.requestType ?? ''}
                      onChange={(e) => setFilter('requestType', e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Otomasyon</label>
                    <select
                      value={filters.automation ?? ''}
                      onChange={(e) => setFilter('automation', e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {AUTOMATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Müşteri</label>
                    <Input placeholder="Müşteri adı..." value={filters.customer ?? ''} onChange={(e) => setFilter('customer', e.target.value)} className="text-xs h-8" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide block mb-1">Ürün</label>
                    <Input placeholder="Ürün adı..." value={filters.product ?? ''} onChange={(e) => setFilter('product', e.target.value)} className="text-xs h-8" />
                  </div>
                </div>
              )}
            </div>

            {/* Column selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sütunlar</p>
                <div className="flex gap-2">
                  <button onClick={() => setColumns(EXPORT_COLUMNS.map((c) => c.key))} className="text-[10px] text-primary hover:underline">Tümünü Seç</button>
                  <span className="text-muted-foreground text-[10px]">·</span>
                  <button onClick={() => setColumns([])} className="text-[10px] text-muted-foreground hover:underline">Temizle</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {EXPORT_COLUMNS.map((col) => {
                  const on = columns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs text-left transition-colors',
                        on ? 'border-primary/40 bg-primary/5 text-foreground font-medium' : 'border-border text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {on ? <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" /> : <Square className="h-3.5 w-3.5 shrink-0" />}
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progress bar */}
            {progress > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{progress < 100 ? 'Hazırlanıyor...' : 'Tamamlandı!'}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-300', progress === 100 ? 'bg-emerald-500' : 'bg-primary')}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Export history */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geçmiş Dışa Aktarmalar</p>
                </div>
                <div className="rounded-xl border border-border overflow-hidden divide-y divide-border">
                  {historyLoading ? (
                    <div className="px-4 py-3 text-xs text-muted-foreground">Yükleniyor...</div>
                  ) : (
                    history.map((job) => (
                      <div key={job.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold uppercase text-foreground">{formatLabel(job.format as ExportFormat)}</span>
                            <span className="text-[10px] text-muted-foreground">{job.row_count} satır</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(job.created_at)}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reDownload(job)}
                          disabled={generating}
                          className="shrink-0 h-7 text-xs gap-1.5 px-2.5"
                        >
                          <Download className="h-3 w-3" />
                          İndir
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {columns.length} sütun seçili · {FORMAT_DEFS.find((f) => f.value === format)?.label}
            </p>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" size="sm">İptal</Button>
              </Dialog.Close>
              <Button size="sm" onClick={() => runExport()} disabled={generating || columns.length === 0} className="gap-2 min-w-[120px]">
                {generating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" />Hazırlanıyor...</>
                ) : (
                  <><Download className="h-3.5 w-3.5" />Dışa Aktar</>
                )}
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
