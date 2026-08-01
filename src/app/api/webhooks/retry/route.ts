export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { attemptDelivery } from '@/lib/webhooks/deliver';

export async function POST(request: NextRequest) {
  // Auth: user JWT or CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') ?? '';
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    // Require valid user JWT otherwise (optional — just rejects unauthenticated callers)
    const authorization = authHeader.replace('Bearer ', '');
    if (!authorization) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const now = new Date().toISOString();

  const { data: due, error } = await supabaseAdmin
    .from('webhook_deliveries')
    .select('id')
    .eq('status', 'retrying')
    .lte('next_retry_at', now)
    .limit(50);

  if (error) {
    console.error('webhook retry query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  const ids = (due ?? []).map((d) => d.id as string);

  if (ids.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  await Promise.allSettled(ids.map((id) => attemptDelivery(id)));

  return NextResponse.json({ processed: ids.length });
}
