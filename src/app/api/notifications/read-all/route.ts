export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requireActiveEntitlement } from '@/lib/billing/guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireActiveEntitlement(user.merchantId);
  if (gate) return gate;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('merchant_id', user.merchantId)
    .eq('read', false);

  if (error) {
    console.error('notifications read-all PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
