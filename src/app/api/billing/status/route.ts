export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { getBillingEntitlement } from '@/lib/billing/entitlement';
import { maybeSyncLazy, createTrialBillingRecord } from '@/lib/billing/sync';

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Lazy sync in the background
  maybeSyncLazy(user.merchantId, user.authorizedAppId);

  let entitlement = await getBillingEntitlement(user.merchantId);

  // If no billing record exists the merchant installed before createTrialBillingRecord was
  // wired to the OAuth callback, or it failed silently.  Create the record on-demand so
  // the trial countdown has a real end-date to display.
  if (entitlement.plan === 'trial' && !entitlement.trialEndsAt) {
    await createTrialBillingRecord(user.merchantId);
    entitlement = await getBillingEntitlement(user.merchantId);
  }

  return NextResponse.json({ data: entitlement });
}
