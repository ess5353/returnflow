export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { syncMerchantBilling } from '@/lib/billing/sync';
import { getBillingEntitlement } from '@/lib/billing/entitlement';

/**
 * POST /api/billing/confirm
 * Called by the paywall — both the "Ödemeyi Kontrol Et" button and the
 * automatic post-purchase poll. Force-syncs billing state from ikas's
 * authoritative licence (`getMerchantLicence`), then reports the fresh
 * entitlement. `confirmed` is true once the merchant has operational access.
 */
export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

  // Authoritative: pull the licence from ikas and reconcile merchant_billing.
  await syncMerchantBilling(user.merchantId, user.authorizedAppId);

  const entitlement = await getBillingEntitlement(user.merchantId);

  return NextResponse.json({
    data: {
      confirmed: entitlement.isActive,
      entitlement,
    },
  });
}
