'use client';

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { TokenHelpers } from '@/helpers/token-helpers';

export type StoreSettings = {
  merchant_id: string;
  store_name: string | null;
  logo_url: string | null;
  notification_email: string | null;
  support_email: string | null;
  primary_color: string | null;
  return_address: string | null;
  return_policy: string | null;
};

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      const response = await fetch('/api/ikas/get-merchant', {
        headers: { Authorization: `JWT ${token}` },
      });
      const result = await response.json();

      const merchantId = result?.data?.merchantInfo?.id as string | undefined;
      if (!merchantId) return;

      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (data) {
        setSettings(data as StoreSettings);
      }
    } catch (err) {
      console.error('Settings yüklenemedi:', err);
    }
  }, []);

  return { settings, loadSettings };
}
