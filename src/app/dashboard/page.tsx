'use client';

import { useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuth } from '@/hooks/use-auth';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Check, ChevronRight, Copy, FlaskConical, RefreshCw, Trash2, X } from 'lucide-react';
import { OnboardingWizard } from '@/components/onboarding/wizard';
import { OnboardingChecklist } from '@/components/onboarding/checklist';
import { PageHelp } from '@/components/ui/page-help';

type ReturnRequest = {
  id: string;
  order_id: string;
  rf_number: string;
  customer_name: string;
  product: string;
  products: { name: string; quantity: number; price: number }[] | null;
  reason: string;
  description: string | null;
  admin_note: string | null;
  amount: string;
  status: string;
  created_at: string;
  media_urls: string[] | null;
  customer_email: string | null;
};

type IkasOrder = {
  id: string;
  orderNumber: string | number;
  status: string;
  customerName: string;
  totalPrice: number;
  items: { name: string; sku?: string; quantity: number; price: number }[];
};

function statusVariant(status: string): 'pending' | 'approved' | 'rejected' | 'secondary' {
  if (status === 'Onaylandı') return 'approved';
  if (status === 'Reddedildi') return 'rejected';
  if (status === 'Yeni Talep') return 'pending';
  return 'secondary';
}

const DATE_FILTERS = ['Bugün', 'Son 7 Gün', 'Son 30 Gün', 'Bu Ay', 'Tümü'] as const;
const STATUS_FILTERS = ['Tümü', 'Yeni Talep', 'Onaylandı', 'Reddedildi'] as const;
const PORTAL_URL = `${process.env.NEXT_PUBLIC_DEPLOY_URL ?? ''}/returns`;

