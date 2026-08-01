export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog } from '@/lib/audit/log';

// PATCH: update rule fields; also handles priority swap for move-up/move-down
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const allowed = ['name', 'enabled', 'condition_logic', 'conditions', 'action', 'action_note', 'priority'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  // Scope by merchant_id — prevents cross-merchant updates even if rule ID is known
  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .select()
    .single();

  if (error) {
    console.error('automation rule PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'automation_rule.updated',
    entityType: 'automation_rule',
    entityId: id,
    metadata: { updated_fields: Object.keys(update).filter((k) => k !== 'updated_at') },
  });

  return NextResponse.json({ data });
}

// DELETE: remove a rule and its logs
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('automation_rules')
    .delete()
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('automation rule DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'automation_rule.deleted',
    entityType: 'automation_rule',
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
