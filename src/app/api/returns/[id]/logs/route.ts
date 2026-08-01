export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Verify the return belongs to this merchant before exposing its logs
  const { data: row } = await supabaseAdmin
    .from('return_requests')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('automation_logs')
    .select('id, rule_name, matched, action_taken, created_at')
    .eq('return_request_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('automation logs GET error:', error);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
