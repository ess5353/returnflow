export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { CREATE_MERCHANT_APP_PAYMENT } from '@/lib/ikas-client/graphql-requests';
import { ikasRawRequest } from '@/lib/ikas-client/raw-request';

type CreatePaymentData = {
  createMerchantAppPayment: {
    id: string;
    merchantPaymentUrl: string;
    status: string;
  } | null;
};

const GENERIC_TR =
  'ikas ödeme sayfası şu anda oluşturulamadı. Lütfen birkaç dakika sonra tekrar deneyin. Sorun sürerse destekle iletişime geçin.';

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isOwner && !user.can('billing.manage')) {
    return NextResponse.json({ error: 'Yetkiniz yok. Aboneliği yalnızca mağaza sahibi başlatabilir.' }, { status: 403 });
  }

  const subscriptionKey = process.env.IKAS_PRO_SUBSCRIPTION_KEY;
  if (!subscriptionKey) {
    console.error('[billing/upgrade] IKAS_PRO_SUBSCRIPTION_KEY is not set');
    return NextResponse.json(
      { error: GENERIC_TR, code: 'PLAN_NOT_CONFIGURED' },
      { status: 503 },
    );
  }

  const authToken = await AuthTokenManager.get(user.authorizedAppId);
  if (!authToken) {
    return NextResponse.json(
      { error: 'ikas mağaza bağlantınız bulunamadı. Lütfen ReturnFlow uygulamasını ikas panelinden yeniden yükleyin.', code: 'NO_AUTH_TOKEN' },
      { status: 409 },
    );
  }

  const result = await ikasRawRequest<CreatePaymentData>(authToken, CREATE_MERCHANT_APP_PAYMENT, {
    input: { storeAppListingSubscriptionKey: subscriptionKey },
  });

  const payment = result.data?.createMerchantAppPayment;
  if (payment?.merchantPaymentUrl) {
    return NextResponse.json({
      data: { paymentUrl: payment.merchantPaymentUrl, paymentId: payment.id },
    });
  }

  // ── Failure: log the REAL provider error (no tokens/secrets), return a
  //    useful Turkish message keyed to what ikas actually reported. ───────────
  const ikasErr = result.errors?.[0];
  const ikasCode = (ikasErr?.extensions?.code as string | undefined) ?? undefined;

  console.error('[billing/upgrade] createMerchantAppPayment failed', {
    merchantId: user.merchantId,
    authorizedAppId: user.authorizedAppId,
    httpStatus: result.httpStatus,
    ikasCode: ikasCode ?? null,
    ikasMessage: ikasErr?.message ?? null,
    ikasErrors: result.errors,
    bodySnippet: result.bodySnippet,
    // fingerprint only — never log the key itself
    subscriptionKeyFingerprint: `${subscriptionKey.slice(0, 4)}…len${subscriptionKey.length}`,
  });

  const sessionExpired =
    ikasCode === 'LOGIN_REQUIRED' ||
    ikasErr?.message === 'LOGIN_REQUIRED' ||
    result.httpStatus === 401;

  if (sessionExpired) {
    return NextResponse.json(
      {
        error:
          'ikas oturumunuzun süresi dolmuş görünüyor. Lütfen ReturnFlow uygulamasını kapatıp ikas panelinden yeniden açın, ardından tekrar deneyin.',
        code: 'IKAS_SESSION_EXPIRED',
      },
      { status: 409 },
    );
  }

  return NextResponse.json(
    { error: GENERIC_TR, code: 'IKAS_PAYMENT_CREATE_FAILED', ikas_status: result.httpStatus },
    { status: 502 },
  );
}
