export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ROLES, type Role } from '@/lib/auth/permissions';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.can('team.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, email, name, role, custom_permissions, status, invited_at, joined_at, created_at')
    .eq('merchant_id', ctx.merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('team GET error:', error);
    return NextResponse.json({ error: 'Failed to load team' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.can('team.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let body: { email?: string; name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { email, name, role } = body;
  if (!email?.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  if (!role || !ROLES.includes(role as Role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }
  if (role === 'owner') return NextResponse.json({ error: 'Cannot invite as owner' }, { status: 400 });

  // Upsert team member
  const { data: member, error: memberErr } = await supabaseAdmin
    .from('team_members')
    .upsert(
      {
        merchant_id: ctx.merchantId,
        authorized_app_id: ctx.authorizedAppId,
        email: email.trim().toLowerCase(),
        name: name?.trim() ?? null,
        role,
        status: 'invited',
        invited_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id,email' },
    )
    .select('id, email, name, role, status')
    .single();

  if (memberErr) {
    console.error('team POST member error:', memberErr);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }

  // Create invitation token (expire in 7 days)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Delete old pending invitations for this member
  await supabaseAdmin.from('team_invitations').delete().eq('member_id', member.id);

  const { error: invErr } = await supabaseAdmin.from('team_invitations').insert({
    merchant_id: ctx.merchantId,
    member_id: member.id,
    token,
    expires_at: expiresAt,
  });

  if (invErr) {
    console.error('team POST invitation error:', invErr);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }

  createAuditLog({
    merchantId: ctx.merchantId,
    user: 'Mağaza',
    action: 'member.invited',
    entityType: 'team_member',
    entityId: member.id,
    metadata: { email: email.trim().toLowerCase(), role },
    ipAddress: getIp(request),
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_DEPLOY_URL}/access?token=${token}`;

  return NextResponse.json({ data: { ...member, invite_url: inviteUrl } }, { status: 201 });
}
