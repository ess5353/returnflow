import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStoreKey } from '@/lib/store/resolve';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const email = searchParams.get('email')?.trim() ?? '';
  const storeKey = searchParams.get('storeKey')?.trim() ?? '';

  if (!q || !email || !storeKey) {
    return NextResponse.json({ error: 'q, email, and storeKey are required' }, { status: 400 });
  }

  // Validate q to prevent PostgREST filter injection
  if (!/^[A-Za-z0-9#.\-]{1,50}$/.test(q)) {
    return NextResponse.json({ error: 'Invalid query format' }, { status: 400 });
  }

  // Validate email length and basic format
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
  }

  const merchantId = await resolveStoreKey(storeKey);
  if (!merchantId) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .select('id, rf_number, order_id, customer_name, reason, description, admin_note, amount, status, created_at, products, media_urls, request_type, exchange_type, exchange_variant, carrier, tracking_number, shipping_status, shipping_date, delivered_date')
    .or(`order_id.eq.${q},rf_number.eq.${q}`)
    .ilike('customer_email', email)
    .eq('merchant_id', merchantId);

  if (error) {
    console.error('Track search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
