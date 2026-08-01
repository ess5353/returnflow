export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { SAMPLE_PAYLOADS } from '@/lib/webhooks/events';
import { attemptDelivery } from '@/lib/webhooks/deliver';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: webhook } = await supabaseAdmin
    .from('webhooks')
    .select('id, enabled')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .single();

  if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });

  const testPayload = SAMPLE_PAYLOADS['return.created'];

  const { data: delivery, error } = await supabaseAdmin
    .from('webhook_deliveries')
    .insert({
      webhook_id: id,
      merchant_id: user.merchantId,
      event: testPayload.event,
      payload: testPayload,
      status: 'pending',
      retry_count: 0,
    })
    .select('id')
    .single();

  if (error || !delivery) {
    console.error('webhook test insert error:', error);
    return NextResponse.json({ error: 'Failed to create test delivery' }, { status: 500 });
  }

  // Temporarily force-enable for the test delivery regardless of enabled state
  await attemptDelivery(delivery.id);

  const { data: result } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('status, response_code, response_body')
    .eq('id', delivery.id)
    .single();

  return NextResponse.json({ ok: true, delivery: result });
}
