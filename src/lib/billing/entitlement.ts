import { supabaseAdmin } from '@/lib/supabase-admin';

export type Plan = 'trial' | 'pro' | 'enterprise' | 'expired';
export type BillingStatus = 'active' | 'expired' | 'will_expire' | 'cancelled';

export interface Entitlement {
  plan: Plan;
  status: BillingStatus;
  isActive: boolean;
  isExpired: boolean;
  requestsLimit: number;   // -1 = unlimited
  requestsUsed: number;
  remainingRequests: number | null;  // null = unlimited
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  ikasStatus: string | null;
}

const UNLIMITED: Entitlement = {
  plan: 'trial',
  status: 'active',
  isActive: true,
  isExpired: false,
  requestsLimit: -1,
  requestsUsed: 0,
  remainingRequests: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  ikasStatus: null,
};

export async function getBillingEntitlement(merchantId: string): Promise<Entitlement> {
  const { data, error } = await supabaseAdmin
    .from('merchant_billing')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error || !data) return UNLIMITED;

  const now = new Date();
  let isExpired = data.status === 'expired';

  if (!isExpired && data.plan === 'trial' && data.trial_ends_at) {
    if (new Date(data.trial_ends_at) < now) isExpired = true;
  }

  const requestsLimit: number = data.requests_limit ?? -1;
  const requestsUsed: number = data.requests_used_this_period ?? 0;
  const hitLimit = requestsLimit !== -1 && requestsUsed >= requestsLimit;
  const isActive = !isExpired && !hitLimit;
  const remainingRequests = requestsLimit === -1 ? null : Math.max(0, requestsLimit - requestsUsed);

  return {
    plan: data.plan as Plan,
    status: isExpired ? 'expired' : (data.status as BillingStatus),
    isActive,
    isExpired: isExpired || hitLimit,
    requestsLimit,
    requestsUsed,
    remainingRequests,
    trialEndsAt: data.trial_ends_at ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    ikasStatus: data.ikas_status ?? null,
  };
}
