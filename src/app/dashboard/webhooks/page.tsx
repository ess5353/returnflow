'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronRight,
  Clock, Eye, EyeOff, Globe, Pencil, Plus, RefreshCw,
  Trash2, X, XCircle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS } from '@/lib/webhooks/events';
import type { WebhookEvent } from '@/lib/webhooks/events';
import { PageHelp } from '@/components/ui/page-help';

// ─── Types ────────────────────────────────────────────────────────────────────

type Webhook = {
  id: string;
  name: string;
  url: string;
  secret: string;
  enabled: boolean;
  events: WebhookEvent[];
  created_at: string;
  updated_at: string;
};

type Delivery = {
  id: string;
  event: string;
  status: 'pending' | 'success' | 'failed' | 'retrying' | 'skipped';
  response_code: number | null;
  response_body: string | null;
  retry_count: number;
  next_retry_at: string | null;
  created_at: string;
  delivered_at: string | null;
};

type ModalState = { mode: 'create' } | { mode: 'edit'; webhook: Webhook };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: Delivery['status']) {
  const map = {
    success: { label: 'Başarılı', class: 'bg-green-100 text-green-700' },
    failed: { label: 'Başarısız', class: 'bg-red-100 text-red-700' },
    retrying: { label: 'Yeniden', class: 'bg-amber-100 text-amber-700' },
    pending: { label: 'Bekliyor', class: 'bg-slate-100 text-slate-600' },
    skipped: { label: 'Atlandı', class: 'bg-slate-100 text-slate-500' },
  };
  const s = map[status] ?? map.pending;
  return <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', s.class)}>{s.label}</span>;
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Webhook Form ─────────────────────────────────────────────────────────────

function WebhookFormModal({
  state,
  token,
  onClose,
  onSaved,
}: {
  state: ModalState;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initial = state.mode === 'edit' ? state.webhook : null;
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [secret, setSecret] = useState(initial?.secret ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>(initial?.events ?? []);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleEvent(ev: WebhookEvent) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  async function handleSave() {
    if (!name.trim() || !url.trim() || !secret.trim()) {
      toast('Ad, URL ve secret zorunludur', 'error');
      return;
    }
    setSaving(true);
    try {
      const endpoint =
        state.mode === 'edit'
          ? `/api/webhooks/${state.webhook.id}`
          : '/api/webhooks';
      const method = state.mode === 'edit' ? 'PATCH' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
        body: JSON.stringify({ name, url, secret, enabled, events: selectedEvents }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? 'Failed');
      }
      toast(state.mode === 'edit' ? 'Webhook güncellendi' : 'Webhook oluşturuldu', 'success');
      onSaved();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">
            {state.mode === 'edit' ? 'Webhook Düzenle' : 'Yeni Webhook'}
          </h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ad</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Sipariş Sistemi" />
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              type="url"
            />
          </div>

          {/* Secret */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Secret</label>
            <div className="relative">
              <Input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                type={showSecret ? 'text' : 'password'}
                placeholder="HMAC imzalama anahtarı"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              X-Pelyx-Signature headerı ile HMAC SHA256 imzası gönderilir.
            </p>
          </div>

          {/* Events */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Olaylar</label>
            <div className="grid grid-cols-2 gap-1.5">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => toggleEvent(ev)}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                    selectedEvents.includes(ev)
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border text-muted-foreground hover:border-muted-foreground',
                  )}
                >
                  <div
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 rounded-sm border',
                      selectedEvents.includes(ev) ? 'border-primary bg-primary' : 'border-border',
                    )}
                  >
                    {selectedEvents.includes(ev) && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />
                    )}
                  </div>
                  {WEBHOOK_EVENT_LABELS[ev]}
                </button>
              ))}
            </div>
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={cn(
                'relative h-5 w-9 rounded-full transition-colors',
                enabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                  enabled ? 'translate-x-4' : 'translate-x-0.5',
                )}
              />
            </button>
            <span className="text-sm text-muted-foreground">Aktif</span>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            İptal
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Delivery Logs Panel ──────────────────────────────────────────────────────

