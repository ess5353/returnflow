import { supabaseAdmin } from '@/lib/supabase-admin';
import { attemptDelivery } from './deliver';
import type { WebhookEvent, WebhookPayload } from './events';

export async function triggerWebhookEvent(
  merchantId: string,
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const { data: webhooks } = await supabaseAdmin
    .from('webhooks')
    .select('id, events')
    .eq('merchant_id', merchantId)
    .eq('enabled', true);

  if (!webhooks || webhooks.length === 0) return;

  const matching = webhooks.filter((wh) =>
    Array.isArray(wh.events) && (wh.events as string[]).includes(event),
  );

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  for (const wh of matching) {
    const { data: delivery } = await supabaseAdmin
      .from('webhook_deliveries')
      .insert({
        webhook_id: wh.id,
        merchant_id: merchantId,
        event,
        payload,
        status: 'pending',
        retry_count: 0,
      })
      .select('id')
      .single();

    if (delivery?.id) {
      attemptDelivery(delivery.id).catch(() => undefined);
    }
  }
}
