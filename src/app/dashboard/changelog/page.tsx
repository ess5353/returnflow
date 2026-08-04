'use client';

import { useEffect } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { cn } from '@/lib/utils';
import { GitCommitHorizontal } from 'lucide-react';

type ChangeType = 'feat' | 'fix' | 'improve' | 'security';

interface Change {
  type: ChangeType;
  text: string;
}

interface Release {
  version: string;
  date: string;
  label?: string;
  changes: Change[];
}

const TYPE_LABEL: Record<ChangeType, string> = {
  feat:     'Yeni Özellik',
  fix:      'Düzeltme',
  improve:  'İyileştirme',
  security: 'Güvenlik',
};

const TYPE_STYLE: Record<ChangeType, string> = {
  feat:     'bg-blue-50 text-blue-700 border-blue-200',
  fix:      'bg-red-50 text-red-700 border-red-200',
  improve:  'bg-amber-50 text-amber-700 border-amber-200',
  security: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const RELEASES: Release[] = [
  {
    version: '0.1.0',
    date: 'Ağustos 2026',
    label: 'İlk Sürüm',
    changes: [
      { type: 'feat', text: 'Müşteri iade ve değişim portalı' },
      { type: 'feat', text: 'Merchant dashboard — talep listesi ve detay paneli' },
      { type: 'feat', text: 'Otomasyon kuralları (koşul bazlı otomatik işlem)' },
      { type: 'feat', text: 'Webhook entegrasyonu (iade ve değişim olayları)' },
      { type: 'feat', text: 'E-posta bildirimleri ve özelleştirilebilir şablonlar' },
      { type: 'feat', text: 'Takım yönetimi — rol tabanlı erişim kontrolü' },
      { type: 'feat', text: 'Denetim günlüğü (audit log)' },
      { type: 'feat', text: 'AI Insights — iade sebep analizi' },
      { type: 'feat', text: 'API anahtarları yönetimi' },
      { type: 'feat', text: 'Analiz sayfası ve CSV dışa aktarma' },
      { type: 'feat', text: '14 günlük ücretsiz deneme + Pro plan (₺12.000/yıl)' },
      { type: 'security', text: 'HMAC-SHA256 OAuth callback doğrulama' },
      { type: 'security', text: 'Rate limiting — IP bazlı istek sınırlaması' },
      { type: 'security', text: 'JWT tabanlı session yönetimi' },
    ],
  },
];

function ChangeTag({ type }: { type: ChangeType }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', TYPE_STYLE[type])}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export default function ChangelogPage() {
  const { settings, loadSettings } = useStoreSettings();

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <GitCommitHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Değişiklik Günlüğü</h1>
            <p className="text-sm text-muted-foreground">Sürüm geçmişi ve güncellemeler</p>
          </div>
        </div>

        {/* Releases */}
        <div className="space-y-6">
          {RELEASES.map((release) => (
            <div key={release.version} className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-muted/30">
                <GitCommitHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold">v{release.version}</span>
                  {release.label && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {release.label}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{release.date}</span>
                </div>
              </div>
              <ul className="divide-y divide-border">
                {release.changes.map((change, i) => (
                  <li key={i} className="flex items-start gap-3 px-6 py-3">
                    <ChangeTag type={change.type} />
                    <span className="text-sm leading-relaxed">{change.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Yeni özellik veya hata bildirimi için{' '}
          <a href="mailto:hello@pelyx.co" className="text-primary hover:underline">
            hello@pelyx.co
          </a>{' '}
          adresine yazın.
        </p>
      </div>
    </DashboardShell>
  );
}
