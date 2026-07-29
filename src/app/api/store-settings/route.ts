import { NextResponse } from 'next/server';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type PublicStoreSettings = {
  store_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  support_email: string | null;
  return_policy: string | null;
};

export async function GET() {
  try {
    console.log('[store-settings] STEP A: handler called');

    const tokens = await AuthTokenManager.list();
    const authToken = tokens.find((t) => !t.deleted);
    console.log('[store-settings] STEP B: authToken found =', !!authToken);

    if (!authToken) {
      return NextResponse.json({ error: 'No auth token' }, { status: 404 });
    }

    const ikas = getIkas(authToken);
    const merchantResponse = await ikas.queries.getMerchant();
    const merchantId = merchantResponse.data?.getMerchant?.id;
    console.log('[store-settings] STEP C: merchantId =', merchantId);

    if (!merchantId) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('store_settings')
      .select('store_name, logo_url, primary_color, support_email, return_policy')
      .eq('merchant_id', merchantId)
      .maybeSingle();
    console.log('[store-settings] STEP D: supabase data =', JSON.stringify(data), '| error =', JSON.stringify(error));

    return NextResponse.json({ data: data ?? null });
  } catch (err) {
    console.error('[store-settings] ERROR:', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
