'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Mail, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entitlement, Plan } from '@/lib/billing/entitlement';
import { PageHelp } from '@/components/ui/page-help';

const PLAN_LABELS: Record<Plan, string> = {
  trial:      'Deneme Süresi',
  pro:        'Pro',
  enterprise: 'Enterprise',
  expired:    'Süresi Dolmuş',
};

const PLAN_BADGE: Record<Plan, string> = {
  trial:      'border-blue-200 bg-blue-50 text-blue-700',
  pro:        'border-violet-200 bg-violet-50 text-violet-700',
  enterprise: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  expired:    'border-red-200 bg-red-50 text-red-700',
};

function TrialCountdown({ endsAt }: { endsAt: string }) {
  const TRIAL_DAYS = 14;
  const endsAtMs = new Date(endsAt).getTime();
  const totalMs = TRIAL_DAYS * 86400000;

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, endsAtMs - now);
  const usedMs = Math.max(0, totalMs - remainingMs);
  const progressPct = Math.min(100, Math.round((usedMs / totalMs) * 100));

  const daysLeft = Math.floor(remainingMs / 86400000);
  const hoursLeft = Math.floor((remainingMs % 86400000) / 3600000);
  const urgent = daysLeft <= 3;

  const timeLabel =
    remainingMs === 0 ? 'Deneme süresi sona erdi'
    : daysLeft === 0 ? `${hoursLeft} saat kaldı`
    : daysLeft <= 3 ? `${daysLeft} gün ${hoursLeft} saat kaldı`
    : `${daysLeft} gün kaldı`;

  return (
    <div className={cn('rounded-xl border px-4 py-4 space-y-3', urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', urgent ? 'text-red-500' : 'text-amber-500')} />
        <span className={cn('text-sm font-semibold', urgent ? 'text-red-700' : 'text-amber-700')}>
          {timeLabel}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-2 rounded-full overflow-hidden bg-black/10">
        <div
          className={cn('h-full rounded-full transition-all', urgent ? 'bg-red-500' : 'bg-amber-500')}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className={cn('text-xs', urgent ? 'text-red-600' : 'text-amber-600')}>
        Bitiş: {new Date(endsAt).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })} · Erişimi sürdürmek için Pro plana geçin.
      </p>
    </div>
  );
}

