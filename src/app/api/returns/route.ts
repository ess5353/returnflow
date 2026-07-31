export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
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

  const { order_id, customer_name, customer_email, product, products, reason, description, amount, media_urls } = body as {
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

  if (!order_id || !reason) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Derive merchant_id server-side from the stored auth token — never trust the client.
  const tokens = await AuthTokenManager.list();
  const activeToken = tokens.find((t) => !t.deleted);

  if (!activeToken) {
    return NextResponse.json({ error: 'Store not configured' }, { status: 503 });
  }

  let merchant_id: string = activeToken.merchantId ?? '';
  if (!merchant_id) {
    const ikas = getIkas(activeToken);
    const merchantResponse = await ikas.queries.getMerchant();
    merchant_id = merchantResponse.data?.getMerchant?.id ?? '';
  }

  if (!merchant_id) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 500 });
  }

  console.error('[DEBUG] activeMerchantId:', JSON.stringify(merchant_id));

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

  const insertPayload = {
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
  };

  console.error('[DEBUG] insertPayload:', JSON.stringify(insertPayload));

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('return_requests')
    .insert([insertPayload])
    .select()
    .single();

  if (insertError) {
    console.error('[DEBUG] insertError:', JSON.stringify(insertError));
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }

  console.error('[DEBUG] inserted row:', JSON.stringify(inserted));

  return NextResponse.json({ data: inserted });
}
