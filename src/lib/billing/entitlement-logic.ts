// Pure entitlement decision logic. NO I/O and NO imports at all, so it can be
// unit-tested directly and imported from anywhere. The "14-day trial active OR
// active paid subscription" rule lives here and nowhere else.

export type Plan = 'trial' | 'pro' | 'enterprise' | 'expired';
export type BillingStatus = 'active' | 'expired' | 'will_expire';

export interface Entitlement {
  plan: Plan;
  status: BillingStatus;
  isActive: boolean;
  isExpired: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  ikasStatus: string | null;
  /** Machine-readable reason the app is blocked (null when access is allowed). */
  blockedReason: 'trial_expired' | 'subscription_expired' | 'not_installed' | null;
}

export type BillingRow = {
  plan: string | null;
  status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  ikas_status: string | null;
};

/**
 * Grace window applied to a *paid* subscription after `current_period_end`
 * passes, before the app is blocked. ikas licence state and our nightly sync
 * are not instantaneous, so a renewal ikas has accepted but we haven't synced
 * yet must not lock the merchant out. Trials get NO grace.
 */
export const PAID_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export function evaluateEntitlement(row: BillingRow | null, now: Date = new Date()): Entitlement {
  // No billing row at all — the caller could not establish any trial/paid state
  // for this merchant. Fail CLOSED: an unknown merchant has no access.
  if (!row) {
    return {
      plan: 'expired',
      status: 'expired',
      isActive: false,
      isExpired: true,
      trialEndsAt: null,
      currentPeriodEnd: null,
      ikasStatus: null,
      blockedReason: 'not_installed',
    };
  }

  const plan = (row.plan ?? 'trial') as Plan;
  const nowMs = now.getTime();
  const isPaidPlan = plan === 'pro' || plan === 'enterprise';

  const trialEnded =
    plan === 'trial' && !!row.trial_ends_at && new Date(row.trial_ends_at).getTime() < nowMs;

  // A paid subscription is over when either our sync/webhook has already marked
  // it expired, or its paid period ended more than the grace window ago with no
  // renewal synced. Enterprise rows generally carry no period end and are
  // managed manually, so a missing current_period_end never expires them.
  const paidPeriodOver =
    isPaidPlan &&
    !!row.current_period_end &&
    new Date(row.current_period_end).getTime() + PAID_GRACE_MS < nowMs;

  const explicitlyExpired = row.status === 'expired';

  let isExpired: boolean;
  let blockedReason: Entitlement['blockedReason'] = null;

  if (explicitlyExpired) {
    isExpired = true;
    blockedReason = plan === 'trial' ? 'trial_expired' : 'subscription_expired';
  } else if (trialEnded) {
    isExpired = true;
    blockedReason = 'trial_expired';
  } else if (paidPeriodOver) {
    isExpired = true;
    blockedReason = 'subscription_expired';
  } else {
    isExpired = false;
  }

  return {
    plan: isExpired ? (plan === 'trial' ? 'trial' : plan) : plan,
    status: isExpired ? 'expired' : ((row.status ?? 'active') as BillingStatus),
    isActive: !isExpired,
    isExpired,
    trialEndsAt: row.trial_ends_at ?? null,
    currentPeriodEnd: row.current_period_end ?? null,
    ikasStatus: row.ikas_status ?? null,
    blockedReason,
  };
}
