export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification, type NotificationType } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';
import type { WebhookEvent } from '@/lib/webhooks/events';

const NOTIFIABLE_STATUSES = new Set(['Onaylandı', 'Reddedildi', 'Tamamlandı']);

// ── PATCH: update status and/or admin_note ─────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ('status' in body) update.status = body.status;
  if ('admin_note' in body) update.admin_note = body.admin_note;
  if ('priority' in body) update.priority = body.priority;
  if ('exchange_price_diff' in body) update.exchange_price_diff = body.exchange_price_diff;
  if ('carrier' in body) update.carrier = body.carrier;
  if ('tracking_number' in body) update.tracking_number = body.tracking_number;
  if ('shipping_status' in body) update.shipping_status = body.shipping_status;
  if ('shipping_date' in body) update.shipping_date = body.shipping_date;
  if ('delivered_date' in body) update.delivered_date = body.delivered_date;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Scope by merchant_id to prevent cross-merchant writes
  const { error } = await supabaseAdmin
    .from('return_requests')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('return PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update return' }, { status: 500 });
  }

  // Fire notification for status changes (fire-and-forget)
  const newStatus = update.status as string | undefined;
  if (newStatus && NOTIFIABLE_STATUSES.has(newStatus)) {
    supabaseAdmin
      .from('return_requests')
      .select('rf_number, customer_name, request_type')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        const isExchange = data.request_type === 'exchange';
        let type: NotificationType;
        let title: string;
        if (newStatus === 'Onaylandı') {
          type = isExchange ? 'exchange_approved' : 'return_approved';
          title = isExchange ? `Değişim Onaylandı: ${data.rf_number}` : `İade Onaylandı: ${data.rf_number}`;
        } else if (newStatus === 'Reddedildi') {
          type = 'return_rejected';
          title = `İade Reddedildi: ${data.rf_number}`;
        } else {
          type = isExchange ? 'exchange_completed' : 'refund_completed';
          title = isExchange ? `Değişim Tamamlandı: ${data.rf_number}` : `İade Tamamlandı: ${data.rf_number}`;
        }
        createNotification({
          merchantId: user.merchantId,
          type,
          title,
          message: data.customer_name,
          relatedReturnId: id,
        });

        // Webhook trigger
        const webhookEventMap: Record<string, WebhookEvent> = {
          Onaylandı: isExchange ? 'exchange.approved' : 'return.approved',
          Reddedildi: 'return.rejected',
          Tamamlandı: isExchange ? 'exchange.completed' : 'return.completed',
        };
        const webhookEvent = webhookEventMap[newStatus];
        if (webhookEvent) {
          triggerWebhookEvent(user.merchantId, webhookEvent, {
            id,
            rf_number: data.rf_number,
            customer_name: data.customer_name,
            status: newStatus,
            request_type: data.request_type,
          }).catch(() => undefined);
        }
      });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE: remove a return ────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Scope by merchant_id to prevent cross-merchant deletes
  const { error } = await supabaseAdmin
    .from('return_requests')
    .delete()
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('return DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete return' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
