export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { sendReturnEmail } from '@/lib/email/send';
import type { TemplateType } from '@/lib/email/templates';

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { return_id?: string; template_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.return_id || !body.template_type) {
    return NextResponse.json({ error: 'return_id and template_type required' }, { status: 400 });
  }

  const result = await sendReturnEmail({
    merchantId: user.merchantId,
    returnId: body.return_id,
    templateType: body.template_type as TemplateType,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Return not found' ? 404 : 500 });
  }

  return NextResponse.json({ ok: true });
}
