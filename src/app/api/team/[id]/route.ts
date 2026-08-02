export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ROLES, type Role } from '@/lib/auth/permissions';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.can('team.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  let body: { role?: string; status?: string; custom_permissions?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.role && !ROLES.includes(body.role as Role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }
  if (body.role === 'owner') {
    return NextResponse.json({ error: 'Cannot set role to owner' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ('role' in body) update.role = body.role;
  if ('status' in body) update.status = body.status;
  if ('custom_permissions' in body) update.custom_permissions = body.custom_permissions;

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', ctx.merchantId)
    .select('id, email, role, status')
    .single();

  if (error) {
    console.error('team PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
  }

  const auditAction = 'role' in body ? 'member.role_changed' : 'member.permissions_updated';
  createAuditLog({
    merchantId: ctx.merchantId,
    user: 'Mağaza',
    action: auditAction,
    entityType: 'team_member',
    entityId: id,
    metadata: update,
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = getAuthContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!ctx.can('team.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('team_members')
    .delete()
    .eq('id', id)
    .eq('merchant_id', ctx.merchantId);

  if (error) {
    console.error('team DELETE error:', error);
    return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
  }

  createAuditLog({
    merchantId: ctx.merchantId,
    user: 'Mağaza',
    action: 'member.removed',
    entityType: 'team_member',
    entityId: id,
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}
