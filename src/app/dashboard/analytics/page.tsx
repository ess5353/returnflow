'use client';

import { useEffect } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { BarChart2 } from 'lucide-react';

export default function AnalyticsPage() {
  const { settings, loadSettings } = useStoreSettings();

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 md:p-8">
        <h1 className="text-2xl font-bold tracking-tight">Analiz</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">İade istatistikleri ve analizler yakında burada görünecek.</p>

        <div className="mt-16 flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <BarChart2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Yakında Geliyor</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Detaylı iade analizleri, trend grafikleri ve müşteri içgörüleri bu sayfada yer alacak.
            </p>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
