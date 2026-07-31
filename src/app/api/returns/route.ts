export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── GET: list all returns for the authenticated merchant ───────────────────
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .select('*')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('returns GET error:', error);
    return NextResponse.json({ error: 'Failed to load returns' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// ── POST: create a new return (public — called from customer portal) ────────
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { merchant_id, order_id, customer_name, customer_email, product, products, reason, description, amount, media_urls } = body as {
    merchant_id: string;
    order_id: string;
    customer_name: string;
    customer_email?: string;
    product?: string;
    products?: { name: string; quantity: number; price: number }[];
    reason: string;
    description?: string;
    amount: string | number;
    media_urls?: string[];
  };

  if (!merchant_id || !order_id || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validate merchant exists
  const { data: merchantRow } = await supabaseAdmin
    .from('store_settings')
    .select('merchant_id')
    .eq('merchant_id', merchant_id)
    .maybeSingle();

  if (!merchantRow) {
    return NextResponse.json({ error: 'Invalid merchant' }, { status: 400 });
  }

  // Check for duplicate (one return per order per merchant)
  const { data: existing } = await supabaseAdmin
    .from('return_requests')
    .select('id')
    .eq('order_id', String(order_id))
    .eq('merchant_id', merchant_id);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 });
  }

  // Generate RF number (merchant-scoped daily sequence)
  const now = new Date();
  const datePart = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count } = await supabaseAdmin
    .from('return_requests')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchant_id)
    .gte('created_at', startOfDay);

  const sequence = String((count ?? 0) + 1).padStart(4, '0');
  const rf_number = `RF-${datePart}-${sequence}`;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('return_requests')
    .insert([
      {
        merchant_id,
        rf_number,
        order_id: String(order_id),
        customer_name,
        customer_email: customer_email ?? null,
        product: product ?? '',
        products: products ?? null,
        reason,
        description: description ?? null,
        amount: String(amount),
        status: 'Yeni Talep',
        media_urls: media_urls ?? [],
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error('return insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }

  return NextResponse.json({ data: inserted });
}
