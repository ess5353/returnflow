export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import {
  CREATE_MERCHANT_APP_PAYMENT,
  LIST_MERCHANT_APP_PAYMENT,
} from '@/lib/ikas-client/graphql-requests';
import { ikasRawRequest } from '@/lib/ikas-client/raw-request';
import { resolveActivePlan } from '@/lib/billing/plan';
import { config } from '@/globals/config';

type CreatePaymentData = {
  createMerchantAppPayment: {
    id: string;
    merchantPaymentUrl: string;
    status: string;
    storeAppListingSubscriptionKey: string | null;
  } | null;
};

type ListPaymentsData = {
  listMerchantAppPayment: {
    data: Array<{
      id: string;
      status: 'PAID' | 'WAITING_FOR_PAYMENT' | 'PAYMENT_FAILED';
      type: string;
      createdAt: number | null;
      merchantPaymentUrl: string | null;
      storeAppListingSubscriptionKey: string | null;
    }> | null;
  } | null;
};

const GENERIC_TR =
  'ikas ödeme sayfası şu anda oluşturulamadı. Lütfen birkaç dakika sonra tekrar deneyin. Sorun sürerse destekle iletişime geçin.';

const REUSE_WINDOW_MS = 60 * 60 * 1000; // reuse a still-open payment link created in the last hour

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.isOwner && !user.can('billing.manage')) {
    return NextResponse.json(
      { error: 'Yetkiniz yok. Aboneliği yalnızca mağaza sahibi başlatabilir.' },
      { status: 403 },
    );
  }

  const authToken = await AuthTokenManager.get(user.authorizedAppId);
  if (!authToken) {
    return NextResponse.json(
      {
        error:
          'ikas mağaza bağlantınız bulunamadı. Lütfen ReturnFlow uygulamasını ikas panelinden yeniden yükleyin.',
        code: 'NO_AUTH_TOKEN',
      },
      { status: 409 },
    );
  }

  // ── 1. Resolve the real subscription key from ikas (never hardcoded) ───────
  const { plan, error: planError } = await resolveActivePlan(authToken);
  if (!plan) {
    console.error('[billing/upgrade] could not resolve plan', {
      merchantId: user.merchantId,
      graphApiUrl: config.graphApiUrl,
      planError,
    });
    return NextResponse.json(
      { error: GENERIC_TR, code: planError?.code ?? 'PLAN_UNRESOLVED' },
      { status: 502 },
    );
  }

  // ── 2. Reuse a still-open payment link if the merchant already started one ──
  const existing = await ikasRawRequest<ListPaymentsData>(authToken, LIST_MERCHANT_APP_PAYMENT);
  const openPayment = (existing.data?.listMerchantAppPayment?.data ?? []).find(
    (p) =>
      p.status === 'WAITING_FOR_PAYMENT' &&
      p.merchantPaymentUrl &&
      p.storeAppListingSubscriptionKey === plan.key &&
      p.createdAt != null &&
      Date.now() - Number(p.createdAt) < REUSE_WINDOW_MS,
  );
  if (openPayment?.merchantPaymentUrl) {
    return NextResponse.json({
      data: { paymentUrl: openPayment.merchantPaymentUrl, paymentId: openPayment.id, reused: true },
    });
  }

  // ── 3. Create the official ikas subscription payment ──────────────────────
  const result = await ikasRawRequest<CreatePaymentData>(authToken, CREATE_MERCHANT_APP_PAYMENT, {
    input: { storeAppListingSubscriptionKey: plan.key },
  });

  const payment = result.data?.createMerchantAppPayment;
  if (payment?.merchantPaymentUrl) {
    return NextResponse.json({
      data: {
        paymentUrl: payment.merchantPaymentUrl,
        paymentId: payment.id,
        plan: { name: plan.name, yearlyPrice: plan.yearlyPrice, currencyCode: plan.currencyCode },
      },
    });
  }

  // ── Failure ──────────────────────────────────────────────────────────────
  const ikasErr = result.errors?.[0];
  const ikasCode = (ikasErr?.extensions?.code as string | undefined) ?? undefined;
  const sessionExpired =
    ikasCode === 'LOGIN_REQUIRED' || ikasErr?.message === 'LOGIN_REQUIRED' || result.httpStatus === 401;

  console.error('[billing/upgrade] createMerchantAppPayment failed', {
    merchantId: user.merchantId,
    authorizedAppId: user.authorizedAppId,
    graphApiUrl: config.graphApiUrl,
    httpStatus: result.httpStatus,
    ikasCode: ikasCode ?? null,
    ikasMessage: ikasErr?.message ?? null,
    bodySnippet: result.bodySnippet,
    resolvedPlanKeyFingerprint: `${plan.key.slice(0, 6)}…${plan.key.slice(-3)} (len${plan.key.length})`,
  });

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
