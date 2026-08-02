import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/** Non-blocking lazy sync — fire-and-forget when billing data is stale. */
export function maybeSyncLazy(merchantId: string, authorizedAppId: string): void {
  void Promise.resolve(
    supabaseAdmin
      .from('merchant_billing')
      .select('ikas_last_synced_at')
      .eq('merchant_id', merchantId)
      .maybeSingle(),
  ).then(({ data }) => {
    if (!data) return;
    const lastSync = data.ikas_last_synced_at
      ? new Date(data.ikas_last_synced_at as string).getTime()
      : 0;
    if (Date.now() - lastSync > STALE_THRESHOLD_MS) {
      void syncMerchantBilling(merchantId, authorizedAppId).catch(() => undefined);
    }
  }).catch(() => undefined);
}

/** Full sync: fetches getMerchantLicence from ikas and updates merchant_billing. */
export async function syncMerchantBilling(merchantId: string, authorizedAppId: string): Promise<void> {
  try {
    const authToken = await AuthTokenManager.get(authorizedAppId);
    if (!authToken) return;

    const ikasClient = getIkas(authToken);
    const licenceResp = await ikasClient.queries.getMerchantLicence();

    if (!licenceResp.isSuccess || !licenceResp.data?.getMerchantLicence) return;

    const appSubs = licenceResp.data.getMerchantLicence.appSubscriptions ?? [];
    const activeSub = appSubs.find((s) => s.status === 'ACTIVE');
    const willExpireSub = appSubs.find((s) => s.status === 'WILL_BE_REMOVED');
    const currentSub = activeSub ?? willExpireSub;

    const { data: billing } = await supabaseAdmin
      .from('merchant_billing')
      .select('plan, status, current_period_start')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!billing) return;

    const now = new Date().toISOString();

    if (!currentSub) {
      // Subscription removed — expire any paid plan
      if (billing.plan !== 'trial' && billing.plan !== 'enterprise' && billing.status !== 'expired') {
        await supabaseAdmin
          .from('merchant_billing')
          .update({ status: 'expired', ikas_status: 'REMOVED', ikas_last_synced_at: now, updated_at: now })
          .eq('merchant_id', merchantId);

        await supabaseAdmin.from('billing_events').insert({
          merchant_id: merchantId,
          event: 'cancelled',
          data: { reason: 'ikas_subscription_removed' },
        });
      } else {
        await supabaseAdmin
          .from('merchant_billing')
          .update({ ikas_status: 'REMOVED', ikas_last_synced_at: now, updated_at: now })
          .eq('merchant_id', merchantId);
      }
      return;
    }

    const lastPaymentDate = currentSub.lastPaymentDate
      ? new Date(currentSub.lastPaymentDate as unknown as string)
      : null;
    const storedPeriodStart = billing.current_period_start
      ? new Date(billing.current_period_start)
      : null;

    const periodDays = currentSub.lastPaymentPeriodInDays ?? 365;
    const periodEnd = lastPaymentDate
      ? new Date(lastPaymentDate.getTime() + periodDays * 86400 * 1000).toISOString()
      : null;
    const periodStart = lastPaymentDate?.toISOString() ?? null;

    const isNewSubscription = billing.plan !== 'pro' && billing.plan !== 'enterprise';
    const isRenewal =
      !isNewSubscription &&
      lastPaymentDate &&
      storedPeriodStart &&
      lastPaymentDate > storedPeriodStart;

    const updates: Record<string, unknown> = {
      ikas_status: currentSub.status,
      ikas_subscription_key: currentSub.storeAppListingSubscriptionKey,
      ikas_last_synced_at: now,
      updated_at: now,
    };

    if (isNewSubscription) {
      // Trial → Pro upgrade
      updates.plan = 'pro';
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;

      await supabaseAdmin.from('billing_events').insert({
        merchant_id: merchantId,
        event: 'upgraded',
        data: { plan: 'pro', subscription_key: currentSub.storeAppListingSubscriptionKey },
      });
    } else if (isRenewal) {
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;

      await supabaseAdmin.from('billing_events').insert({
        merchant_id: merchantId,
        event: 'renewed',
        data: { period_start: periodStart, period_end: periodEnd },
      });
    } else if (currentSub.status === 'WILL_BE_REMOVED') {
      updates.status = 'will_expire';
    } else if (billing.status === 'expired' && currentSub.status === 'ACTIVE') {
      // Re-subscribed after expiry
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;
    }

    await supabaseAdmin.from('merchant_billing').update(updates).eq('merchant_id', merchantId);
  } catch (err) {
    console.error('syncMerchantBilling error:', merchantId, err);
  }
}

/** Create a 14-day trial billing record for a new merchant install. */
export async function createTrialBillingRecord(merchantId: string): Promise<void> {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from('merchant_billing')
    .upsert(
      {
        merchant_id: merchantId,
        plan: 'trial',
        status: 'active',
        trial_ends_at: trialEndsAt,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'merchant_id', ignoreDuplicates: true },
    );

  if (error) {
    console.error('createTrialBillingRecord error:', merchantId, error);
    return;
  }

  await supabaseAdmin.from('billing_events').insert({
    merchant_id: merchantId,
    event: 'trial_started',
    data: { trial_ends_at: trialEndsAt },
  });
}
