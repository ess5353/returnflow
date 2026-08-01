export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPublicAuth } from '@/lib/public-api/handler';

export const GET = withPublicAuth('/api/public/returns', async (request: NextRequest, ctx) => {
  const sp = request.nextUrl.searchParams;
  const status = sp.get('status') ?? '';
  const requestType = sp.get('request_type') ?? '';
  const createdAfter = sp.get('created_after') ?? '';
  const createdBefore = sp.get('created_before') ?? '';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20')));
  const from = (page - 1) * limit;

  let query = supabaseAdmin
    .from('return_requests')
    .select(
      'id, rf_number, order_id, customer_name, customer_email, product, reason, status, request_type, amount, created_at, updated_at',
      { count: 'exact' },
    )
    .eq('merchant_id', ctx.merchantId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (status) query = query.eq('status', status);
  if (requestType) query = query.eq('request_type', requestType);
  if (createdAfter) query = query.gte('created_at', new Date(createdAfter).toISOString());
  if (createdBefore) {
    const end = new Date(createdBefore);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: 'Query failed', code: 'DB_ERROR' }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      has_more: from + limit < (count ?? 0),
    },
  });
});
