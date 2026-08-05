export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Resend } from 'resend';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { resolveStoreKey } from '@/lib/store/resolve';
import { sendReturnEmail } from '@/lib/email/send';
import { createNotification } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';
import { createAuditLog } from '@/lib/audit/log';
import { rateLimit, getClientIp, LIMITS } from '@/lib/security/rate-limit';
import { getBillingEntitlement } from '@/lib/billing/entitlement';
import { evaluateAndApplyAutomation } from '@/lib/automation/evaluate';

const returnSchema = z.object({
  store_key:       z.string().min(1).max(100),
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
    .order('created_at', { ascending: false })
    .limit(200);

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
    store_key,
    order_id, customer_name, customer_email, product, products,
    reason, description, amount, media_urls,
    request_type, exchange_type, exchange_variant,
  } = parsed.data;

  const rType = request_type ?? 'return';

  // Resolve merchant_id from store_key — never trust a client-supplied merchant_id.
  const merchant_id = await resolveStoreKey(store_key);
  if (!merchant_id) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // Compute startOfDay before parallel queries (synchronous)
  const now = new Date();
  const datePart = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  // Run mode check, billing, duplicate check, and sequence count in parallel
  const [{ data: merchantSettings }, entitlement, { data: existing }, { count }] = await Promise.all([
    supabaseAdmin
      .from('store_settings')
      .select('operation_mode')
      .eq('merchant_id', merchant_id)
      .maybeSingle(),
    getBillingEntitlement(merchant_id),
    supabaseAdmin
      .from('return_requests')
      .select('id')
      .eq('order_id', String(order_id))
      .eq('merchant_id', merchant_id)
      .eq('request_type', rType),
    supabaseAdmin
      .from('return_requests')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', merchant_id)
      .eq('request_type', rType)
      .gte('created_at', startOfDay),
  ]);

  const opMode = merchantSettings?.operation_mode ?? 'both';
  if (opMode === 'return_only' && rType === 'exchange') {
    return NextResponse.json({ error: 'Bu mağaza yalnızca iade taleplerini kabul etmektedir.' }, { status: 400 });
  }
  if (opMode === 'exchange_only' && rType === 'return') {
    return NextResponse.json({ error: 'Bu mağaza yalnızca değişim taleplerini kabul etmektedir.' }, { status: 400 });
  }

  if (entitlement.isExpired) {
    return NextResponse.json(
      { error: 'Subscription expired', code: 'PLAN_EXPIRED', upgrade_required: true },
      { status: 403 },
    );
  }

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: 'DUPLICATE' }, { status: 409 });
  }

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

  // Fire-and-forget: customer confirmation email
  sendReturnEmail({
    merchantId: merchant_id,
    returnId: inserted.id,
    templateType: rType === 'exchange' ? 'exchange_received' : 'return_received',
  }).catch(() => undefined);

  // Fire-and-forget: run automation rules server-side
  if (rType === 'return') {
    evaluateAndApplyAutomation(inserted.id, merchant_id).catch(() => undefined);
  }

  // Fire-and-forget: notify merchant via email (never sends to a hardcoded address)
  (async () => {
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL;
      if (!fromEmail) {
        console.error('RESEND_FROM_EMAIL is not set — skipping merchant notification email');
        return;
      }
      if (!process.env.RESEND_API_KEY) return;

      const { data: storeSettings } = await supabaseAdmin
        .from('store_settings')
        .select('notification_email, store_name')
        .eq('merchant_id', merchant_id)
        .maybeSingle();

      const notifEmail = storeSettings?.notification_email;
      if (!notifEmail) return;

      const resend = new Resend(process.env.RESEND_API_KEY);
      const typeLabel = rType === 'exchange' ? 'Değişim' : 'İade';

      // Escape user-supplied values before embedding in HTML
      const esc = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      await resend.emails.send({
        from: `${esc(storeSettings?.store_name ?? 'ReturnFlow')} <${fromEmail}>`,
        to: [notifEmail],
        subject: `Yeni ${typeLabel} Talebi: ${rf_number}`,
        html: `<p><strong>${esc(customer_name)}</strong> tarafından yeni bir ${typeLabel.toLowerCase()} talebi oluşturuldu.</p><p>Talep No: <strong>${esc(rf_number)}</strong></p><p>Sipariş: ${esc(String(order_id))}</p>`,
      });
    } catch { /* noop — notification is best-effort */ }
  })();

  return NextResponse.json({ data: inserted });
}
