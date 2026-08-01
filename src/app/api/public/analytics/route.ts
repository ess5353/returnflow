export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPublicAuth } from '@/lib/public-api/handler';

export const GET = withPublicAuth('/api/public/analytics', async (_request: NextRequest, ctx) => {
  const { data: rows, error } = await supabaseAdmin
    .from('return_requests')
    .select('status, request_type, amount')
    .eq('merchant_id', ctx.merchantId);

  if (error) return NextResponse.json({ error: 'Query failed', code: 'DB_ERROR' }, { status: 500 });

  const safeRows = rows ?? [];
  const total = safeRows.length;

  const byStatus: Record<string, number> = {};
  const byRequestType: Record<string, number> = {};
  let totalAmount = 0;

  for (const row of safeRows) {
    const s = (row.status as string) ?? 'Unknown';
    byStatus[s] = (byStatus[s] ?? 0) + 1;

    const rt = (row.request_type as string) ?? 'return';
    byRequestType[rt] = (byRequestType[rt] ?? 0) + 1;

    const amt = parseFloat(row.amount as string);
    if (!isNaN(amt)) totalAmount += amt;
  }

  return NextResponse.json({
    data: {
      total,
      by_status: byStatus,
      by_request_type: byRequestType,
      total_amount: totalAmount.toFixed(2),
    },
  });
});
