'use client';

import { useState } from 'react';
import { ArrowLeftRight, CheckCircle2, ExternalLink, Lock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { STAFF_TOKEN_KEY } from '@/hooks/use-auth';
import { PRO_PLAN_NAME, PRO_PRICE_LABEL } from '@/lib/billing/constants';
import type { Entitlement } from '@/lib/billing/entitlement';

interface PaywallProps {
  entitlement: Entitlement | null;
  authHeader?: string;
  canManageBilling: boolean;
  isStaff: boolean;
  storeName?: string | null;
  logoUrl?: string | null;
  onReactivated: () => void;
}

const FEATURES = [
  'Sınırsız iade ve değişim talebi',
  'Otomatik para iadesi ve değişim işlemleri',
  'Otomasyon kuralları, e-posta şablonları ve webhooks',
  'Analiz, AI içgörüleri ve dışa aktarma',
  'Ekip yönetimi ve API erişimi',
];

export function Paywall({
  entitlement,
  authHeader,
  canManageBilling,
  isStaff,
  storeName,
  logoUrl,
  onReactivated,
}: PaywallProps) {
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);

  const wasPaid = entitlement?.blockedReason === 'subscription_expired';
  const title = wasPaid ? 'Aboneliğiniz Sona Erdi' : 'Ücretsiz Deneme Süreniz Sona Erdi';

  const startPurchase = async () => {
    if (!authHeader) return;
    setStarting(true);
    try {
      const res = await fetch('/api/billing/upgrade', {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const json = await res.json();
      if (!res.ok || !json.data?.paymentUrl) {
        toast((json.error as string | undefined) ?? 'Ödeme başlatılamadı.', 'error');
        return;
      }
      window.open(json.data.paymentUrl as string, '_blank', 'noopener,noreferrer');
      toast('ikas ödeme sayfası açıldı. Ödemeyi tamamladıktan sonra "Ödemeyi Kontrol Et" butonuna dokunun.', 'info');
    } catch {
      toast('Bağlantı hatası.', 'error');
    } finally {
      setStarting(false);
    }
  };

  const checkPayment = async () => {
    if (!authHeader) return;
    setChecking(true);
    try {
      const res = await fetch('/api/billing/confirm', {
        method: 'POST',
        headers: { Authorization: authHeader },
      });
      const json = await res.json();
      if (res.ok && json.data?.entitlement?.isActive) {
        toast('Aboneliğiniz etkinleştirildi. Hoş geldiniz!', 'success');
        onReactivated();
        return;
      }
      toast('Ödeme henüz görünmüyor. Ödemeyi tamamladıysanız birkaç dakika sonra tekrar deneyin.', 'info');
    } catch {
      toast('Bağlantı hatası.', 'error');
    } finally {
      setChecking(false);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem(STAFF_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-background">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-5 py-10 md:py-16">
        {/* Brand */}
        <div className="mb-10 flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-md border border-border object-contain bg-white" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
            </div>
          )}
          <span className="text-sm font-semibold">{storeName || 'ReturnFlow'}</span>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Erişim kilitli
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mt-3 max-w-xl text-base text-muted-foreground">
            ReturnFlow&apos;u kullanmaya devam etmek için aboneliğinizi başlatın.
          </p>

          {/* Plan card */}
          <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">{PRO_PLAN_NAME}</p>
                <p className="mt-1 text-3xl font-extrabold">{PRO_PRICE_LABEL}</p>
              </div>
              <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                ikas üzerinden faturalandırılır
              </span>
            </div>

            <ul className="mt-5 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2.5">
              {canManageBilling ? (
                <>
                  <Button size="lg" className="w-full gap-2" onClick={startPurchase} disabled={starting}>
                    <ExternalLink className="h-4 w-4" />
                    {starting ? 'Yönlendiriliyor...' : "ReturnFlow'u Satın Al"}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={checkPayment}
                    disabled={checking}
                  >
                    <RefreshCw className={checking ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    {checking ? 'Kontrol ediliyor...' : 'Ödemeyi Kontrol Et'}
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  Aboneliği başlatmak için lütfen mağaza sahibiyle iletişime geçin.
                </div>
              )}
            </div>
          </div>

          {/* Data-safety note */}
          <p className="mt-6 max-w-xl text-sm text-muted-foreground">
            Mevcut iade talepleriniz, ayarlarınız, otomasyonlarınız ve tüm geçmiş
            verileriniz güvende. Hiçbiri silinmez — abonelik etkinleştirildiği anda
            her şey olduğu gibi yeniden erişilebilir olur.
          </p>

          {isStaff && (
            <button
              onClick={logout}
              className="mt-8 w-fit text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Çıkış Yap
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
