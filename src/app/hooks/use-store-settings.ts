'use client';

import { useState, useCallback } from 'react';
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
      if (!token) return;

      const res = await fetch('/api/settings', {
        headers: { Authorization: `JWT ${token}` },
      });
      const result = await res.json();
      if (result.data) {
        setSettings(result.data as StoreSettings);
      }
    } catch (err) {
      console.error('Settings yüklenemedi:', err);
    }
  }, []);

  return { settings, loadSettings };
}