function DeliveryPanel({
  webhook,
  token,
  onClose,
}: {
  webhook: Webhook;
  token: string;
  onClose: () => void;
}) {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/webhooks/${webhook.id}/deliveries`, {
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      const json = await res.json();
      setDeliveries(json.data ?? []);
    }
    setLoading(false);
  }, [webhook.id, token]);

  useEffect(() => { load(); }, [load]);

  async function sendTest() {
    setTesting(true);
    const res = await fetch(`/api/webhooks/${webhook.id}/test`, {
      method: 'POST',
      headers: { Authorization: token ?? '' },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const s = json.delivery?.status;
      if (s === 'success') {
        toast('Test başarılı', 'success');
      } else {
        toast(`Test tamamlandı: ${s} (${json.delivery?.response_code ?? '—'})`, 'error');
      }
      await load();
    } else {
      toast(json.error ?? 'Test başarısız', 'error');
    }
    setTesting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">{webhook.name}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{webhook.url}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={sendTest}
              disabled={testing}
            >
              {testing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              <span className="ml-1.5">{testing ? 'Gönderiliyor…' : 'Test Et'}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
            <button onClick={onClose} className="rounded p-1 hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : deliveries.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-muted-foreground">
              <Globe className="h-10 w-10 opacity-30" />
              <p className="text-sm">Henüz teslimat yok</p>
              <Button size="sm" variant="outline" onClick={sendTest} disabled={testing}>
                <Zap className="h-3.5 w-3.5 mr-1.5" />
                Test gönder
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {deliveries.map((d) => (
                <div key={d.id}>
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {d.status === 'success' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      ) : d.status === 'failed' ? (
                        <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                      ) : d.status === 'retrying' ? (
                        <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-slate-400" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{d.event}</span>
                          {statusBadge(d.status)}
                          {d.response_code && (
                            <span className="text-xs text-muted-foreground">{d.response_code}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {fmt(d.created_at)}
                          {d.retry_count > 0 && ` · ${d.retry_count} deneme`}
                        </div>
                      </div>
                    </div>
                    {expanded === d.id ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </button>

                  {expanded === d.id && (
                    <div className="border-t border-border bg-muted/30 px-5 py-3">
                      <div className="space-y-2 text-xs text-muted-foreground">
                        <div>
                          <span className="font-medium text-foreground">Durum: </span>
                          {d.status}
                        </div>
                        {d.response_code !== null && (
                          <div>
                            <span className="font-medium text-foreground">HTTP: </span>
                            {d.response_code}
                          </div>
                        )}
                        {d.delivered_at && (
                          <div>
                            <span className="font-medium text-foreground">Teslim: </span>
                            {fmt(d.delivered_at)}
                          </div>
                        )}
                        {d.next_retry_at && (
                          <div>
                            <span className="font-medium text-foreground">Sonraki deneme: </span>
                            {fmt(d.next_retry_at)}
                          </div>
                        )}
                        {d.response_body && (
                          <div>
                            <div className="mb-1 font-medium text-foreground">Yanıt:</div>
                            <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-xs leading-relaxed">
                              {d.response_body}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Webhook Card ─────────────────────────────────────────────────────────────

function WebhookCard({
  webhook,
  token,
  onEdit,
  onDelete,
  onViewLogs,
}: {
  webhook: Webhook;
  token: string;
  onEdit: () => void;
  onDelete: () => void;
  onViewLogs: () => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [enabled, setEnabled] = useState(webhook.enabled);

  async function toggleEnabled() {
    setToggling(true);
    const next = !enabled;
    const res = await fetch(`/api/webhooks/${webhook.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ enabled: next }),
    });
    if (res.ok) {
      setEnabled(next);
      toast(next ? 'Webhook aktif edildi' : 'Webhook devre dışı', 'success');
    } else {
      toast('Güncellenemedi', 'error');
    }
    setToggling(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{webhook.name}</span>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  enabled ? 'bg-green-100 text-green-700' : 'bg-muted text-muted-foreground',
                )}
              >
                {enabled ? 'Aktif' : 'Pasif'}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{webhook.url}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {webhook.events.slice(0, 4).map((ev) => (
                <span key={ev} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  {WEBHOOK_EVENT_LABELS[ev]}
                </span>
              ))}
              {webhook.events.length > 4 && (
                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  +{webhook.events.length - 4}
                </span>
              )}
              {webhook.events.length === 0 && (
                <span className="text-xs text-muted-foreground italic">Olay seçilmedi</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggleEnabled}
            disabled={toggling}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors disabled:opacity-50',
              enabled ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
                enabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
          <button
            onClick={onViewLogs}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Teslimat Logları"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Düzenle"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
            title="Sil"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const { authHeader: token } = useAuth();
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState | null>(null);
  const [logsFor, setLogsFor] = useState<Webhook | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async (tk: string) => {
    setLoading(true);
    const res = await fetch('/api/webhooks', {
      headers: { Authorization: tk },
    });
    if (res.ok) {
      const json = await res.json();
      setWebhooks(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { AppBridgeHelper.closeLoader(); }, []);
  useEffect(() => {
    if (token) fetchWebhooks(token!);
    else setLoading(false);
  }, [token, fetchWebhooks]);

  async function handleDelete(id: string) {
    const res = await fetch(`/api/webhooks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast('Webhook silindi', 'success');
    } else {
      toast('Silinemedi', 'error');
    }
    setDeleteConfirm(null);
  }

  return (
    <DashboardShell>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">Webhook &amp; Entegrasyonlar</h1>
              <PageHelp title="Webhooks" content={<p>Belirli olaylar gerçekleştiğinde kendi URL&apos;nize otomatik HTTP POST gönderir. Zapier, Make.com veya kendi sisteminizle entegrasyon için idealdir. HTTPS zorunludur. &quot;Test Et&quot; butonu ile bağlantıyı doğrulayın.</p>} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Olayları harici sistemlere HTTP POST olarak iletin.
            </p>
          </div>
          <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Webhook Ekle
          </Button>
        </div>

        {/* Signature info */}
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
          <strong>İmzalama:</strong> Her istek{' '}
          <code className="rounded bg-blue-100 px-1">X-Pelyx-Signature</code> (HMAC SHA256) ve{' '}
          <code className="rounded bg-blue-100 px-1">X-Pelyx-Event</code> headerlari ile gönderilir.
          Başarısız teslimatlar 1 dk → 5 dk → 30 dk aralıklarla yeniden denenir.
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
            <Globe className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Henüz webhook yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                İade olaylarını harici sistemlere göndermek için webhook ekleyin.
              </p>
            </div>
            <Button size="sm" onClick={() => setModal({ mode: 'create' })}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              İlk Webhook&apos;u Oluştur
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <WebhookCard
                key={wh.id}
                webhook={wh}
                token={token!}
                onEdit={() => setModal({ mode: 'edit', webhook: wh })}
                onDelete={() => setDeleteConfirm(wh.id)}
                onViewLogs={() => setLogsFor(wh)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {modal && (
        <WebhookFormModal
          state={modal}
          token={token!}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            fetchWebhooks(token!);
          }}
        />
      )}

      {/* Delivery Logs Panel */}
      {logsFor && (
        <DeliveryPanel
          webhook={logsFor}
          token={token!}
          onClose={() => setLogsFor(null)}
        />
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-semibold">Webhook&apos;u Sil</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Bu webhook ve tüm teslimat geçmişi kalıcı olarak silinecek. Emin misin?
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>
                İptal
              </Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleDelete(deleteConfirm)}
              >
                Sil
              </Button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
