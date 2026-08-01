export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await params;

  let body: { subject?: string; html?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.subject || !body.html) {
    return NextResponse.json({ error: 'subject and html required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('email_templates').upsert(
    {
      merchant_id: user.merchantId,
      template_type: type,
      subject: body.subject,
      html: body.html,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id,template_type' },
  );

  if (error) {
    console.error('email-templates PATCH error:', error);
    return NextResponse.json({ error: 'Failed to save template' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'email_template.updated',
    entityType: 'email_template',
    entityId: type,
    metadata: { template_type: type },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type } = await params;

  const { error } = await supabaseAdmin
    .from('email_templates')
    .delete()
    .eq('merchant_id', user.merchantId)
    .eq('template_type', type);

  if (error) {
    console.error('email-templates DELETE error:', error);
    return NextResponse.json({ error: 'Failed to reset template' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
