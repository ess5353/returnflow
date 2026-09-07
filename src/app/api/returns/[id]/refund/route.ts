export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requireActiveEntitlement } from '@/lib/billing/guard';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { createNotification } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';
import { createAuditLog, getIp } from '@/lib/audit/log';
import { sendReturnEmail } from '@/lib/email/send';

// A "processing" claim older than this is treated as abandoned (crashed
// request, timed-out lambda, etc.) and becomes retryable again — this is the
// only way out of "processing" besides a real success/failure result, so a
// stuck row can never block refunds forever.
const STALE_PROCESSING_MS = 2 * 60 * 1000;

type StoredProduct = {
  name?: string;
  quantity?: number;
  price?: number;
  order_line_item_id?: string;
  sku?: string;
};

type ReturnRow = {
  id: string;
  merchant_id: string;
  rf_number: string | null;
  reason: string | null;
  customer_email: string | null;
  request_type: string | null;
  ikas_order_id: string | null;
  products: StoredProduct[] | null;
  refund_status: string;
  refund_started_at: string | null;
};

function sanitizeErrorMessage(err: unknown): string {
  // Never leak tokens/secrets/internal stack traces to the merchant-facing
  // response or to the DB failure-reason column. Keep only a short, safe
  // description of what ikas reported.
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

  let body: { lineItems?: Array<{ order_line_item_id: string; quantity: number }>; restockItems?: boolean } = {};
  try {
    const raw = await request.text();
    if (raw) body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── 1. Load the return, scoped to this merchant ───────────────────────────
  const { data: ret, error: fetchError } = await supabaseAdmin
    .from('return_requests')
    .select('id, merchant_id, rf_number, reason, customer_email, request_type, ikas_order_id, products, refund_status, refund_started_at')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .maybeSingle<ReturnRow>();

  if (fetchError) return NextResponse.json({ error: 'Sorgu başarısız' }, { status: 500 });
  if (!ret) return NextResponse.json({ error: 'Talep bulunamadı' }, { status: 404 });

  if (ret.refund_status === 'succeeded') {
    return NextResponse.json({ error: 'Bu talep için para iadesi zaten tamamlanmış.', code: 'ALREADY_REFUNDED' }, { status: 409 });
  }

  if (!ret.ikas_order_id) {
    return NextResponse.json(
      {
        error:
          'Bu talep otomatik para iadesi için gerekli sipariş bilgisini içermiyor (muhtemelen bu özellik eklenmeden önce oluşturulmuş). Lütfen ikas panelinden manuel olarak iade işlemi yapın.',
        code: 'MISSING_ORDER_LINK',
      },
      { status: 422 },
    );
  }

  const storedProducts = Array.isArray(ret.products) ? ret.products : [];
  const recordedByLine = new Map(storedProducts.filter((p) => !!p.order_line_item_id).map((p) => [p.order_line_item_id as string, Number(p.quantity ?? 1)]));

  // A caller-supplied lineItems body may only reference line items that were
  // actually part of *this* return request, and may never request more than
  // the quantity recorded when the return was created — it can only narrow
  // the default (e.g. partially refund a multi-item return), never widen it
  // to an unrelated line item on the same ikas order or a larger quantity.
  const requestedLines = (
    body.lineItems && body.lineItems.length > 0
      ? body.lineItems.filter((l) => recordedByLine.has(l.order_line_item_id))
      : Array.from(recordedByLine.entries()).map(([order_line_item_id, quantity]) => ({ order_line_item_id, quantity }))
  ).map((l) => ({ order_line_item_id: l.order_line_item_id, quantity: Math.min(Number(l.quantity), recordedByLine.get(l.order_line_item_id)!) }));

  if (requestedLines.length === 0) {
    return NextResponse.json(
      {
        error:
          'Bu talepteki ürünler için sipariş kalemi bilgisi bulunamadı. Lütfen ikas panelinden manuel olarak iade işlemi yapın.',
        code: 'NO_REFUNDABLE_LINES',
      },
      { status: 422 },
    );
  }

  // ── 2. Atomically claim the refund (idempotency / double-click / race guard) ──
  // Only one concurrent request can move refund_status out of
  // none/failed/(stale processing) into processing — everyone else gets 0
  // rows affected and is told to back off instead of re-running the mutation.
  const staleThreshold = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('return_requests')
    .update({ refund_status: 'processing', refund_started_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .neq('refund_status', 'succeeded')
    .or(`refund_status.neq.processing,refund_started_at.lt.${staleThreshold}`)
    .select('id')
    .maybeSingle();

  if (claimError) return NextResponse.json({ error: 'İade işlemi başlatılamadı' }, { status: 500 });
  if (!claimed) {
    const { data: fresh } = await supabaseAdmin
      .from('return_requests')
      .select('refund_status')
      .eq('id', id)
      .eq('merchant_id', user.merchantId)
      .maybeSingle();
    if (fresh?.refund_status === 'succeeded') {
      return NextResponse.json({ error: 'Bu talep için para iadesi zaten tamamlanmış.', code: 'ALREADY_REFUNDED' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Bu talep için bir iade işlemi zaten devam ediyor. Lütfen bekleyin.', code: 'REFUND_IN_PROGRESS' }, { status: 409 });
  }

  const markFailed = async (reason: string) => {
    await supabaseAdmin
      .from('return_requests')
      .update({ refund_status: 'failed', refund_failure_reason: reason })
      .eq('id', id)
      .eq('merchant_id', user.merchantId);
    createAuditLog({
      merchantId: user.merchantId,
      user: user.memberId ?? 'Mağaza',
      action: 'return.refund_failed',
      entityType: ret.request_type === 'exchange' ? 'exchange' : 'return',
      entityId: id,
      metadata: { rf_number: ret.rf_number, reason },
      ipAddress: getIp(request),
    });
  };

  // ── 3. Fetch live ikas order truth right before mutating ──────────────────
  // Never trust the DB snapshot for financial calculations — re-derive price,
  // quantity, and current line-item status from ikas itself immediately
  // before calling refundOrderLine.
  const authToken = await AuthTokenManager.getByMerchantId(user.merchantId);
  if (!authToken) {
    await markFailed('ikas yetkilendirme tokenı bulunamadı');
    return NextResponse.json({ error: 'Mağaza yetkilendirmesi bulunamadı. Lütfen uygulamayı yeniden bağlayın.' }, { status: 503 });
  }
  const ikas = getIkas(authToken);

  let liveOrder;
  try {
    const orderResp = await ikas.queries.getOrderForRefund({ id: { eq: ret.ikas_order_id } });
    liveOrder = orderResp.data?.listOrder?.data?.[0];
  } catch (e) {
    await markFailed(sanitizeErrorMessage(e));
    return NextResponse.json({ error: 'Sipariş bilgisi ikastan alınamadı. Lütfen tekrar deneyin.' }, { status: 502 });
  }

  if (!liveOrder) {
    await markFailed('Sipariş ikas üzerinde bulunamadı');
    return NextResponse.json({ error: 'Sipariş ikas üzerinde bulunamadı.' }, { status: 404 });
  }

  if (ret.customer_email && liveOrder.customer?.email && liveOrder.customer.email.toLowerCase() !== ret.customer_email.toLowerCase()) {
    await markFailed('Sipariş müşteri e-postası uyuşmuyor');
    return NextResponse.json({ error: 'Sipariş doğrulanamadı.' }, { status: 403 });
  }

  // ── 4. Validate every requested line against live order state ─────────────
  const orderRefundLines: Array<{ orderLineItemId: string; price: number; quantity: number; restockItems: boolean }> = [];
  let totalRefund = 0;
  let stockLocationId = liveOrder.stockLocationId ?? undefined;

  for (const req of requestedLines) {
    const liveLine = liveOrder.orderLineItems?.find((l) => l.id === req.order_line_item_id);
    if (!liveLine) {
      await markFailed(`Sipariş kalemi bulunamadı: ${req.order_line_item_id}`);
      return NextResponse.json({ error: 'Sipariş kalemi bulunamadı.' }, { status: 422 });
    }
    if (liveLine.status === 'REFUNDED' || liveLine.status === 'CANCELLED') {
      await markFailed(`Sipariş kalemi zaten iade/iptal edilmiş: ${req.order_line_item_id}`);
      return NextResponse.json({ error: 'Bu ürün ikas üzerinde zaten iade veya iptal edilmiş.', code: 'ALREADY_REFUNDED_ON_IKAS' }, { status: 409 });
    }
    const qty = Number(req.quantity);
    if (!Number.isFinite(qty) || qty <= 0 || qty > liveLine.quantity) {
      await markFailed(`Geçersiz miktar: ${req.order_line_item_id}`);
      return NextResponse.json({ error: 'Geçersiz iade miktarı.' }, { status: 400 });
    }
    const unitPrice = liveLine.finalUnitPrice ?? (liveLine.finalPrice != null && liveLine.quantity ? liveLine.finalPrice / liveLine.quantity : liveLine.price);
    orderRefundLines.push({ orderLineItemId: req.order_line_item_id, price: unitPrice, quantity: qty, restockItems: body.restockItems ?? true });
    totalRefund += unitPrice * qty;
    if (!stockLocationId) stockLocationId = liveLine.stockLocationId ?? undefined;
  }

  if (!stockLocationId) {
    await markFailed('Depo (stockLocationId) bilgisi bulunamadı');
    return NextResponse.json({ error: 'Sipariş için depo bilgisi bulunamadı.' }, { status: 422 });
  }

  totalRefund = Math.round(totalRefund * 100) / 100;

  // ── 5. Verify there is enough actually-paid, not-yet-refunded amount ──────
  try {
    const txResp = await ikas.queries.listOrderTransactions({ orderId: ret.ikas_order_id });
    const transactions = txResp.data?.listOrderTransactions ?? [];
    const paid = transactions.filter((t) => t.type === 'SALE' && t.status === 'SUCCESS').reduce((sum, t) => sum + t.amount, 0);
    const alreadyRefunded = transactions.filter((t) => t.type === 'REFUND' && t.status === 'SUCCESS').reduce((sum, t) => sum + t.amount, 0);
    const remaining = paid - alreadyRefunded;
    if (paid > 0 && totalRefund > remaining + 0.01) {
      await markFailed('Talep edilen tutar iade edilebilir tutarı aşıyor');
      return NextResponse.json({ error: 'Talep edilen iade tutarı, bu sipariş için kalan iade edilebilir tutarı aşıyor.', code: 'AMOUNT_EXCEEDS_REMAINING' }, { status: 409 });
    }
  } catch {
    // If the transaction check itself fails, proceed — refundOrderLine
    // performs its own server-side validation on ikas's side and will
    // reject an invalid refund; we don't want a transient read failure on a
    // non-authoritative pre-check to block a legitimate refund.
  }

  // ── 6. Execute the real ikas refund ────────────────────────────────────────
  try {
    const refundResp = await ikas.mutations.refundOrderLine({
      input: {
        orderId: ret.ikas_order_id,
        stockLocationId,
        orderRefundLines,
        sendNotificationToCustomer: false, // ReturnFlow sends its own branded email below
        reason: ret.reason ?? undefined,
      },
    });

    if (!refundResp.isSuccess || !refundResp.data?.refundOrderLine) {
      const message = refundResp.error ?? refundResp.errors?.[0]?.message ?? 'ikas iade işlemini reddetti';
      await markFailed(sanitizeErrorMessage(message));
      return NextResponse.json({ error: 'ikas para iadesini gerçekleştiremedi. Lütfen tekrar deneyin veya ikas panelinden kontrol edin.', code: 'IKAS_REFUND_FAILED' }, { status: 502 });
    }

    const result = refundResp.data.refundOrderLine;

    // ── 7. Persist success — only now is the return marked refunded ────────
    await supabaseAdmin
      .from('return_requests')
      .update({
        status: 'İade Edildi',
        refund_status: 'succeeded',
        refund_completed_at: new Date().toISOString(),
        refund_amount: totalRefund,
        refund_currency: liveOrder.currencyCode,
        refunded_line_items: orderRefundLines,
        refund_attempted_by: user.memberId ?? user.role,
        refund_provider_response: {
          orderStatus: result.status,
          orderPaymentStatus: result.orderPaymentStatus ?? null,
          netTotalFinalPrice: result.netTotalFinalPrice ?? null,
        },
      })
      .eq('id', id)
      .eq('merchant_id', user.merchantId);

    createAuditLog({
      merchantId: user.merchantId,
      user: user.memberId ?? 'Mağaza',
      action: 'return.refunded',
      entityType: ret.request_type === 'exchange' ? 'exchange' : 'return',
      entityId: id,
      metadata: { rf_number: ret.rf_number, refund_amount: totalRefund, refund_currency: liveOrder.currencyCode },
      ipAddress: getIp(request),
    });

    createNotification({
      merchantId: user.merchantId,
      type: 'refund_completed',
      title: `Para İadesi Yapıldı: ${ret.rf_number}`,
      message: `${totalRefund} ${liveOrder.currencyCode}`,
      relatedReturnId: id,
    });

    triggerWebhookEvent(user.merchantId, 'return.refunded', {
      id,
      rf_number: ret.rf_number,
      order_id: ret.ikas_order_id,
      status: 'İade Edildi',
      request_type: ret.request_type,
      refund_amount: totalRefund,
      refund_currency: liveOrder.currencyCode,
    }).catch(() => undefined);

    sendReturnEmail({ merchantId: user.merchantId, returnId: id, templateType: 'return_refunded' }).catch(() => undefined);

    return NextResponse.json({ data: { refunded: true, amount: totalRefund, currency: liveOrder.currencyCode } });
  } catch (e) {
    await markFailed(sanitizeErrorMessage(e));
    return NextResponse.json({ error: 'ikas para iadesi sırasında bir hata oluştu. Lütfen tekrar deneyin.', code: 'IKAS_REFUND_ERROR' }, { status: 502 });
  }
}
