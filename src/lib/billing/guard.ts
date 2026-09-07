import { NextResponse } from 'next/server';
import { getBillingEntitlement, type Entitlement } from './entitlement';

/**
 * Centralized server-side entitlement gate for operational API routes.
 *
 * Call this immediately after resolving the auth context and BEFORE performing
 * any read/write of merchant data or any ikas mutation. It consults only the
 * authoritative billing store (never the browser) and returns a 402 response
 * when the merchant's 14-day trial has expired and there is no active paid
 * subscription.
 *
 * Usage:
 *   const user = getAuthContext(request);
 *   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 *   const gate = await requireActiveEntitlement(user.merchantId);
 *   if (gate) return gate;
 */
export async function requireActiveEntitlement(
  merchantId: string,
): Promise<NextResponse | null> {
  const entitlement = await getBillingEntitlement(merchantId);
  if (entitlement.isActive) return null;
  return entitlementBlockedResponse(entitlement);
}

export function entitlementBlockedResponse(entitlement: Entitlement): NextResponse {
  return NextResponse.json(
    {
      error:
        "ReturnFlow Pro aboneliğiniz aktif değil. Kullanmaya devam etmek için aboneliğinizi başlatın.",
      code: 'SUBSCRIPTION_REQUIRED',
      upgrade_required: true,
      blocked_reason: entitlement.blockedReason,
      entitlement: {
        plan: entitlement.plan,
        isActive: false,
        isExpired: true,
        trialEndsAt: entitlement.trialEndsAt,
        currentPeriodEnd: entitlement.currentPeriodEnd,
      },
    },
    { status: 402 },
  );
}
