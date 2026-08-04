'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';
import { Skeleton } from '@/components/ui/skeleton';

type AuditAction =
  | 'return.created' | 'return.approved' | 'return.rejected' | 'return.completed'
  | 'exchange.created' | 'exchange.approved' | 'exchange.completed'
  | 'automation_rule.created' | 'automation_rule.updated' | 'automation_rule.deleted'
  | 'webhook.created' | 'webhook.updated' | 'webhook.deleted'
  | 'api_key.created' | 'api_key.revoked'
  | 'email_template.updated' | 'settings.updated' | 'notification.read' | 'export.generated';

interface AuditLog {
  id: string;
  user_label: string;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  has_more: boolean;
}

const ACTION_LABELS: Record<string, string> = {
  'return.created': 'İade Oluşturuldu',
  'return.approved': 'İade Onaylandı',
  'return.rejected': 'İade Reddedildi',
  'return.completed': 'İade Tamamlandı',
  'exchange.created': 'Değişim Oluşturuldu',
  'exchange.approved': 'Değişim Onaylandı',
  'exchange.completed': 'Değişim Tamamlandı',
  'automation_rule.created': 'Kural Oluşturuldu',
  'automation_rule.updated': 'Kural Güncellendi',
  'automation_rule.deleted': 'Kural Silindi',
  'webhook.created': 'Webhook Oluşturuldu',
  'webhook.updated': 'Webhook Güncellendi',
  'webhook.deleted': 'Webhook Silindi',
  'api_key.created': 'API Anahtarı Oluşturuldu',
  'api_key.revoked': 'API Anahtarı İptal Edildi',
  'email_template.updated': 'E-posta Şablonu Güncellendi',
  'settings.updated': 'Ayarlar Güncellendi',
  'notification.read': 'Bildirim Okundu',
  'export.generated': 'Dışa Aktarma Oluşturuldu',
};

const ENTITY_TYPES = ['return', 'exchange', 'automation_rule', 'webhook', 'api_key', 'email_template', 'settings', 'notification', 'export'];
const ENTITY_LABELS: Record<string, string> = {
  return: 'İade', exchange: 'Değişim', automation_rule: 'Kural', webhook: 'Webhook',
  api_key: 'API Anahtarı', email_template: 'E-posta Şablonu', settings: 'Ayarlar',
  notification: 'Bildirim', export: 'Dışa Aktarma',
};

const ACTION_COLORS: Record<string, string> = {
  'return.created': 'bg-blue-100 text-blue-800',
  'return.approved': 'bg-green-100 text-green-800',
  'return.rejected': 'bg-red-100 text-red-800',
  'return.completed': 'bg-emerald-100 text-emerald-800',
  'exchange.created': 'bg-purple-100 text-purple-800',
  'exchange.approved': 'bg-green-100 text-green-800',
  'exchange.completed': 'bg-emerald-100 text-emerald-800',
  'automation_rule.created': 'bg-yellow-100 text-yellow-800',
  'automation_rule.updated': 'bg-yellow-100 text-yellow-800',
  'automation_rule.deleted': 'bg-red-100 text-red-800',
  'webhook.created': 'bg-indigo-100 text-indigo-800',
  'webhook.updated': 'bg-indigo-100 text-indigo-800',
  'webhook.deleted': 'bg-red-100 text-red-800',
  'api_key.created': 'bg-cyan-100 text-cyan-800',
  'api_key.revoked': 'bg-red-100 text-red-800',
  'email_template.updated': 'bg-orange-100 text-orange-800',
  'settings.updated': 'bg-gray-100 text-gray-800',
  'notification.read': 'bg-gray-100 text-gray-700',
  'export.generated': 'bg-teal-100 text-teal-800',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function MetadataViewer({ metadata }: { metadata: Record<string, unknown> | null }) {
  if (!metadata) return <span className="text-muted-foreground text-xs italic">—</span>;
  return (
    <pre className="mt-2 rounded-md bg-muted p-3 text-xs text-foreground overflow-auto max-h-48 whitespace-pre-wrap">
      {JSON.stringify(metadata, null, 2)}
    </pre>
  );
}

function AuditRow({ log }: { log: AuditLog }) {
  const [expanded, setExpanded] = useState(false);
  const colorClass = ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700';

  return (
    <>
      <tr
        className="hover:bg-muted/40 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.created_at)}</td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
            {ACTION_LABELS[log.action] ?? log.action}
          </span>
        </td>
        <td className="px-4 py-3 text-sm text-foreground">{log.user_label}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{ENTITY_LABELS[log.entity_type] ?? log.entity_type}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono truncate max-w-[160px] hidden lg:table-cell">{log.entity_id ?? '—'}</td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell">{log.ip_address ?? '—'}</td>
        <td className="px-4 py-3 text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-6 pb-4 pt-0">
            <MetadataViewer metadata={log.metadata} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function AuditLogsPage() {
  const { authHeader: token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchLogs = useCallback(async (t: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '50' });
    if (search) params.set('search', search);
    if (action) params.set('action', action);
    if (entityType) params.set('entity_type', entityType);
    if (dateFrom) params.set('date_from', dateFrom);
    if (dateTo) params.set('date_to', dateTo);

    const res = await fetch(`/api/audit-logs?${params.toString()}`, {
      headers: { Authorization: t },
    });
    if (res.ok) {
      const json = await res.json();
      setLogs(json.data ?? []);
      setPagination(json.pagination ?? null);
    }
    setLoading(false);
  }, [page, search, action, entityType, dateFrom, dateTo]);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => { if (token) fetchLogs(token); }, [token, fetchLogs]);

  function handleSearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function handleReset() {
    setSearch('');
    setSearchInput('');
    setAction('');
    setEntityType('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Denetim Günlüğü</h1>
          <PageHelp title="Denetim Günlüğü" content={<p>Sistemdeki tüm önemli işlemlerin zaman damgalı kaydı. Kim hangi talebi onayladı, hangi ayarı değiştirdi — değiştirilemez log. İşlem türüne göre filtreleyin.</p>} />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => token && fetchLogs(token)}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 border-b border-border bg-muted/20 px-6 py-3">
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input
            placeholder="Ara..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-8 text-sm"
          />
          <Button variant="outline" size="sm" onClick={handleSearch} className="h-8 px-3">
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <select
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
          className="h-8 w-[200px] rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tüm aksiyonlar</option>
          {Object.entries(ACTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <select
          value={entityType}
          onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
          className="h-8 w-[160px] rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Tüm varlıklar</option>
          {ENTITY_TYPES.map((k) => (
            <option key={k} value={k}>{ENTITY_LABELS[k]}</option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-8 w-[140px] text-sm"
          />
          <span className="text-muted-foreground text-xs">–</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-8 w-[140px] text-sm"
          />
        </div>

        {(search || action || entityType || dateFrom || dateTo) && (
          <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
            Sıfırla
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-3 w-28 shrink-0" />
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16 ml-auto" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">Kayıt bulunamadı.</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Tarih</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Aksiyon</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Kullanıcı</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Varlık Tipi</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Varlık ID</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">IP</th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => <AuditRow key={log.id} log={log} />)}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between border-t border-border px-6 py-3">
          <span className="text-xs text-muted-foreground">
            Toplam {pagination.total} kayıt — Sayfa {pagination.page} / {Math.ceil(pagination.total / pagination.limit)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Önceki
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_more}
              onClick={() => setPage((p) => p + 1)}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
