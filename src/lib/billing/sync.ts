import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

/** Returns 'pro' if the key matches our configured subscription key, null otherwise. */
function determinePlan(subKey: string | null | undefined): 'pro' | null {
  if (!subKey) return null;
  const proKey = process.env.IKAS_PRO_SUBSCRIPTION_KEY;
  if (proKey && subKey === proKey) return 'pro';
  return 'pro'; // treat any unrecognised paid key as pro
}

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
      .select('plan, status, current_period_start, ikas_subscription_key')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!billing) return;

    if (!currentSub) {
      // Subscription removed — expire if on a paid plan
      if (billing.plan !== 'trial' && billing.plan !== 'enterprise' && billing.status !== 'expired') {
        await supabaseAdmin
          .from('merchant_billing')
          .update({
            status: 'expired',
            ikas_status: 'REMOVED',
            ikas_last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('merchant_id', merchantId);

        await supabaseAdmin.from('billing_events').insert({
          merchant_id: merchantId,
          event: 'cancelled',
          data: { reason: 'ikas_subscription_removed' },
        });
      } else {
        await supabaseAdmin
          .from('merchant_billing')
          .update({
            ikas_status: 'REMOVED',
            ikas_last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('merchant_id', merchantId);
      }
      return;
    }

    const detectedPlan = determinePlan(currentSub.storeAppListingSubscriptionKey);
    const planChanged = detectedPlan && billing.plan !== detectedPlan && billing.plan !== 'enterprise';

    const lastPaymentDate = currentSub.lastPaymentDate
      ? new Date(currentSub.lastPaymentDate as unknown as string)
      : null;
    const storedPeriodStart = billing.current_period_start
      ? new Date(billing.current_period_start)
      : null;
    const isRenewal =
      lastPaymentDate && storedPeriodStart && lastPaymentDate > storedPeriodStart;

    const periodDays = currentSub.lastPaymentPeriodInDays ?? 30;
    const periodEnd = lastPaymentDate
      ? new Date(lastPaymentDate.getTime() + periodDays * 86400 * 1000).toISOString()
      : null;
    const periodStart = lastPaymentDate?.toISOString() ?? null;

    const updates: Record<string, unknown> = {
      ikas_status: currentSub.status,
      ikas_subscription_key: currentSub.storeAppListingSubscriptionKey,
      ikas_last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (planChanged) {
      updates.plan = detectedPlan;
      updates.status = 'active';
      updates.requests_limit = 1000;
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;
      updates.requests_used_this_period = 0;

      await supabaseAdmin.from('billing_events').insert({
        merchant_id: merchantId,
        event: 'upgraded',
        data: { plan: detectedPlan, subscription_key: currentSub.storeAppListingSubscriptionKey },
      });
    } else if (isRenewal) {
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;
      updates.requests_used_this_period = 0;

      await supabaseAdmin.from('billing_events').insert({
        merchant_id: merchantId,
        event: 'renewed',
        data: { period_start: periodStart, period_end: periodEnd },
      });
    } else if (currentSub.status === 'WILL_BE_REMOVED') {
      updates.status = 'will_expire';
    } else if (billing.status === 'expired' && currentSub.status === 'ACTIVE') {
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;
      updates.requests_used_this_period = 0;
    }

    await supabaseAdmin.from('merchant_billing').update(updates).eq('merchant_id', merchantId);
  } catch (err) {
    console.error('syncMerchantBilling error:', merchantId, err);
  }
}

/** Create an initial 14-day trial billing record for a new merchant install. */
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
        requests_limit: -1,
        requests_used_this_period: 0,
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
