export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (ctx.isOwner) {
    return NextResponse.json({ data: { role: 'owner', permissions: ['*'], isOwner: true } });
  }

  if (!ctx.memberId) return NextResponse.json({ error: 'Not a team member' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, email, name, role, custom_permissions, status')
    .eq('id', ctx.memberId)
    .eq('merchant_id', ctx.merchantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  return NextResponse.json({
    data: { ...data, permissions: ctx.permissions, isOwner: false },
  });
}
