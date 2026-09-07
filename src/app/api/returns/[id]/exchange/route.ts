export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requireActiveEntitlement } from '@/lib/billing/guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { createAuditLog, getIp } from '@/lib/audit/log';
import { createNotification } from '@/lib/notifications/create';

// Exchanges have no dedicated "exchange" mutation in the ikas Admin API —
// there is no officially supported single call that both returns an item and
// creates its replacement atomically. This endpoint composes the two real,
// officially supported operations that exist (cancelOrderLine and
// createOrderWithTransactions) as two separate, independently idempotent
// steps, exactly as the ikas schema exposes them. It never fabricates a
// card charge: ikas has no generic "charge customer for arbitrary amount"
// API available to apps, so any price difference must be described by the
// merchant (how it was actually collected/settled), not invented here.

const STALE_MS = 2 * 60 * 1000;

type StoredProduct = { order_line_item_id?: string; quantity?: number };

type ReturnRow = {
  id: string;
  merchant_id: string;
  rf_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  request_type: string | null;
  ikas_order_id: string | null;
  products: StoredProduct[] | null;
  exchange_return_leg_status: string;
  exchange_replacement_status: string;
};

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Bilinmeyen hata';
  return raw.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, '[redacted]').slice(0, 500);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireActiveEntitlement(user.merchantId);
  if (gate) return gate;
  if (!user.can('returns.refund')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  let body: {
    action?: 'return_leg' | 'create_replacement';
    restockItems?: boolean;
    replacement?: { variantId: string; variantName: string; quantity: number; unitPrice: number; collectedAmount?: number; note?: string };
  } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { data: ret, error: fetchError } = await supabaseAdmin
    .from('return_requests')
    .select('id, merchant_id, rf_number, customer_name, customer_email, request_type, ikas_order_id, products, exchange_return_leg_status, exchange_replacement_status')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .maybeSingle<ReturnRow>();

  if (fetchError) return NextResponse.json({ error: 'Sorgu başarısız' }, { status: 500 });
  if (!ret) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });
  if (ret.request_type !== 'exchange') return NextResponse.json({ error: 'Bu talep bir değişim talebi değil' }, { status: 400 });
  if (!ret.ikas_order_id) {
    return NextResponse.json({ error: 'Bu talep gerekli sipariş bilgisini içermiyor. Lütfen ikas panelinden manuel işlem yapın.', code: 'MISSING_ORDER_LINK' }, { status: 422 });
  }

  const authToken = await AuthTokenManager.getByMerchantId(user.merchantId);
  if (!authToken) return NextResponse.json({ error: 'Mağaza yetkilendirmesi bulunamadı. Lütfen uygulamayı yeniden bağlayın.' }, { status: 503 });
  const ikas = getIkas(authToken);

  // ── Action 1: cancel + restock the original item(s) — the "return leg" ────
  if (body.action === 'return_leg') {
    if (ret.exchange_return_leg_status === 'succeeded') {
      return NextResponse.json({ error: 'Orijinal ürün iadesi zaten tamamlanmış.', code: 'ALREADY_DONE' }, { status: 409 });
    }
    const stale = new Date(Date.now() - STALE_MS).toISOString();
    const { data: claimed } = await supabaseAdmin
      .from('return_requests')
      .update({ exchange_return_leg_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', id).eq('merchant_id', user.merchantId)
      .neq('exchange_return_leg_status', 'succeeded')
      .or(`exchange_return_leg_status.neq.processing,updated_at.lt.${stale}`)
      .select('id').maybeSingle();
    if (!claimed) return NextResponse.json({ error: 'Bu işlem zaten devam ediyor veya tamamlanmış.', code: 'IN_PROGRESS' }, { status: 409 });

    const storedProducts = Array.isArray(ret.products) ? ret.products : [];
    const lines = storedProducts.filter((p) => !!p.order_line_item_id);
    if (lines.length === 0) {
      await supabaseAdmin.from('return_requests').update({ exchange_return_leg_status: 'failed' }).eq('id', id).eq('merchant_id', user.merchantId);
      return NextResponse.json({ error: 'Sipariş kalemi bilgisi bulunamadı. Lütfen ikas panelinden manuel işlem yapın.' }, { status: 422 });
    }

    try {
      const orderResp = await ikas.queries.getOrderForRefund({ id: { eq: ret.ikas_order_id } });
      const liveOrder = orderResp.data?.listOrder?.data?.[0];
      if (!liveOrder) throw new Error('Sipariş bulunamadı');

      const orderLineItems = lines.map((p) => {
        const live = liveOrder.orderLineItems?.find((l) => l.id === p.order_line_item_id);
        if (!live) throw new Error(`Sipariş kalemi bulunamadı: ${p.order_line_item_id}`);
        const qty = Math.min(Number(p.quantity ?? 1), live.quantity);
        return { orderLineItemId: live.id, price: live.finalUnitPrice ?? live.price, quantity: qty, restockItems: body.restockItems ?? true };
      });

      const cancelResp = await ikas.mutations.cancelOrderLine({ input: { orderId: ret.ikas_order_id, orderLineItems } });
      if (!cancelResp.isSuccess || !cancelResp.data?.cancelOrderLine) {
        throw new Error(cancelResp.error ?? cancelResp.errors?.[0]?.message ?? 'ikas iptal işlemini reddetti');
      }

      await supabaseAdmin
        .from('return_requests')
        .update({ exchange_return_leg_status: 'succeeded', exchange_return_leg_completed_at: new Date().toISOString() })
        .eq('id', id).eq('merchant_id', user.merchantId);

      createAuditLog({
        merchantId: user.merchantId, user: user.memberId ?? 'Mağaza', action: 'exchange.return_leg_completed',
        entityType: 'exchange', entityId: id, metadata: { rf_number: ret.rf_number }, ipAddress: getIp(request),
      });

      return NextResponse.json({ data: { returnLegCompleted: true } });
    } catch (e) {
      await supabaseAdmin.from('return_requests').update({ exchange_return_leg_status: 'failed' }).eq('id', id).eq('merchant_id', user.merchantId);
      createAuditLog({
        merchantId: user.merchantId, user: user.memberId ?? 'Mağaza', action: 'exchange.return_leg_failed',
        entityType: 'exchange', entityId: id, metadata: { rf_number: ret.rf_number, reason: sanitizeErrorMessage(e) }, ipAddress: getIp(request),
      });
      return NextResponse.json({ error: 'Orijinal ürünün iptal/iade işlemi başarısız oldu.', code: 'IKAS_CANCEL_FAILED' }, { status: 502 });
    }
  }

  // ── Action 2: create the real replacement order in ikas ───────────────────
  if (body.action === 'create_replacement') {
    if (ret.exchange_replacement_status === 'succeeded') {
      return NextResponse.json({ error: 'Değişim siparişi zaten oluşturulmuş.', code: 'ALREADY_DONE' }, { status: 409 });
    }
    const r = body.replacement;
    if (!r || !r.variantId || !r.variantName || !r.quantity || r.unitPrice == null) {
      return NextResponse.json({ error: 'Değişim ürünü bilgileri eksik (variantId, variantName, quantity, unitPrice gerekli).' }, { status: 400 });
    }

    const stale = new Date(Date.now() - STALE_MS).toISOString();
    const { data: claimed } = await supabaseAdmin
      .from('return_requests')
      .update({ exchange_replacement_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', id).eq('merchant_id', user.merchantId)
      .neq('exchange_replacement_status', 'succeeded')
      .or(`exchange_replacement_status.neq.processing,updated_at.lt.${stale}`)
      .select('id').maybeSingle();
    if (!claimed) return NextResponse.json({ error: 'Bu işlem zaten devam ediyor veya tamamlanmış.', code: 'IN_PROGRESS' }, { status: 409 });

    try {
      const [firstName, ...rest] = (ret.customer_name ?? '').split(' ');
      const createResp = await ikas.mutations.createOrderWithTransactions({
        input: {
          order: {
            note: `ReturnFlow değişim siparişi — orijinal talep ${ret.rf_number}`,
            customer: ret.customer_email ? { email: ret.customer_email, firstName: firstName || undefined, lastName: rest.join(' ') || undefined } : undefined,
            orderLineItems: [{ price: r.unitPrice, quantity: r.quantity, variant: { id: r.variantId, name: r.variantName } }],
          },
          // amount reflects only what the merchant confirms was actually
          // collected outside ikas (e.g. a manual payment link, in person,
          // or "0" for an even/no-cost swap) — never a fabricated charge.
          transactions: [{ amount: r.collectedAmount ?? 0 }],
        },
      });

      if (!createResp.isSuccess || !createResp.data?.createOrderWithTransactions) {
        throw new Error(createResp.error ?? createResp.errors?.[0]?.message ?? 'ikas sipariş oluşturmayı reddetti');
      }

      const created = createResp.data.createOrderWithTransactions;
      await supabaseAdmin
        .from('return_requests')
        .update({
          exchange_replacement_status: 'succeeded',
          exchange_replacement_order_id: created.id,
          exchange_replacement_completed_at: new Date().toISOString(),
        })
        .eq('id', id).eq('merchant_id', user.merchantId);

      createAuditLog({
        merchantId: user.merchantId, user: user.memberId ?? 'Mağaza', action: 'exchange.replacement_created',
        entityType: 'exchange', entityId: id, metadata: { rf_number: ret.rf_number, replacement_order_id: created.id, replacement_order_number: created.orderNumber }, ipAddress: getIp(request),
      });
      createNotification({
        merchantId: user.merchantId, type: 'exchange_completed',
        title: `Değişim Siparişi Oluşturuldu: ${ret.rf_number}`, message: created.orderNumber ?? created.id, relatedReturnId: id,
      });

      return NextResponse.json({ data: { replacementOrderId: created.id, replacementOrderNumber: created.orderNumber } });
    } catch (e) {
      await supabaseAdmin
        .from('return_requests')
        .update({ exchange_replacement_status: 'failed', exchange_replacement_failure_reason: sanitizeErrorMessage(e) })
        .eq('id', id).eq('merchant_id', user.merchantId);
      createAuditLog({
        merchantId: user.merchantId, user: user.memberId ?? 'Mağaza', action: 'exchange.replacement_failed',
        entityType: 'exchange', entityId: id, metadata: { rf_number: ret.rf_number, reason: sanitizeErrorMessage(e) }, ipAddress: getIp(request),
      });
      return NextResponse.json({ error: 'Değişim siparişi ikas üzerinde oluşturulamadı.', code: 'IKAS_CREATE_ORDER_FAILED' }, { status: 502 });
    }
  }

  return NextResponse.json({ error: 'Geçersiz işlem' }, { status: 400 });
}
