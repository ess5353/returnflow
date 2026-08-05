'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, ArrowRight, Check, Copy, Globe, Mail, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

const STORAGE_KEY = 'pelyx_onboarding_done';

interface Step {
  icon: React.ElementType;
  title: string;
  desc: string;
  action?: React.ReactNode;
}

function buildSteps(portalUrl: string | null): Step[] {
  return [
    {
      icon: ArrowLeftRight,
      title: "ReturnFlow'a Hoş Geldiniz",
      desc: 'Mağazanızın iade ve değişim süreçlerini kolaylaştırmak için buradayız. Bu kısa kurulum sihirbazı sizi 3 adımda hazır hale getirecek.',
    },
    {
      icon: Globe,
      title: 'Müşteri Portal Linkinizi Paylaşın',
      desc: 'Müşterileriniz bu link üzerinden iade veya değişim talebinde bulunabilir. Linki sipariş onay e-postalarınıza veya web sitenize ekleyin.',
      action: portalUrl ? (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted p-3">
          <code className="flex-1 truncate text-xs text-muted-foreground">{portalUrl}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(portalUrl); toast('Portal linki kopyalandı', 'success'); }}
            className="shrink-0 rounded-md p-1.5 hover:bg-muted-foreground/10 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          Portal linkiniz yükleniyor — Ayarlar sayfasından da kopyalayabilirsiniz.
        </div>
      ),
    },
    {
      icon: Mail,
      title: 'E-posta Bildirimlerini Ayarlayın',
      desc: 'Yeni iade talebi geldiğinde e-posta almak için Ayarlar sayfasından bildirim e-postanızı ekleyin.',
    },
    {
      icon: Zap,
      title: 'Otomasyon Kuralı Oluşturun (İsteğe Bağlı)',
      desc: 'Belirli koşullara göre talepleri otomatik onaylayan, reddeden veya etiketleyen kurallar tanımlayabilirsiniz. Otomasyon sayfasından başlayın.',
    },
  ];
}

export function OnboardingWizard({ storeKey }: { storeKey?: string | null }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const STEPS = useMemo(
    () => buildSteps(storeKey ? `${process.env.NEXT_PUBLIC_DEPLOY_URL ?? ''}/returns/${storeKey}` : null),
    [storeKey],
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      const timer = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      handleClose();
    }
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl animate-in fade-in zoom-in-95 duration-200 focus:outline-none">

          {/* Progress dots */}
          <div className="flex items-center gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted',
                )}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-5">
            <Icon className="h-6 w-6 text-primary" />
          </div>

          {/* Content */}
          <Dialog.Title className="text-lg font-bold">{current.title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {current.desc}
          </Dialog.Description>

          {current.action && current.action}

          {/* Actions */}
          <div className="mt-7 flex items-center justify-between">
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Atla
            </button>
            <Button onClick={handleNext} className="gap-2">
              {isLast ? (
                <>
                  <Check className="h-4 w-4" />
                  Başla
                </>
              ) : (
                <>
                  Devam
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
