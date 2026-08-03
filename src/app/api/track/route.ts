import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() ?? '';
  const email = searchParams.get('email')?.trim() ?? '';

  if (!q || !email) {
    return NextResponse.json({ error: 'q and email are required' }, { status: 400 });
  }

  // Validate q to prevent PostgREST filter injection
  if (!/^[A-Za-z0-9#.\-]{1,50}$/.test(q)) {
    return NextResponse.json({ error: 'Invalid query format' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .select('id, rf_number, order_id, customer_name, reason, description, admin_note, amount, status, created_at, products, media_urls, request_type, exchange_type, exchange_variant, carrier, tracking_number, shipping_status, shipping_date, delivered_date')
    .or(`order_id.eq.${q},rf_number.eq.${q}`)
    .ilike('customer_email', email);

  if (error) {
    console.error('Track search error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
