export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('automation_logs')
    .select('rule_id, created_at')
    .eq('merchant_id', user.merchantId)
    .eq('matched', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('automation stats GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  const stats: Record<string, { count: number; last_triggered: string | null }> = {};
  for (const row of data ?? []) {
    if (!stats[row.rule_id]) {
      stats[row.rule_id] = { count: 0, last_triggered: null };
    }
    stats[row.rule_id].count++;
    if (!stats[row.rule_id].last_triggered || row.created_at > stats[row.rule_id].last_triggered!) {
      stats[row.rule_id].last_triggered = row.created_at;
    }
  }

  return NextResponse.json({ data: stats });
}
