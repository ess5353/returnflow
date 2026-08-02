import { supabaseAdmin } from '@/lib/supabase-admin';

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
}

const ACTIVE_TRIAL: Entitlement = {
  plan: 'trial',
  status: 'active',
  isActive: true,
  isExpired: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  ikasStatus: null,
};

export async function getBillingEntitlement(merchantId: string): Promise<Entitlement> {
  const { data, error } = await supabaseAdmin
    .from('merchant_billing')
    .select('plan, status, trial_ends_at, current_period_end, ikas_status')
    .eq('merchant_id', merchantId)
    .maybeSingle();

  if (error || !data) return ACTIVE_TRIAL;

  const isExpired =
    data.status === 'expired' ||
    (data.plan === 'trial' && !!data.trial_ends_at && new Date(data.trial_ends_at) < new Date());

  return {
    plan: data.plan as Plan,
    status: isExpired ? 'expired' : (data.status as BillingStatus),
    isActive: !isExpired,
    isExpired,
    trialEndsAt: data.trial_ends_at ?? null,
    currentPeriodEnd: data.current_period_end ?? null,
    ikasStatus: data.ikas_status ?? null,
  };
}
