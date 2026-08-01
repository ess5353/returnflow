export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog } from '@/lib/audit/log';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('notification PATCH error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'notification.read',
    entityType: 'notification',
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('notification DELETE error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
