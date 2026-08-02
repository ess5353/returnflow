export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('api.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await params;

  const { error } = await supabaseAdmin
    .from('api_keys')
    .update({ enabled: false, revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('api-keys DELETE error:', error);
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'api_key.revoked',
    entityType: 'api_key',
    entityId: id,
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}
