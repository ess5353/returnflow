import { NextResponse } from 'next/server';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export type PublicStoreSettings = {
  merchant_id: string;
  store_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  support_email: string | null;
  return_policy: string | null;
};

export async function GET() {
  try {
    const tokens = await AuthTokenManager.list();
    const authToken = tokens.find((t) => !t.deleted);

    if (!authToken) {
      return NextResponse.json({ error: 'No auth token' }, { status: 404 });
    }

    const ikas = getIkas(authToken);
    const merchantResponse = await ikas.queries.getMerchant();
    const merchantId = merchantResponse.data?.getMerchant?.id;

    if (!merchantId) {
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('store_settings')
      .select('merchant_id, store_name, logo_url, primary_color, support_email, return_policy')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (error) {
      console.error('store_settings sorgusu başarısız:', error);
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }

    // Always return merchant_id even when no settings row exists yet.
    // This ensures the customer portal can always submit returns correctly.
    const settings: PublicStoreSettings = data ?? {
      merchant_id: merchantId,
      store_name: null,
      logo_url: null,
      primary_color: null,
      support_email: null,
      return_policy: null,
    };

    return NextResponse.json({ data: settings });
  } catch (err) {
    console.error('store-settings hatası:', err);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}