export default function BillingPage() {
  const { authHeader: token } = useAuth();
  const { settings, loadSettings } = useStoreSettings();
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  const fetchStatus = useCallback(async (t: string) => {
    const res = await fetch('/api/billing/status', { headers: { Authorization: t } });
    if (!res.ok) { setError('Fatura bilgisi alınamadı.'); setLoading(false); return; }
    const json = await res.json();
    setEntitlement(json.data as Entitlement);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetchStatus(token);
  }, [token, fetchStatus]);

  const handleUpgrade = async () => {
    if (!token) return;
    setUpgrading(true);
    setError('');
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { Authorization: token ?? '' },
      });
      const json = await res.json();
      if (!res.ok || !json.data?.paymentUrl) {
        setError((json.error as string | undefined) ?? 'Ödeme başlatılamadı.');
        return;
      }
      window.open(json.data.paymentUrl as string, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Bağlantı hatası.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!token) return;
    setConfirming(true);
    setError('');
    try {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { Authorization: token ?? '' },
      });
      const json = await res.json();
      if (res.ok && json.data?.entitlement) {
        setEntitlement(json.data.entitlement as Entitlement);
        if (!json.data.confirmed) {
          setError('Ödeme henüz onaylanmadı. Ödemeyi tamamladıktan sonra tekrar deneyin.');
        }
      }
    } catch {
      setError('Bağlantı hatası.');
    } finally {
      setConfirming(false);
    }
  };

  const plan = entitlement?.plan ?? 'trial';
  const isExpired = entitlement?.isExpired ?? false;
  const isTrial = plan === 'trial';
  const isPaid = plan === 'pro' || plan === 'enterprise';
  const showUpgradeSection = isTrial || isExpired;

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Fatura & Plan</h1>
              <PageHelp title="Fatura & Plan" content={<p>Deneme süresi (14 gün) ve Pro plan bilgileri. Deneme bittiğinde verileriniz silinmez; yalnızca yeni talep kabulü durur. Pro abonelik ikas App Store üzerinden yönetilir.</p>} />
            </div>
            <p className="text-sm text-muted-foreground">Abonelik durumunuzu yönetin</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => { if (token) { setLoading(true); fetchStatus(token); } }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Yenile
          </Button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}

        {entitlement && !loading && (
          <>
            {/* Current plan card */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Mevcut Plan</p>
                  <p className="text-2xl font-bold mt-1">{PLAN_LABELS[plan]}</p>
                </div>
                <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', PLAN_BADGE[plan])}>
                  {entitlement.status === 'will_expire' ? 'İptal Edilecek'
                    : isExpired ? 'Süresi Dolmuş'
                    : 'Aktif'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {isTrial && entitlement.trialEndsAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Deneme sona eriyor</p>
                    <p className="font-semibold">{new Date(entitlement.trialEndsAt).toLocaleDateString('tr-TR')}</p>
                  </div>
                )}
                {isPaid && entitlement.currentPeriodEnd && (
                  <div>
                    <p className="text-xs text-muted-foreground">Yenileme tarihi</p>
                    <p className="font-semibold">{new Date(entitlement.currentPeriodEnd).toLocaleDateString('tr-TR')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">İade & Değişim</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Sınırsız
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Özellikler</p>
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Tümü dahil
                  </p>
                </div>
              </div>
            </div>

            {/* Trial countdown */}
            {isTrial && entitlement.trialEndsAt && !isExpired && (
              <TrialCountdown endsAt={entitlement.trialEndsAt} />
            )}

            {/* Expired banner */}
            {isExpired && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">
                    {plan === 'trial' ? 'Deneme süreniz sona erdi' : 'Aboneliğiniz sona erdi'}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    Müşteri iade portali devre dışı. Pro plana geçerek erişimi geri kazanın.
                  </p>
                </div>
              </div>
            )}

            {/* Upgrade section — shown during trial or after expiry */}
            {showUpgradeSection && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-sm font-semibold">Plana Geç</p>
                </div>

                <div className="p-6 grid sm:grid-cols-2 gap-4">

                  {/* Pro */}
                  <div className="rounded-xl border-2 border-violet-200 bg-violet-50/30 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-violet-500">Pro</p>
                      <p className="text-3xl font-extrabold text-violet-900 mt-1">
                        ₺12.000<span className="text-sm font-normal text-violet-500">/yıl</span>
                      </p>
                      <p className="text-xs text-violet-600 mt-0.5">aylık yaklaşık ₺1.000</p>
                    </div>
                    <ul className="space-y-2 text-sm text-violet-800">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />Sınırsız iade & değişim</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />Tüm özellikler dahil</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />E-posta desteği</li>
                    </ul>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                      onClick={handleUpgrade}
                      disabled={upgrading}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {upgrading ? 'Yükleniyor...' : "Pro'ya Geç"}
                    </Button>
                  </div>

                  {/* Enterprise */}
                  <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Enterprise</p>
                      <p className="text-3xl font-extrabold mt-1">Özel Fiyat</p>
                    </div>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Sınırsız her şey</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Öncelikli destek & SLA</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Özel entegrasyon</li>
                    </ul>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => window.open('mailto:eypsrkc@gmail.com?subject=Enterprise Plan', '_blank')}
                    >
                      <Mail className="h-4 w-4" />
                      Satışla İletişime Geç
                    </Button>
                  </div>
                </div>

                {/* Confirm payment */}
                <div className="px-6 pb-5 border-t border-border pt-4 text-center">
                  <p className="text-xs text-muted-foreground mb-3">
                    Ödemeyi ikas üzerinden tamamladıktan sonra aşağıdaki butona tıklayın.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleConfirmPayment}
                    disabled={confirming}
                    className="gap-1.5"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', confirming && 'animate-spin')} />
                    {confirming ? 'Kontrol ediliyor...' : 'Ödemeyi Onayla'}
                  </Button>
                </div>
              </div>
            )}

            {/* Active subscription management note */}
            {isPaid && !isExpired && (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                <p>Aboneliği iptal etmek veya yönetmek için ikas uygulama panelini kullanın.</p>
                {entitlement.status === 'will_expire' && (
                  <p className="text-amber-600 font-medium">Aboneliğiniz mevcut dönem sonunda sona erecek.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
