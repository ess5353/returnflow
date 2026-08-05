import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStoreKey } from '@/lib/store/resolve';

export type PublicStoreSettings = {
  store_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  support_email: string | null;
  return_policy: string | null;
  operation_mode: string | null;
  return_instructions: string | null;
  contact_phone: string | null;
  return_address: string | null;
};

export async function GET(request: NextRequest) {
  const storeKey = new URL(request.url).searchParams.get('storeKey')?.trim();
  if (!storeKey) {
    return NextResponse.json({ error: 'storeKey is required' }, { status: 400 });
  }

  const merchantId = await resolveStoreKey(storeKey);
  if (!merchantId) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .select('store_name, logo_url, primary_color, support_email, return_policy, operation_mode, return_instructions, contact_phone, return_address')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error) {
    console.error('store_settings sorgusu başarısız:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  const settings: PublicStoreSettings = data ?? {
    store_name: null,
    logo_url: null,
    primary_color: null,
    support_email: null,
    return_policy: null,
    operation_mode: null,
    return_instructions: null,
    contact_phone: null,
    return_address: null,
  };

  return NextResponse.json({ data: settings });
}
