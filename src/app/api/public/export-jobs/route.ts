export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPublicAuth } from '@/lib/public-api/handler';

export const GET = withPublicAuth('/api/public/export-jobs', async (request: NextRequest, ctx) => {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '20')));
  const from = (page - 1) * limit;

  const { data, error, count } = await supabaseAdmin
    .from('export_jobs')
    .select('id, format, filters, columns, row_count, file_name, created_at', { count: 'exact' })
    .eq('merchant_id', ctx.merchantId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

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
