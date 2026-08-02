export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { WebhookEvent } from '@/lib/webhooks/events';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('webhooks.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .select('id, name, url, secret, enabled, events, created_at, updated_at')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('webhooks GET error:', error);
    return NextResponse.json({ error: 'Failed to load webhooks' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('webhooks.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { name?: string; url?: string; secret?: string; enabled?: boolean; events?: WebhookEvent[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, url, secret, enabled = true, events = [] } = body;

  if (!name || !url || !secret) {
    return NextResponse.json({ error: 'name, url, and secret are required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .insert({ merchant_id: user.merchantId, name, url, secret, enabled, events })
    .select('id, name, url, secret, enabled, events, created_at, updated_at')
    .single();

  if (error) {
    console.error('webhooks POST error:', error);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'webhook.created',
    entityType: 'webhook',
    entityId: data?.id as string | undefined,
    metadata: { name, url, events },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data });
}
