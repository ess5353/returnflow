export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50')));
  const from = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('api_logs')
    .select(
      'id, key_prefix, endpoint, method, response_code, response_time_ms, created_at',
      { count: 'exact' },
    )
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (error) {
    console.error('api-logs GET error:', error);
    return NextResponse.json({ error: 'Failed to load logs' }, { status: 500 });
  }

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      has_more: from + limit < (count ?? 0),
    },
  });
}