export default function DashboardPage() {
  const { authHeader: token } = useAuth();
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [orders, setOrders] = useState<IkasOrder[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [dateFilter, setDateFilter] = useState('Tümü');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const { settings, loadSettings: fetchSettings } = useStoreSettings();

  const fetchRequests = useCallback(async (t: string) => {
    const res = await fetch('/api/returns', { headers: { Authorization: t } });
    if (!res.ok) {
      toast('İade talepleri alınamadı', 'error');
      setLoading(false);
      return;
    }
    const { data } = await res.json();
    const list = (data as ReturnRequest[]) ?? [];
    setRequests(list);
    setSelectedRequest((current) => current ?? list[0] ?? null);
    setLoading(false);
  }, []);

  const fetchOrders = useCallback(async (t: string) => {
    const res = await fetch('/api/ikas/orders', { headers: { Authorization: t } });
    const data = await res.json();
    if (data.success) setOrders(data.orders);
  }, []);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    if (token) {
      Promise.all([fetchRequests(token), fetchOrders(token), fetchSettings()]).catch(() => null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const updateStatus = useCallback(async (status: string) => {
    if (!selectedRequest || !token) return;
    setUpdatingStatus(true);
    const res = await fetch(`/api/returns/${selectedRequest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ status }),
    });
    setUpdatingStatus(false);
    if (!res.ok) { toast('Durum güncellenemedi', 'error'); return; }
    await fetchRequests(token);
    setSelectedRequest((prev) => prev ? { ...prev, status } : prev);
    toast(status === 'Onaylandı' ? 'Talep onaylandı' : 'Talep reddedildi', 'success');
  }, [selectedRequest, token, fetchRequests]);

  const saveNote = useCallback(async () => {
    if (!selectedRequest || !token) return;
    setSavingNote(true);
    const res = await fetch(`/api/returns/${selectedRequest.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: token ?? '' },
      body: JSON.stringify({ admin_note: adminNote }),
    });
    setSavingNote(false);
    if (!res.ok) { toast('Not kaydedilemedi', 'error'); return; }
    await fetchRequests(token);
    toast('Not kaydedildi', 'success');
  }, [selectedRequest, token, adminNote, fetchRequests]);

  const seedDemoData = useCallback(async () => {
    if (!token) return;
    setSeedingDemo(true);
    try {
      const res = await fetch('/api/demo-data', { method: 'POST', headers: { Authorization: token } });
      if (res.ok) {
        await fetchRequests(token);
        toast('Demo veriler yüklendi', 'success');
      } else {
        const j = await res.json();
        toast((j.error as string | undefined) ?? 'Demo veriler yüklenemedi', 'error');
      }
    } catch {
      toast('Bağlantı hatası', 'error');
    } finally {
      setSeedingDemo(false);
    }
  }, [token, fetchRequests]);

  const handleDelete = useCallback(async () => {
    if (!selectedRequest || !token) return;
    const res = await fetch(`/api/returns/${selectedRequest.id}`, {
      method: 'DELETE',
      headers: { Authorization: token ?? '' },
    });
    if (!res.ok) { toast('Talep silinemedi', 'error'); return; }
    setDeleteDialogOpen(false);
    setSelectedRequest(null);
    await fetchRequests(token);
    toast('Talep silindi', 'success');
  }, [selectedRequest, token, fetchRequests]);

  const filteredRequests = requests.filter((r) => {
    const matchesFilter = filter === 'Tümü' || r.status === filter;
    const matchesSearch =
      (r.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.customer_email || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.order_id || '').toLowerCase().includes(search.toLowerCase()) ||
      (r.rf_number || '').toLowerCase().includes(search.toLowerCase());

    const createdAt = new Date(r.created_at);
    const now = new Date();
    let matchesDate = true;
    if (dateFilter === 'Bugün') matchesDate = createdAt.toDateString() === now.toDateString();
    if (dateFilter === 'Son 7 Gün') matchesDate = createdAt >= new Date(now.getTime() - 7 * 86400000);
    if (dateFilter === 'Son 30 Gün') matchesDate = createdAt >= new Date(now.getTime() - 30 * 86400000);
    if (dateFilter === 'Bu Ay') matchesDate = createdAt.getMonth() === now.getMonth() && createdAt.getFullYear() === now.getFullYear();

    return matchesFilter && matchesSearch && matchesDate;
  });

  const totalReturnAmount = filteredRequests.reduce((t, r) => t + Number(r.amount || 0), 0);
  const reasonCounts = filteredRequests.reduce((acc: Record<string, number>, r) => { acc[r.reason] = (acc[r.reason] || 0) + 1; return acc; }, {});
  const topReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  const reasonStats = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const stats = [
    { label: 'Toplam İade', value: filteredRequests.length },
    { label: 'Yeni Talep', value: filteredRequests.filter((r) => r.status === 'Yeni Talep').length },
    { label: 'Onaylanan', value: filteredRequests.filter((r) => r.status === 'Onaylandı').length },
    { label: 'Reddedilen', value: filteredRequests.filter((r) => r.status === 'Reddedildi').length },
    { label: 'Toplam Tutar', value: `₺${totalReturnAmount.toLocaleString('tr-TR')}` },
    { label: 'Baş. Sebep', value: topReason?.[0] ?? '—', sub: topReason ? `${topReason[1]} kez` : undefined },
  ];

  const selected = selectedRequest;

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <OnboardingWizard />
      <div className="p-6 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Genel Bakış</h1>
              <PageHelp title="Genel Bakış" content={<p>Müşterilerden gelen iade taleplerinin özeti. Sol listeden bir talep seçin, sağda detayları görün. Onayla veya Reddet butonuyla talebi sonuçlandırın. Durum ve tarih filtresi ile belirli taleplere odaklanın.</p>} />
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">Müşterilerden gelen iade taleplerini buradan yönetin.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { if (token) { setLoading(true); fetchRequests(token); fetchOrders(token); } fetchSettings(); }}
            className="shrink-0 gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </Button>
        </div>

        {/* Date filters */}
        <div className="flex flex-wrap gap-1.5">
          {DATE_FILTERS.map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                dateFilter === d ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              <p className="mt-1.5 text-2xl font-bold tracking-tight">{s.value}</p>
              {s.sub && <p className="mt-0.5 text-xs text-muted-foreground">{s.sub}</p>}
            </div>
          ))}
        </div>

        {/* Onboarding checklist — shown until all steps done */}
        {!loading && <OnboardingChecklist />}

        {/* Portal link */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground mb-2">İade Portal Linki</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{PORTAL_URL}</code>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => { navigator.clipboard.writeText(PORTAL_URL); toast('Portal linki kopyalandı', 'success'); }}
            >
              <Copy className="h-3.5 w-3.5" />
              Kopyala
            </Button>
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Reason analysis */}
            {reasonStats.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
                <h2 className="text-sm font-semibold mb-3">İade Sebebi Analizi</h2>
                <div className="space-y-3">
                  {reasonStats.map(([reason, count]) => (
                    <div key={reason}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium">{reason}</span>
                        <span className="text-muted-foreground">{count} kez</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${filteredRequests.length ? Math.min((count / filteredRequests.length) * 100, 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Return requests table */}
            <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
              <div className="border-b border-border p-4">
                <h2 className="text-sm font-semibold">İade Talepleri</h2>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="RF No, Sipariş, Müşteri..."
                    className="max-w-xs h-8 text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {STATUS_FILTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => setFilter(s)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          filter === s ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="divide-y divide-border">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-4">
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-28" />
                        <Skeleton className="h-3 w-44" />
                      </div>
                      <Skeleton className="h-3.5 w-16" />
                    </div>
                  ))
                ) : filteredRequests.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      {requests.length === 0 ? 'Henüz iade talebi yok.' : 'Filtreyle eşleşen talep bulunamadı.'}
                    </p>
                    {requests.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={seedDemoData}
                        disabled={seedingDemo}
                      >
                        <FlaskConical className="h-3.5 w-3.5" />
                        {seedingDemo ? 'Yükleniyor...' : 'Demo Veri Yükle'}
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredRequests.map((req) => {
                    const isSelected = selected?.id === req.id;
                    return (
                      <button
                        key={req.id}
                        onClick={() => { setSelectedRequest(req); setAdminNote(req.admin_note || ''); }}
                        className={`w-full flex items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? 'bg-muted/50' : ''}`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-medium text-foreground">{req.rf_number}</span>
                            <Badge variant={statusVariant(req.status)}>{req.status}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground truncate">
                            {req.order_id} · {req.customer_name}
                          </p>
                        </div>
                        <div className="hidden sm:block shrink-0 text-right">
                          <p className="text-xs font-semibold">₺{Number(req.amount).toLocaleString('tr-TR')}</p>
                          <p className="text-xs text-muted-foreground">{req.reason}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Recent ikas orders */}
            {orders.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
                <div className="border-b border-border p-4">
                  <h2 className="text-sm font-semibold">İkas Son Siparişler</h2>
                </div>
                <div className="divide-y divide-border">
                  {orders.map((order) => (
                    <div key={order.id} className="flex items-center gap-4 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">#{order.orderNumber} · {order.customerName}</p>
                        <p className="text-xs text-muted-foreground truncate">{order.items?.[0]?.name || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold">₺{order.totalPrice}</p>
                        <p className="text-xs text-muted-foreground">{order.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Detail panel */}
          <aside className="rounded-xl border border-border bg-card shadow-xs h-fit lg:sticky lg:top-6">
            {!selected ? (
              <div className="py-12 px-4 text-center text-sm text-muted-foreground">
                <p>Detayları görüntülemek için</p>
                <p>bir talep seçin.</p>
              </div>
            ) : (
              <div>
                <div className="border-b border-border p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-xs text-muted-foreground">{selected.rf_number}</p>
                      <h2 className="mt-0.5 text-base font-bold">{selected.customer_name}</h2>
                    </div>
                    <Badge variant={statusVariant(selected.status)}>{selected.status}</Badge>
                  </div>
                </div>

                <div className="p-4 space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Sipariş</p>
                      <p className="font-medium text-sm">{selected.order_id}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tutar</p>
                      <p className="font-medium text-sm">₺{Number(selected.amount).toLocaleString('tr-TR')}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">E-posta</p>
                      <p className="font-medium text-sm">{selected.customer_email || '—'}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">İade Sebebi</p>
                      <p className="font-medium text-sm">{selected.reason}</p>
                    </div>
                  </div>

                  {selected.products && selected.products.length > 0 ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">İade Edilen Ürünler</p>
                      <div className="space-y-2">
                        {selected.products.map((item, i) => (
                          <div key={i} className="rounded-lg bg-muted px-3 py-2">
                            <p className="text-xs font-medium">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.quantity} adet · ₺{item.price}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs text-muted-foreground">Ürün</p>
                      <p className="font-medium text-sm">{selected.product}</p>
                    </div>
                  )}

                  {selected.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Açıklama</p>
                      <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-relaxed">{selected.description}</p>
                    </div>
                  )}

                  {selected.media_urls && selected.media_urls.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">Kanıt Dosyaları</p>
                      <div className="grid grid-cols-2 gap-2">
                        {selected.media_urls.map((url, i) => {
                          const isVideo = /\.(mp4|mov|webm)/i.test(url);
                          return isVideo ? (
                            <video key={i} controls className="w-full rounded-lg border border-border">
                              <source src={url} />
                            </video>
                          ) : (
                            <img key={i} src={url} alt="Return media" className="w-full rounded-lg border border-border object-cover" />
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Mağaza Notu</p>
                    <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="Not bırak..." className="text-xs" />
                    <Button variant="outline" size="sm" onClick={saveNote} disabled={savingNote} className="mt-2 w-full text-xs">
                      {savingNote ? 'Kaydediliyor...' : 'Notu Kaydet'}
                    </Button>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => updateStatus('Onaylandı')}
                      disabled={updatingStatus || selected.status === 'Onaylandı'}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Onayla
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => updateStatus('Reddedildi')}
                      disabled={updatingStatus || selected.status === 'Reddedildi'}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reddet
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Talebi Sil
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog.Root open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-150" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <Dialog.Title className="text-base font-bold">Talebi Sil</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-muted-foreground">
              <strong className="text-foreground">{selected?.rf_number}</strong> numaralı iade talebi kalıcı olarak silinecek.
            </Dialog.Description>
            <div className="mt-5 flex gap-2">
              <Dialog.Close asChild>
                <Button variant="outline" className="flex-1">İptal</Button>
              </Dialog.Close>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Sil</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </DashboardShell>
  );
}
