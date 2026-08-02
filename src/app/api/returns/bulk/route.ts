export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

// PATCH: bulk update status or admin_note for multiple returns
export async function PATCH(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { ids: string[]; status?: string; admin_note?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { ids, status, admin_note } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (admin_note !== undefined) update.admin_note = admin_note;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Always scope by merchant_id — prevents updating another merchant's returns even if IDs are known
  const { error } = await supabaseAdmin
    .from('return_requests')
    .update(update)
    .in('id', ids)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('bulk PATCH error:', error);
    return NextResponse.json({ error: 'Failed to bulk update returns' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: ids.length });
}
