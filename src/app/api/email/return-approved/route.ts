export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { sendReturnEmail } from '@/lib/email/send';

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { return_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.return_id) {
    return NextResponse.json({ error: 'return_id required' }, { status: 400 });
  }

  const result = await sendReturnEmail({
    merchantId: user.merchantId,
    returnId: body.return_id,
    templateType: 'return_approved',
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'Return not found' ? 404 : 500 });
  }

  return NextResponse.json({ ok: true });
}
