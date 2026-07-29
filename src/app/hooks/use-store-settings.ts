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
    console.log('[useStoreSettings] STEP 1: loadSettings called');
    try {
      const token = await TokenHelpers.getTokenForIframeApp();
      console.log('[useStoreSettings] STEP 2: token =', token);

      const response = await fetch('/api/ikas/get-merchant', {
        headers: { Authorization: `JWT ${token}` },
      });
      console.log('[useStoreSettings] STEP 3: HTTP status =', response.status);

      const result = await response.json();
      console.log('[useStoreSettings] STEP 4: full result =', JSON.stringify(result));

      const merchantId = result?.data?.merchantInfo?.id as string | undefined;
      console.log('[useStoreSettings] STEP 5: merchantId =', merchantId);

      if (!merchantId) {
        console.log('[useStoreSettings] STEP 5 FAIL: merchantId is falsy, returning early');
        return;
      }

      console.log('[useStoreSettings] STEP 6: running Supabase query for merchant_id =', merchantId);
      const { data, error } = await supabase
        .from('store_settings')
        .select('*')
        .eq('merchant_id', merchantId)
        .maybeSingle();
      console.log('[useStoreSettings] STEP 7: Supabase data =', JSON.stringify(data), '| error =', JSON.stringify(error));

      if (data) {
        console.log('[useStoreSettings] STEP 8: calling setSettings with', JSON.stringify(data));
        setSettings(data as StoreSettings);
      } else {
        console.log('[useStoreSettings] STEP 8 FAIL: data is null/undefined, setSettings NOT called');
      }
    } catch (err) {
      console.error('[useStoreSettings] CAUGHT ERROR:', err);
    }
  }, []);

  return { settings, loadSettings };
}
