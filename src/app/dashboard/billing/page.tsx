'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Mail, RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Entitlement, Plan } from '@/lib/billing/entitlement';

const PLAN_LABELS: Record<Plan, string> = {
  trial: 'Deneme Süresi',
  pro: 'Pro',
  enterprise: 'Enterprise',
  expired: 'Süresi Dolmuş',
};

const PLAN_BADGE: Record<Plan, string> = {
  trial: 'bg-blue-50 text-blue-700 border-blue-200',
  pro: 'bg-violet-50 text-violet-700 border-violet-200',
  enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expired: 'bg-red-50 text-red-700 border-red-200',
};

function UsageMeter({ used, limit }: { used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium">
        <span>{used.toLocaleString('tr-TR')} kullanıldı</span>
        <span className="text-muted-foreground">{limit.toLocaleString('tr-TR')} limit</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted-foreground">{(limit - used).toLocaleString('tr-TR')} istek kaldı</p>
    </div>
  );
}

function TrialCountdown({ endsAt }: { endsAt: string }) {
  const daysLeft = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000));
  const urgent = daysLeft <= 3;
  return (
    <div className={cn('rounded-xl border px-4 py-3', urgent ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50')}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('h-4 w-4 shrink-0', urgent ? 'text-red-500' : 'text-amber-500')} />
        <span className={cn('text-sm font-semibold', urgent ? 'text-red-700' : 'text-amber-700')}>
          Deneme sürenizin bitmesine {daysLeft} gün kaldı
        </span>
      </div>
      <p className={cn('mt-1 text-xs', urgent ? 'text-red-600' : 'text-amber-600')}>
        {new Date(endsAt).toLocaleDateString('tr-TR')} tarihinde sona erecek. Erişimi sürdürmek için Pro plana geçin.
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
        setError(json.error ?? 'Ödeme başlatılamadı.');
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
            <h1 className="text-xl font-bold">Fatura & Plan</h1>
            <p className="text-sm text-muted-foreground">Abonelik durumunuzu ve kullanımınızı yönetin</p>
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
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
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
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mevcut Plan</p>
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
                    <p className="text-xs text-muted-foreground">Dönem sonu</p>
                    <p className="font-semibold">{new Date(entitlement.currentPeriodEnd).toLocaleDateString('tr-TR')}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">İstek limiti</p>
                  <p className="font-semibold">
                    {entitlement.requestsLimit === -1 ? 'Sınırsız' : `${entitlement.requestsLimit.toLocaleString('tr-TR')} / ay`}
                  </p>
                </div>
              </div>

              {entitlement.requestsLimit !== -1 && (
                <UsageMeter used={entitlement.requestsUsed} limit={entitlement.requestsLimit} />
              )}

              {(isTrial || plan === 'enterprise') && entitlement.requestsLimit === -1 && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {isTrial ? 'Deneme süresinde tüm özellikler sınırsız' : 'Enterprise: sınırsız istek'}
                </div>
              )}
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

            {/* Upgrade section */}
            {showUpgradeSection && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-sm font-semibold">Plana Geç</p>
                </div>
                <div className="p-6 grid sm:grid-cols-2 gap-4">

                  {/* Pro Plan */}
                  <div className="rounded-xl border-2 border-violet-200 bg-violet-50/30 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-violet-500">Pro</p>
                      <p className="text-3xl font-extrabold text-violet-900 mt-1">
                        ₺1.500<span className="text-sm font-normal text-violet-500">/ay</span>
                      </p>
                    </div>
                    <ul className="space-y-2 text-sm text-violet-800">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />1.000 iade/değişim isteği/ay</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />Tüm özellikler dahil</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-violet-500" />E-posta desteği</li>
                    </ul>
                    <Button
                      className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
                      onClick={handleUpgrade}
                      disabled={upgrading}
                    >
                      <ExternalLink className="h-4 w-4" />
                      {upgrading ? 'Yükleniyor...' : 'Pro\'ya Geç'}
                    </Button>
                  </div>

                  {/* Enterprise */}
                  <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Enterprise</p>
                      <p className="text-3xl font-extrabold mt-1">Özel Fiyat</p>
                    </div>
                    <ul className="space-y-2 text-sm text-foreground">
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Sınırsız istek</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Özel SLA</li>
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />Öncelikli destek</li>
                    </ul>
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      onClick={() => window.open('mailto:hello@pelyx.co?subject=Enterprise Plan', '_blank')}
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

            {/* Active paid plan note */}
            {isPaid && !isExpired && (
              <div className="rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
                <p>Aboneliğinizi yönetmek (iptal veya plan değişikliği) için ikas uygulama panelini kullanın.</p>
                {entitlement.status === 'will_expire' && (
                  <p className="text-amber-600 font-medium">Aboneliğiniz mevcut dönem sonunda sona erecek.</p>
                )}
              </div>
            )}

            {entitlement.requestsLimit !== -1 && entitlement.requestsUsed > 0 && (
              <p className="text-xs text-center text-muted-foreground">
                Bu dönemde {entitlement.requestsUsed.toLocaleString('tr-TR')} iade/değişim isteği işlendi.
              </p>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
