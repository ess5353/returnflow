'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import {
  AlertTriangle, Calendar, Check, Copy, Eye, EyeOff,
  Key, Plus, ShieldOff, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PageHelp } from '@/components/ui/page-help';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  enabled: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type NewKeyResult = ApiKey & { raw_key: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function isExpired(key: ApiKey) {
  return key.expires_at ? new Date(key.expires_at) < new Date() : false;
}

function keyStatus(key: ApiKey): { label: string; class: string } {
  if (key.revoked_at) return { label: 'İptal Edildi', class: 'bg-red-100 text-red-700' };
  if (isExpired(key)) return { label: 'Süresi Doldu', class: 'bg-amber-100 text-amber-700' };
  if (!key.enabled) return { label: 'Devre Dışı', class: 'bg-muted text-muted-foreground' };
  return { label: 'Aktif', class: 'bg-green-100 text-green-700' };
}

// ─── New Key Banner ───────────────────────────────────────────────────────────

function NewKeyBanner({ rawKey, onDismiss }: { rawKey: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-amber-900">
              API anahtarını şimdi kopyala — bir daha gösterilmeyecek.
            </p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm text-amber-900">
                <span>{visible ? rawKey : `${rawKey.slice(0, 12)}${'•'.repeat(20)}`}</span>
                <button
                  onClick={() => setVisible(!visible)}
                  className="ml-1 text-amber-500 hover:text-amber-700"
                >
                  {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
              <Button size="sm" variant="outline" onClick={copy} className="border-amber-200 bg-white">
                {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                <span className="ml-1.5">{copied ? 'Kopyalandı!' : 'Kopyala'}</span>
              </Button>
            </div>
          </div>
        </div>
        <button onClick={onDismiss} className="rounded p-1 hover:bg-amber-100">
          <X className="h-4 w-4 text-amber-600" />
        </button>
      </div>
    </div>
  );
}

// ─── Create Modal ─────────────────────────────────────────────────────────────

function CreateModal({
  token,
  onClose,
  onCreated,
}: {
  token: string;
  onClose: () => void;
  onCreated: (key: NewKeyResult) => void;
}) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) {
      toast('Ad zorunludur', 'error');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ name: name.trim(), expires_at: expiresAt || null }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      onCreated(json.data as NewKeyResult);
    } else {
      toast(json.error ?? 'Oluşturulamadı', 'error');
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">Yeni API Anahtarı</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ad</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Üretim Entegrasyonu"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Son Kullanma Tarihi (opsiyonel)
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>İptal</Button>
          <Button size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? 'Oluşturuluyor…' : 'Oluştur'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── API Logs Panel ───────────────────────────────────────────────────────────

type Log = {
  id: string;
  key_prefix: string;
  endpoint: string;
  method: string;
  response_code: number;
  response_time_ms: number;
  created_at: string;
};

function LogsPanel({ token, onClose }: { token: string; onClose: () => void }) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const res = await fetch(`/api/api-logs?page=${p}&limit=50`, {
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      const json = await res.json();
      setLogs(p === 1 ? json.data ?? [] : (prev) => [...prev, ...(json.data ?? [])]);
      setHasMore(json.pagination?.has_more ?? false);
    }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(1); }, [load]);

  function statusColor(code: number) {
    if (code < 300) return 'text-green-600';
    if (code < 400) return 'text-blue-600';
    if (code === 429) return 'text-amber-600';
    return 'text-red-600';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold">API Logları</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-muted">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="space-y-2 p-4">
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-10 rounded" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <Key className="h-10 w-10 opacity-30" />
              <p className="text-sm">Henüz log yok</p>
            </div>
          ) : (
            <>
              <table className="w-full text-xs">
                <thead className="border-b border-border bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Zaman</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Anahtar</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Endpoint</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Kod</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">ms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="px-4 py-2 font-mono text-muted-foreground">{log.key_prefix}…</td>
                      <td className="px-4 py-2 max-w-[240px] truncate">
                        <span className="text-muted-foreground">{log.method} </span>
                        {log.endpoint.replace('/api/public', '')}
                      </td>
                      <td className={cn('px-4 py-2 text-right font-mono font-medium', statusColor(log.response_code))}>
                        {log.response_code}
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">{log.response_time_ms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {hasMore && (
                <div className="p-4 text-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPage(p => p + 1); load(page + 1); }}
                    disabled={loading}
                  >
                    Daha fazla yükle
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiKeysPage() {
  const { authHeader: token } = useAuth();
  const { settings, loadSettings } = useStoreSettings();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<NewKeyResult | null>(null);
  const [revokeConfirm, setRevokeConfirm] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchKeys = useCallback(async (tk: string) => {
    setLoading(true);
    const res = await fetch('/api/api-keys', { headers: { Authorization: tk } });
    if (res.ok) {
      const json = await res.json();
      setKeys(json.data ?? []);
    }
    setLoading(false);
  }, []);

  const init = useCallback(async () => {
    if (token) await fetchKeys(token);
    else setLoading(false);
  }, [fetchKeys]);

  useEffect(() => { AppBridgeHelper.closeLoader(); loadSettings(token); }, [loadSettings, token]);
  useEffect(() => { init(); }, [init]);

  async function handleRevoke(id: string) {
    const res = await fetch(`/api/api-keys/${id}`, {
      method: 'DELETE',
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => k.id === id ? { ...k, revoked_at: new Date().toISOString(), enabled: false } : k));
      toast('API anahtarı iptal edildi', 'success');
    } else {
      toast('İptal edilemedi', 'error');
    }
    setRevokeConfirm(null);
  }

  async function copyPrefix(prefix: string, id: string) {
    await navigator.clipboard.writeText(prefix + '...');
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">API Anahtarları</h1>
              <PageHelp title="API Anahtarları" content={<p>Kendi kodunuzdan veya araçlardan ReturnFlow verilerine erişmek için anahtar oluşturun. Anahtar yalnızca oluşturulduğu an görünür — güvenli bir yere kaydedin. Kullanılmayan anahtarları silin.</p>} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Public API erişimi için anahtarlar oluşturun ve yönetin.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setShowLogs(true)}>
              Loglar
            </Button>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Yeni Anahtar
            </Button>
          </div>
        </div>

        {/* New key banner */}
        {newKey && (
          <NewKeyBanner rawKey={newKey.raw_key} onDismiss={() => setNewKey(null)} />
        )}

        {/* Security note */}
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
          Anahtarlar SHA-256 ile hashlenerek saklanır. Plaintext hiçbir zaman depolanmaz.
          Authorization: Bearer &lt;API_KEY&gt; başlığı ile kullanın. Limit: 100 istek/dakika.
        </div>

        {/* Key list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border py-20 text-center">
            <Key className="h-12 w-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Henüz API anahtarı yok</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Public API&apos;ye erişmek için bir anahtar oluşturun.
              </p>
            </div>
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              İlk Anahtarı Oluştur
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {keys.map((k) => {
              const s = keyStatus(k);
              const isRevoked = !!k.revoked_at || isExpired(k);
              return (
                <div key={k.id} className={cn('flex items-center gap-4 px-5 py-4', isRevoked && 'opacity-60')}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Key className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{k.name}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.class)}>
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="font-mono">{k.key_prefix}…••••••••</span>
                      <span>Oluşturuldu: {fmt(k.created_at)}</span>
                      {k.expires_at && <span>Son: {fmt(k.expires_at)}</span>}
                      {k.last_used_at && <span>Son kullanım: {fmt(k.last_used_at)}</span>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => copyPrefix(k.key_prefix, k.id)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Öneki kopyala"
                    >
                      {copiedId === k.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    {!isRevoked && (
                      <button
                        onClick={() => setRevokeConfirm(k.id)}
                        className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                        title="İptal et"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <CreateModal
          token={token!}
          onClose={() => setCreating(false)}
          onCreated={(k) => {
            setCreating(false);
            setNewKey(k);
            setKeys((prev) => [k, ...prev]);
            toast('API anahtarı oluşturuldu', 'success');
          }}
        />
      )}

      {/* Revoke confirm */}
      {revokeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl">
            <h3 className="font-semibold">API Anahtarını İptal Et</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Bu anahtar kalıcı olarak devre dışı bırakılacak. Bu işlem geri alınamaz.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setRevokeConfirm(null)}>İptal</Button>
              <Button
                size="sm"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => handleRevoke(revokeConfirm)}
              >
                İptal Et
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Logs panel */}
      {showLogs && <LogsPanel token={token!} onClose={() => setShowLogs(false)} />}
    </DashboardShell>
  );
}
