export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

const upgradeSchema = z.object({
  plan: z.enum(['pro', 'launch_offer']),
});

const SUBSCRIPTION_KEYS: Record<string, string | undefined> = {
  pro: process.env.IKAS_PRO_SUBSCRIPTION_KEY,
  launch_offer: process.env.IKAS_LAUNCH_OFFER_SUBSCRIPTION_KEY ?? process.env.IKAS_PRO_SUBSCRIPTION_KEY,
};

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isOwner && !user.can('billing.manage')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let raw: unknown;
  try { raw = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = upgradeSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { plan } = parsed.data;
  const subscriptionKey = SUBSCRIPTION_KEYS[plan];

  if (!subscriptionKey) {
    return NextResponse.json({ error: 'Subscription plan not configured' }, { status: 503 });
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
