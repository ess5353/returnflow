export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isOwner && !user.can('billing.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const subscriptionKey = process.env.IKAS_PRO_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    return NextResponse.json({ error: 'Pro subscription plan not configured' }, { status: 503 });
  }

  const authToken = await AuthTokenManager.get(user.authorizedAppId);
  if (!authToken) return NextResponse.json({ error: 'Auth token not found' }, { status: 404 });

  const ikasClient = getIkas(authToken);

  const paymentResp = await ikasClient.mutations.createMerchantAppPayment({
    input: { storeAppListingSubscriptionKey: subscriptionKey },
  });

  if (!paymentResp.isSuccess || !paymentResp.data?.createMerchantAppPayment?.merchantPaymentUrl) {
    console.error('createMerchantAppPayment failed:', paymentResp);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }

  return NextResponse.json({
    data: {
      paymentUrl: paymentResp.data.createMerchantAppPayment.merchantPaymentUrl,
      paymentId: paymentResp.data.createMerchantAppPayment.id,
    },
  });
}
