export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('analytics.view')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '50')));
  const from = (page - 1) * limit;

  const action = sp.get('action') ?? '';
  const entityType = sp.get('entity_type') ?? '';
  const dateFrom = sp.get('date_from') ?? '';
  const dateTo = sp.get('date_to') ?? '';
  const search = sp.get('search') ?? '';

  let query = supabaseAdmin
    .from('audit_logs')
    .select(
      'id, user_label, action, entity_type, entity_id, metadata, ip_address, created_at',
      { count: 'exact' },
    )
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false })
    .range(from, from + limit - 1);

  if (action) query = query.eq('action', action);
  if (entityType) query = query.eq('entity_type', entityType);
  if (dateFrom) query = query.gte('created_at', new Date(dateFrom).toISOString());
  if (dateTo) {
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }
  if (search) {
    // Strip characters that could inject extra PostgREST filter predicates.
    const safe = search.replace(/[^A-Za-z0-9\s\-_.]/g, '').trim().slice(0, 100);
    if (safe) {
      query = query.or(
        `action.ilike.%${safe}%,entity_id.ilike.%${safe}%,entity_type.ilike.%${safe}%`,
      );
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('audit-logs GET error:', error);
    return NextResponse.json({ error: 'Failed to load audit logs' }, { status: 500 });
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
