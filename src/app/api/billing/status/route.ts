export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { getBillingEntitlement } from '@/lib/billing/entitlement';
import { maybeSyncLazy } from '@/lib/billing/sync';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Lazy sync in the background
  maybeSyncLazy(user.merchantId, user.authorizedAppId);

  const entitlement = await getBillingEntitlement(user.merchantId);

  return NextResponse.json({ data: entitlement });
}
