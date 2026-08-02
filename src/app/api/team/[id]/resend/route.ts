export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.can('team.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  // Verify member belongs to merchant
  const { data: member, error: memberErr } = await supabaseAdmin
    .from('team_members')
    .select('id, email, status')
    .eq('id', id)
    .eq('merchant_id', ctx.merchantId)
    .single();

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (member.status === 'active') {
    return NextResponse.json({ error: 'Member is already active' }, { status: 400 });
  }

  // Delete old invitation and create a new one
  await supabaseAdmin.from('team_invitations').delete().eq('member_id', id);

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: invErr } = await supabaseAdmin.from('team_invitations').insert({
    merchant_id: ctx.merchantId,
    member_id: id,
    token,
    expires_at: expiresAt,
  });

  if (invErr) {
    console.error('team resend error:', invErr);
    return NextResponse.json({ error: 'Failed to resend invitation' }, { status: 500 });
  }

  // Also update invited_at timestamp
  await supabaseAdmin
    .from('team_members')
    .update({ invited_at: new Date().toISOString(), status: 'invited' })
    .eq('id', id);

  const inviteUrl = `${process.env.NEXT_PUBLIC_DEPLOY_URL}/access?token=${token}`;

  return NextResponse.json({ data: { invite_url: inviteUrl } });
}
