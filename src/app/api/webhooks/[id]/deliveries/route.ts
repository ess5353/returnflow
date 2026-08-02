export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('webhooks.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Verify webhook ownership
  const { data: webhook } = await supabaseAdmin
    .from('webhooks')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .single();

  if (!webhook) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('id, event, status, response_code, response_body, retry_count, next_retry_at, created_at, delivered_at')
    .eq('webhook_id', id)
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('webhook deliveries GET error:', error);
    return NextResponse.json({ error: 'Failed to load deliveries' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
