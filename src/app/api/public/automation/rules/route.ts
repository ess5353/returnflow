export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPublicAuth } from '@/lib/public-api/handler';

export const GET = withPublicAuth('/api/public/automation/rules', async (_request: NextRequest, ctx) => {
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .select('id, name, enabled, priority, condition_logic, conditions, action, created_at')
    .eq('merchant_id', ctx.merchantId)
    .order('priority', { ascending: true });

  if (error) return NextResponse.json({ error: 'Query failed', code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
});
