export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') ?? '20')));
  const type = searchParams.get('type');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (type && type !== 'all') {
    query = query.eq('type', type);
  }

  const [listResult, unreadResult] = await Promise.all([
    query,
    supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('merchant_id', user.merchantId)
      .eq('read', false),
  ]);

  if (listResult.error) {
    console.error('notifications GET error:', listResult.error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  return NextResponse.json({
    data: listResult.data ?? [],
    total: listResult.count ?? 0,
    unread: unreadResult.count ?? 0,
  });
}
