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
  store_key: string | null;
  operation_mode: 'both' | 'return_only' | 'exchange_only' | null;
};

// Module-level cache persists across client-side page navigations,
// preventing the logo/store-name flicker on each route change.
let _cachedSettings: StoreSettings | null = null;

export function invalidateSettingsCache() {
  _cachedSettings = null;
}

export function useStoreSettings() {
  const [settings, setSettings] = useState<StoreSettings | null>(_cachedSettings);

  const loadSettings = useCallback(async () => {
    if (_cachedSettings) {
      setSettings(_cachedSettings);
      return;
    }
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      if (!token) return;

      const res = await fetch('/api/settings', {
        headers: { Authorization: `JWT ${token}` },
      });
      const result = await res.json();
      if (result.data) {
        _cachedSettings = result.data as StoreSettings;
        setSettings(_cachedSettings);
      }
    } catch {
      // silently fail — settings are non-critical for dashboard function
    }
  }, []);

  const invalidateCache = useCallback(() => {
    _cachedSettings = null;
  }, []);

  return { settings, loadSettings, invalidateCache };
}
