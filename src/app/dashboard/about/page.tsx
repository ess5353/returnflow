'use client';

import { useEffect } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ArrowLeftRight, ExternalLink, Github, Globe, Mail, Shield, Zap } from 'lucide-react';

const VERSION = '0.1.0';
const BUILD_DATE = '2026';

const FEATURES = [
  { icon: ArrowLeftRight, label: 'İade & Değişim Yönetimi', desc: 'Müşteri taleplerini tek panelden takip edin.' },
  { icon: Zap, label: 'Otomasyon Kuralları', desc: 'Koşul bazlı otomatik onay, red ve etiketleme.' },
  { icon: Mail, label: 'E-posta Bildirimleri', desc: 'Özelleştirilebilir şablonlarla müşteri bildirimleri.' },
  { icon: Shield, label: 'Rol Tabanlı Erişim', desc: 'Takım üyelerine kısıtlı yetkiler tanımlayın.' },
  { icon: Globe, label: 'Webhook Entegrasyonu', desc: 'Harici sistemlere gerçek zamanlı olay bildirimi.' },
];

export default function AboutPage() {
  const { settings, loadSettings } = useStoreSettings();

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
            <ArrowLeftRight className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">ReturnFlow</h1>
            <p className="text-sm text-muted-foreground">ikas için iade ve değişim yönetim uygulaması</p>
          </div>
        </div>

        {/* Version card */}
        <div className="rounded-xl border border-border bg-card p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Versiyon</p>
              <p className="mt-1 font-mono text-lg font-bold">v{VERSION}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Platform</p>
              <p className="mt-1 font-semibold">ikas App Store</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Geliştirici</p>
              <p className="mt-1 font-semibold">Pelyx</p>
            </div>
          </div>
        </div>

        {/* About text */}
        <div className="rounded-xl border border-border bg-card p-6 space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">ReturnFlow</strong>, ikas mağazanızın iade ve değişim süreçlerini
            kolaylaştırmak için tasarlanmış bir yönetim uygulamasıdır. Müşterileriniz kendi iade taleplerini
            oluşturabilir; siz de bu talepleri tek bir panelden takip edip yönetebilirsiniz.
          </p>
          <p>
            Otomasyon kuralları, webhook entegrasyonu ve takım yönetimi özellikleriyle işlemlerinizi
            otomatikleştirin ve ekibinizle verimli biçimde çalışın.
          </p>
        </div>

        {/* Features */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-semibold">Temel Özellikler</p>
          </div>
          <div className="divide-y divide-border">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4 px-6 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:hello@pelyx.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <Mail className="h-4 w-4 text-muted-foreground" />
            hello@pelyx.co
          </a>
          <a
            href="https://pelyx.co"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <Globe className="h-4 w-4 text-muted-foreground" />
            pelyx.co
            <ExternalLink className="h-3 w-3 text-muted-foreground" />
          </a>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          &copy; {BUILD_DATE} Pelyx. Tüm hakları saklıdır.
        </p>
      </div>
    </DashboardShell>
  );
}
