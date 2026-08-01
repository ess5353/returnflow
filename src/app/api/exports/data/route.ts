export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sp = request.nextUrl.searchParams;
  const dateFrom = sp.get('dateFrom') ?? '';
  const dateTo = sp.get('dateTo') ?? '';
  const status = sp.get('status') ?? '';
  const requestType = sp.get('requestType') ?? '';
  const automation = sp.get('automation') ?? '';
  const customer = sp.get('customer') ?? '';
  const product = sp.get('product') ?? '';

  // Base query
  let query = supabaseAdmin
    .from('return_requests')
    .select('id, rf_number, order_id, customer_name, customer_email, product, reason, status, request_type, amount, created_at, updated_at, admin_note')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false });

  if (requestType && requestType !== 'all') {
    query = query.eq('request_type', requestType);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (dateFrom) {
    query = query.gte('created_at', new Date(dateFrom).toISOString());
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }
  if (customer) {
    query = query.ilike('customer_name', `%${customer}%`);
  }
  if (product) {
    query = query.ilike('product', `%${product}%`);
  }

  const { data: rows, error } = await query;

  if (error) {
    console.error('exports/data GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  const safeRows = rows ?? [];

  // Fetch automation results for these rows
  const returnIds = safeRows.map((r) => r.id);
  let automationMap: Record<string, string> = {};

  if (returnIds.length > 0) {
    const { data: logs } = await supabaseAdmin
      .from('automation_logs')
      .select('return_request_id, rule_name, action_taken')
      .in('return_request_id', returnIds)
      .eq('matched', true);

    for (const log of logs ?? []) {
      automationMap[log.return_request_id] = log.rule_name ?? log.action_taken ?? 'Eşleşti';
    }
  }

  // Apply automation filter in JS
  let filtered = safeRows;
  if (automation === 'automated') {
    filtered = safeRows.filter((r) => automationMap[r.id]);
  } else if (automation === 'manual') {
    filtered = safeRows.filter((r) => !automationMap[r.id]);
  }

  // Merge automation_result into each row
  const result = filtered.map((r) => ({
    ...r,
    automation_result: automationMap[r.id] ?? '',
  }));

  return NextResponse.json({ data: result });
}
