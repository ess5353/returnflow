export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification, type NotificationType } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';
import type { WebhookEvent } from '@/lib/webhooks/events';
import { createAuditLog, getIp, type AuditAction } from '@/lib/audit/log';
import { sendReturnEmail } from '@/lib/email/send';
import type { TemplateType } from '@/lib/email/templates';

const NOTIFIABLE_STATUSES = new Set(['Onaylandı', 'Reddedildi', 'Kargo Bekleniyor', 'Kargo Alındı', 'İade Edildi', 'Tamamlandı']);

// ── PATCH: update status and/or admin_note ─────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('returns.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Per-status permission checks
  if (body.status === 'Onaylandı' && !user.can('returns.approve')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (body.status === 'Reddedildi' && !user.can('returns.reject')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (body.status === 'Tamamlandı' && !user.can('returns.complete')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
          title = `Reddedildi: ${data.rf_number}`;
        } else if (newStatus === 'Kargo Bekleniyor') {
          type = isExchange ? 'exchange_approved' : 'return_approved';
          title = `Kargo Bekleniyor: ${data.rf_number}`;
        } else if (newStatus === 'Kargo Alındı') {
          type = isExchange ? 'exchange_approved' : 'return_approved';
          title = `Kargo Alındı: ${data.rf_number}`;
        } else if (newStatus === 'İade Edildi') {
          type = 'refund_completed';
          title = `İade İşlendi: ${data.rf_number}`;
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

        // Audit log
        const auditActionMap: Record<string, AuditAction> = {
          'Onaylandı': isExchange ? 'exchange.approved' : 'return.approved',
          'Reddedildi': 'return.rejected',
          'Kargo Bekleniyor': isExchange ? 'exchange.shipment_awaited' : 'return.shipment_awaited',
          'Kargo Alındı': isExchange ? 'exchange.shipment_received' : 'return.shipment_received',
          'İade Edildi': 'return.refunded',
          'Tamamlandı': isExchange ? 'exchange.completed' : 'return.completed',
        };
        const auditAction = auditActionMap[newStatus];
        if (auditAction) {
          createAuditLog({
            merchantId: user.merchantId,
            user: 'Mağaza',
            action: auditAction,
            entityType: isExchange ? 'exchange' : 'return',
            entityId: id,
            metadata: { rf_number: data.rf_number, status: newStatus },
          });
        }

        // Customer email — fire-and-forget
        const emailTemplateMap: Record<string, TemplateType> = {
          'Onaylandı': isExchange ? 'exchange_approved' : 'return_approved',
          'Reddedildi': isExchange ? 'exchange_rejected' : 'return_rejected',
          'Kargo Bekleniyor': isExchange ? 'exchange_shipment_awaited' : 'return_shipment_awaited',
          'Kargo Alındı': isExchange ? 'exchange_shipment_received' : 'return_shipment_received',
          'İade Edildi': 'return_refunded',
          'Tamamlandı': isExchange ? 'exchange_completed' : 'return_completed',
        };
        const emailTemplate = emailTemplateMap[newStatus];
        if (emailTemplate) {
          sendReturnEmail({ merchantId: user.merchantId, returnId: id, templateType: emailTemplate }).catch(() => undefined);
        }
      });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE: remove a return ────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('returns.approve')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

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
