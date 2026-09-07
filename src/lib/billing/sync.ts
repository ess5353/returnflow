import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { ikasRawRequest } from '@/lib/ikas-client/raw-request';
import { GET_MERCHANT_LICENCE } from '@/lib/ikas-client/graphql-requests';

const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

type IkasAppSubscription = {
  id: string;
  name: string;
  status: 'ACTIVE' | 'WILL_BE_REMOVED' | 'REMOVED';
  storeAppListingSubscriptionKey: string;
  lastPaymentDate: number | string | null;
  lastPaymentPeriodInDays: number | null;
  lastPaymentPrice: number | null;
  addedDate: number | string | null;
};

/** Non-blocking lazy sync — fire-and-forget when billing data is stale. */
export function maybeSyncLazy(merchantId: string, authorizedAppId: string): void {
  void Promise.resolve(
    supabaseAdmin
      .from('merchant_billing')
      .select('ikas_last_synced_at')
      .eq('merchant_id', merchantId)
      .maybeSingle(),
  )
    .then(({ data }) => {
      if (!data) return;
      const lastSync = data.ikas_last_synced_at ? new Date(data.ikas_last_synced_at as string).getTime() : 0;
      if (Date.now() - lastSync > STALE_THRESHOLD_MS) {
        void syncMerchantBilling(merchantId, authorizedAppId).catch(() => undefined);
      }
    })
    .catch(() => undefined);
}

/**
 * Full sync: reads the authoritative licence from ikas (`getMerchantLicence`)
 * and reconciles `merchant_billing`. NEVER invents a paid state — it only ever
 * mirrors what ikas reports. A transient ikas failure is a no-op (never mutates
 * billing). This is the single activation path, driven by:
 *   - the paywall's post-purchase poll / "Ödemeyi Kontrol Et"  (/api/billing/confirm)
 *   - the ikas `store/app/payment` webhook, if configured  (/api/ikas/webhook)
 *   - the nightly cron  (/api/billing/sync)
 */
export async function syncMerchantBilling(merchantId: string, authorizedAppId: string): Promise<void> {
  try {
    const authToken = await AuthTokenManager.get(authorizedAppId);
    if (!authToken) return;

    const licence = await ikasRawRequest<{
      getMerchantLicence: { merchantId: string; appSubscriptions: IkasAppSubscription[] | null } | null;
    }>(authToken, GET_MERCHANT_LICENCE);

    // A transient ikas failure must not mutate billing state.
    if (!licence.ok || !licence.data?.getMerchantLicence) {
      console.warn('[syncMerchantBilling] licence read failed', merchantId, licence.httpStatus, licence.errors?.[0]?.message);
      return;
    }

    const appSubs = licence.data.getMerchantLicence.appSubscriptions ?? [];
    const activeSub = appSubs.find((s) => s.status === 'ACTIVE');
    const willExpireSub = appSubs.find((s) => s.status === 'WILL_BE_REMOVED');
    const currentSub = activeSub ?? willExpireSub;

    const { data: billing } = await supabaseAdmin
      .from('merchant_billing')
      .select('plan, status, current_period_start, trial_ends_at, ikas_status')
      .eq('merchant_id', merchantId)
      .maybeSingle();

    if (!billing) return;

    const now = new Date().toISOString();
    const DELETION_MARKERS = ['APP_DELETED', 'REMOVED'];
    const staleDeletionMarker = DELETION_MARKERS.includes(billing.ikas_status ?? '');
    const trialWindowStillOpen =
      billing.plan === 'trial' &&
      !!billing.trial_ends_at &&
      new Date(billing.trial_ends_at).getTime() > Date.now();

    if (!currentSub) {
      if (billing.plan !== 'trial' && billing.plan !== 'enterprise' && billing.status !== 'expired') {
        // Paid plan whose subscription really was removed on ikas — expire it.
        await supabaseAdmin
          .from('merchant_billing')
          .update({ status: 'expired', ikas_status: 'REMOVED', ikas_last_synced_at: now, updated_at: now })
          .eq('merchant_id', merchantId);
        await supabaseAdmin.from('billing_events').insert({
          merchant_id: merchantId,
          event: 'cancelled',
          data: { reason: 'ikas_subscription_removed' },
        });
      } else if (staleDeletionMarker && trialWindowStillOpen && billing.status === 'expired') {
        // Uninstalled then reinstalled while the original trial is still open.
        await supabaseAdmin
          .from('merchant_billing')
          .update({ status: 'active', ikas_status: null, ikas_last_synced_at: now, updated_at: now })
          .eq('merchant_id', merchantId);
        await supabaseAdmin.from('billing_events').insert({
          merchant_id: merchantId,
          event: 'trial_started',
          data: { reason: 'reinstalled_during_trial', trial_ends_at: billing.trial_ends_at },
        });
      } else {
        await supabaseAdmin
          .from('merchant_billing')
          .update({
            ikas_status: staleDeletionMarker ? null : (billing.ikas_status ?? null),
            ikas_last_synced_at: now,
            updated_at: now,
          })
          .eq('merchant_id', merchantId);
      }
      return;
    }

    // ── There IS an active / winding-down subscription on ikas ───────────────
    const lastPaymentMs = toMs(currentSub.lastPaymentDate);
    const lastPaymentDate = lastPaymentMs ? new Date(lastPaymentMs) : null;
    const storedPeriodStart = billing.current_period_start ? new Date(billing.current_period_start) : null;

    const periodDays = currentSub.lastPaymentPeriodInDays ?? 365;
    const periodEnd = lastPaymentDate
      ? new Date(lastPaymentDate.getTime() + periodDays * 86400 * 1000).toISOString()
      : null;
    const periodStart = lastPaymentDate?.toISOString() ?? null;

    const wasPaidPlan = billing.plan === 'pro' || billing.plan === 'enterprise';
    const isNewSubscription = !wasPaidPlan; // trial/expired → first paid activation
    const isRenewal =
      wasPaidPlan && !!lastPaymentDate && !!storedPeriodStart && lastPaymentDate > storedPeriodStart;

    const updates: Record<string, unknown> = {
      ikas_status: currentSub.status,
      ikas_subscription_key: currentSub.storeAppListingSubscriptionKey,
      ikas_last_synced_at: now,
      updated_at: now,
    };

    if (isNewSubscription) {
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
      if (periodEnd) updates.current_period_end = periodEnd;
    } else if (billing.status === 'expired' && currentSub.status === 'ACTIVE') {
      updates.status = 'active';
      updates.current_period_start = periodStart;
      updates.current_period_end = periodEnd;
    } else if (currentSub.status === 'ACTIVE' && billing.status === 'will_expire') {
      // Merchant re-enabled auto-renew before the period ended.
      updates.status = 'active';
    }

    await supabaseAdmin.from('merchant_billing').update(updates).eq('merchant_id', merchantId);
  } catch (err) {
    console.error('syncMerchantBilling error:', merchantId, err);
  }
}

function toMs(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (Number.isFinite(n)) return n;
  const d = new Date(v).getTime();
  return Number.isFinite(d) ? d : null;
}

/** Create a 14-day trial billing record for a new merchant install. */
export async function createTrialBillingRecord(merchantId: string): Promise<void> {
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from('merchant_billing').upsert(
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
