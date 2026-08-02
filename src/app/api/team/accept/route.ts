export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createStaffToken } from '@/lib/auth/staff-jwt';
import { getEffectivePermissions, type Role } from '@/lib/auth/permissions';
import { rateLimit, getClientIp, LIMITS } from '@/lib/security/rate-limit';

const acceptSchema = z.object({
  token: z.string().min(1).max(200),
  name: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  // Rate limit: 10 attempts per IP per 15 min (brute-force protection)
  const ip = getClientIp(request);
  const rl = rateLimit(`team.accept:${ip}`, LIMITS.auth.max, LIMITS.auth.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many attempts, please try again later' }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = acceptSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { token, name } = parsed.data;
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 });

  // Look up invitation
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('team_invitations')
    .select('id, member_id, expires_at, merchant_id')
    .eq('token', token)
    .single();

  if (invErr || !invitation) {
    return NextResponse.json({ error: 'Invalid or expired invitation' }, { status: 404 });
  }

  if (new Date(invitation.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
  }

  // Get member details
  const { data: member, error: memberErr } = await supabaseAdmin
    .from('team_members')
    .select('id, email, name, role, custom_permissions, status, authorized_app_id')
    .eq('id', invitation.member_id)
    .eq('merchant_id', invitation.merchant_id)
    .single();

  if (memberErr || !member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  // Update member to active + set name if provided
  const updateData: Record<string, unknown> = { status: 'active', joined_at: new Date().toISOString() };
  if (name?.trim()) updateData.name = name.trim();

  await supabaseAdmin.from('team_members').update(updateData).eq('id', member.id);

  // Delete the used invitation
  await supabaseAdmin.from('team_invitations').delete().eq('id', invitation.id);

  // Issue staff JWT
  const permissions = getEffectivePermissions(
    member.role as Role,
    (member.custom_permissions as string[]) ?? [],
  );

  const staffToken = createStaffToken({
    sub: member.id,
    merchantId: invitation.merchant_id,
    authorizedAppId: member.authorized_app_id,
    email: member.email,
    name: (name?.trim() || member.name) ?? member.email,
    role: member.role,
    permissions,
  });

  return NextResponse.json({
    data: {
      token: staffToken,
      name: (name?.trim() || member.name) ?? member.email,
      role: member.role,
      email: member.email,
    },
  });
}
