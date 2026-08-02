export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';
import { createAuditLog } from '@/lib/audit/log';
import { rateLimit, getClientIp, LIMITS } from '@/lib/security/rate-limit';
import { getBillingEntitlement } from '@/lib/billing/entitlement';

const returnSchema = z.object({
  order_id:        z.string().min(1).max(100),
  customer_name:   z.string().min(1).max(200),
  customer_email:  z.string().email().max(254).optional(),
  product:         z.string().max(500).optional(),
  products:        z.array(z.object({
    name:     z.string().max(200),
    quantity: z.number().int().min(1).max(999),
    price:    z.number().min(0),
  })).max(50).optional(),
  reason:          z.string().min(1).max(500),
  description:     z.string().max(2000).optional(),
  amount:          z.union([z.string().max(50), z.number()]),
  media_urls:      z.array(z.string().url().max(2048)).max(10).optional(),
  request_type:    z.enum(['return', 'exchange']).optional(),
  exchange_type:   z.enum(['same_product_size', 'same_product_color', 'different_product']).optional(),
  exchange_variant: z.string().max(500).optional(),
});

// ── GET: list all returns for the authenticated merchant ───────────────────
export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('returns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
  // Rate limit: 5 submissions per IP per minute
  const ip = getClientIp(request);
  const rl = rateLimit(`returns.submit:${ip}`, LIMITS.returns.max, LIMITS.returns.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests, please try again shortly' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = returnSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const {
    order_id, customer_name, customer_email, product, products,
    reason, description, amount, media_urls,
    request_type, exchange_type, exchange_variant,
  } = parsed.data;

  const rType = request_type ?? 'return';

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
    console.error('returns POST: merchant_id could not be resolved');
    return NextResponse.json({ error: 'Merchant not found' }, { status: 500 });
  }

  // Billing gate — block if trial expired or subscription cancelled
  const entitlement = await getBillingEntitlement(merchant_id);
  if (entitlement.isExpired) {
    return NextResponse.json(
      { error: 'Subscription expired', code: 'PLAN_EXPIRED', upgrade_required: true },
      { status: 403 },
    );
  }

  // One return OR one exchange per order per merchant (not two of the same type)
  const { data: existing } = await supabaseAdmin
    .from('return_requests')
    .select('id')
    .eq('order_id', String(order_id))
    .eq('merchant_id', merchant_id)
    .eq('request_type', rType);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 });
  }

  // Generate number (merchant + type scoped daily sequence)
  const now = new Date();
  const datePart = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { count } = await supabaseAdmin
    .from('return_requests')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', merchant_id)
    .eq('request_type', rType)
    .gte('created_at', startOfDay);

  const sequence = String((count ?? 0) + 1).padStart(4, '0');
  const prefix = rType === 'exchange' ? 'EX' : 'RF';
  const rf_number = `${prefix}-${datePart}-${sequence}`;

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
    request_type: rType,
    exchange_type: rType === 'exchange' ? (exchange_type ?? null) : null,
    exchange_variant: rType === 'exchange' ? (exchange_variant ?? null) : null,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('return_requests')
    .insert([insertPayload])
    .select()
    .single();

  if (insertError) {
    console.error('returns POST insert error:', insertError);
    return NextResponse.json({ error: 'Failed to create return' }, { status: 500 });
  }

  createNotification({
    merchantId: merchant_id,
    type: rType === 'exchange' ? 'new_exchange' : 'new_return',
    title: rType === 'exchange' ? `Yeni Değişim: ${rf_number}` : `Yeni İade: ${rf_number}`,
    message: `${customer_name} · Sipariş ${order_id}`,
    relatedReturnId: inserted.id,
  });

  createAuditLog({
    merchantId: merchant_id,
    user: 'Müşteri',
    action: rType === 'exchange' ? 'exchange.created' : 'return.created',
    entityType: rType === 'exchange' ? 'exchange' : 'return',
    entityId: inserted.id,
    metadata: { rf_number, order_id: String(order_id), customer_name, amount: String(amount) },
  });

  triggerWebhookEvent(merchant_id, rType === 'exchange' ? 'exchange.created' : 'return.created', {
    id: inserted.id,
    rf_number,
    order_id: String(order_id),
    customer_name,
    customer_email: customer_email ?? null,
    product: product ?? '',
    reason,
    status: 'Yeni Talep',
    request_type: rType,
    amount: String(amount),
  }).catch(() => undefined);

  return NextResponse.json({ data: inserted });
}
