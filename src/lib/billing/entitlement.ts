import { supabaseAdmin } from '@/lib/supabase-admin';
import { TRIAL_DAYS } from './constants';
import { evaluateEntitlement, type BillingRow, type Entitlement } from './entitlement-logic';

export { TRIAL_DAYS, PRO_PLAN_NAME, PRO_PRICE_LABEL } from './constants';
export { evaluateEntitlement } from './entitlement-logic';
export type { Plan, BillingStatus, Entitlement, BillingRow } from './entitlement-logic';

/**
 * Authoritative, server-side entitlement for a merchant. Reads only our own
 * billing store (populated by the OAuth install, the ikas billing webhook and
 * the nightly licence sync) — never trusts anything supplied by the browser.
 *
 * Self-heals a missing or half-written billing row: an install that predates
 * `createTrialBillingRecord` (or where it failed) gets a trial row anchored to
 * the real install date, so a merchant installed 30 days ago is correctly
 * treated as trial-expired rather than handed an unlimited free ride.
 */
export async function getBillingEntitlement(merchantId: string): Promise<Entitlement> {
  if (!merchantId) return evaluateEntitlement(null);

  const { data, error } = await supabaseAdmin
    .from('merchant_billing')
    .select('plan, status, trial_ends_at, current_period_end, ikas_status, created_at')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (!error && data) {
    // Repair a trial row that never got an end date — anchor it to the row's
    // own creation (or the install date) so it cannot become an unlimited
    // free ride.
    if ((data.plan ?? 'trial') === 'trial' && !data.trial_ends_at) {
      const repaired = await repairTrialEndDate(merchantId, (data.created_at as string | null) ?? null);
      return evaluateEntitlement(repaired ?? (data as BillingRow));
    }
    return evaluateEntitlement(data as BillingRow);
  }

  // A transient DB read error must not flip a merchant to "expired" (which
  // could trigger side-effects elsewhere). Distinguish it from a genuine
  // "no row" result: on error we fail OPEN for this request only, without
  // persisting anything.
  if (error) {
    console.error('getBillingEntitlement read error:', merchantId, error.message);
    return evaluateEntitlement({
      plan: 'trial',
      status: 'active',
      trial_ends_at: null,
      current_period_end: null,
      ikas_status: null,
    });
  }

  // Genuinely no billing row — backfill one anchored to the install date.
  const anchored = await backfillTrialRow(merchantId);
  return evaluateEntitlement(anchored);
}

/**
 * Creates the missing trial row for a merchant using their real install
 * timestamp (from auth_tokens) as the anchor. If we cannot even find an install
 * record the merchant cannot be served anyway, so we return null (→ blocked).
 */
async function backfillTrialRow(merchantId: string): Promise<BillingRow | null> {
  const anchorMs = await installAnchorMs(merchantId);
  if (anchorMs == null) return null;

  const trialEndsAt = new Date(anchorMs + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  const { data: upserted } = await supabaseAdmin
    .from('merchant_billing')
    .upsert(
      {
        merchant_id: merchantId,
        plan: 'trial',
        status: 'active',
        trial_ends_at: trialEndsAt,
        created_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'merchant_id', ignoreDuplicates: true },
    )
    .select('plan, status, trial_ends_at, current_period_end, ikas_status')
    .maybeSingle();

  if (upserted) return upserted as BillingRow;

  // A concurrent request won the upsert race — re-read the row it wrote.
  const { data: fresh } = await supabaseAdmin
    .from('merchant_billing')
    .select('plan, status, trial_ends_at, current_period_end, ikas_status')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  return (
    (fresh as BillingRow | null) ?? {
      plan: 'trial',
      status: 'active',
      trial_ends_at: trialEndsAt,
      current_period_end: null,
      ikas_status: null,
    }
  );
}

/**
 * Sets `trial_ends_at` on an existing trial row that is missing one, anchored
 * to the row's creation date (fallback: the install date, else now).
 */
async function repairTrialEndDate(
  merchantId: string,
  rowCreatedAt: string | null,
): Promise<BillingRow | null> {
  let anchorMs = rowCreatedAt ? new Date(rowCreatedAt).getTime() : NaN;
  if (Number.isNaN(anchorMs)) {
    anchorMs = (await installAnchorMs(merchantId)) ?? Date.now();
  }

  const trialEndsAt = new Date(anchorMs + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: updated } = await supabaseAdmin
    .from('merchant_billing')
    .update({ trial_ends_at: trialEndsAt, updated_at: new Date().toISOString() })
    .eq('merchant_id', merchantId)
    .eq('plan', 'trial')
    .is('trial_ends_at', null)
    .select('plan, status, trial_ends_at, current_period_end, ikas_status')
    .maybeSingle();

  if (updated) return updated as BillingRow;

  const { data: fresh } = await supabaseAdmin
    .from('merchant_billing')
    .select('plan, status, trial_ends_at, current_period_end, ikas_status')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  return (fresh as BillingRow | null) ?? null;
}

/** Earliest install timestamp for the merchant (ms), or null if never installed. */
async function installAnchorMs(merchantId: string): Promise<number | null> {
  const { data } = await supabaseAdmin
    .from('auth_tokens')
    .select('created_at')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!data?.created_at) return null;
  const ms = new Date(data.created_at as string).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/** Convenience boolean — true when the merchant may use operational features. */
export async function canMerchantUseApp(merchantId: string): Promise<boolean> {
  return (await getBillingEntitlement(merchantId)).isActive;
}
