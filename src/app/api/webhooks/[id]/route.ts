export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WebhookEvent } from '@/lib/webhooks/events';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: { name?: string; url?: string; secret?: string; enabled?: boolean; events?: WebhookEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.url) {
    try {
      new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('name' in body) update.name = body.name;
  if ('url' in body) update.url = body.url;
  if ('secret' in body) update.secret = body.secret;
  if ('enabled' in body) update.enabled = body.enabled;
  if ('events' in body) update.events = body.events;

  const { error } = await supabaseAdmin
    .from('webhooks')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('webhook PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update webhook' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'webhook.updated',
    entityType: 'webhook',
    entityId: id,
    metadata: { updated_fields: Object.keys(update).filter((k) => k !== 'updated_at') },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('webhooks')
    .delete()
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('webhook DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'webhook.deleted',
    entityType: 'webhook',
    entityId: id,
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}
