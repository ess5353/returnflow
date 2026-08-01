import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WebhookEvent, WebhookPayload } from './events';

const MAX_RETRIES = 3;
const RETRY_DELAYS_SECONDS = [60, 300, 1800]; // 1min, 5min, 30min
const RESPONSE_BODY_CAP = 2048;
const DELIVERY_TIMEOUT_MS = 10_000;

function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

export async function attemptDelivery(deliveryId: string): Promise<void> {
  const { data: delivery } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('*, webhooks(url, secret, enabled)')
    .eq('id', deliveryId)
    .single();

  if (!delivery) return;

  const webhook = delivery.webhooks as { url: string; secret: string; enabled: boolean } | null;
  if (!webhook?.enabled) {
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({ status: 'skipped' })
      .eq('id', deliveryId);
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const signature = signPayload(webhook.secret, body);

  let responseCode: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const res = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Pelyx-Signature': signature,
        'X-Pelyx-Event': delivery.event as string,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    responseCode = res.status;
    const text = await res.text().catch(() => '');
    responseBody = text.slice(0, RESPONSE_BODY_CAP);
    success = res.ok;
  } catch {
    responseCode = null;
    responseBody = 'Request failed or timed out';
    success = false;
  }

  const retryCount = (delivery.retry_count ?? 0) + (delivery.status === 'pending' ? 0 : 1);

  if (success) {
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: 'success',
        response_code: responseCode,
        response_body: responseBody,
        delivered_at: new Date().toISOString(),
        retry_count: retryCount,
        next_retry_at: null,
      })
      .eq('id', deliveryId);
    return;
  }

  // Determine next retry
  const nextRetryIndex = retryCount;
  if (nextRetryIndex >= MAX_RETRIES) {
    await supabaseAdmin
      .from('webhook_deliveries')
      .update({
        status: 'failed',
        response_code: responseCode,
        response_body: responseBody,
        retry_count: retryCount,
        next_retry_at: null,
      })
      .eq('id', deliveryId);
    return;
  }

  const delaySeconds = RETRY_DELAYS_SECONDS[nextRetryIndex] ?? RETRY_DELAYS_SECONDS[RETRY_DELAYS_SECONDS.length - 1];
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

  await supabaseAdmin
    .from('webhook_deliveries')
    .update({
      status: 'retrying',
      response_code: responseCode,
      response_body: responseBody,
      retry_count: retryCount,
      next_retry_at: nextRetryAt,
    })
    .eq('id', deliveryId);
}
