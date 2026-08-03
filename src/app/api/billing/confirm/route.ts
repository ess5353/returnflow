export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { syncMerchantBilling } from '@/lib/billing/sync';
import { getBillingEntitlement } from '@/lib/billing/entitlement';

/**
 * POST /api/billing/confirm
 * Polls ikas to check if a payment was completed, then syncs billing state.
 * Called by the dashboard after the merchant returns from the ikas payment page.
 */
export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const authToken = await AuthTokenManager.get(user.authorizedAppId);
  if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

  const ikasClient = getIkas(authToken);

  // Check recent payments
  const paymentsResp = await ikasClient.queries.listMerchantAppPayment();
  if (!paymentsResp.isSuccess || !paymentsResp.data?.listMerchantAppPayment) {
    return NextResponse.json({ error: 'Failed to check payment status' }, { status: 500 });
  }

  const payments = paymentsResp.data.listMerchantAppPayment.data ?? [];
  const sevenDaysAgo = Date.now() - 7 * 86400 * 1000;
  const recentPaid = payments.find(
    (p) => p.status === 'PAID' && p.paymentDate != null && p.paymentDate > sevenDaysAgo,
  );

  if (recentPaid) {
    // Payment confirmed — sync billing record
    await syncMerchantBilling(user.merchantId, user.authorizedAppId);
  }

  const entitlement = await getBillingEntitlement(user.merchantId);

  return NextResponse.json({
    data: {
      confirmed: !!recentPaid,
      entitlement,
    },
  });
}
