import { supabaseAdmin } from '@/lib/supabase-admin';

export interface UsageResult {
  allowed: boolean;
  reason: 'PLAN_EXPIRED' | 'PLAN_LIMIT_REACHED' | null;
  requestsUsed: number;
  requestsLimit: number;
}

/**
 * Atomically checks and increments the monthly usage counter via a PostgreSQL RPC.
 * The SQL function holds a row lock, so concurrent calls are safe.
 * Fails open (allows) on DB error to avoid blocking customers.
 */
export async function incrementUsage(
  merchantId: string,
  eventType: 'return_submission' | 'exchange_submission',
  returnId?: string,
): Promise<UsageResult> {
  const { data, error } = await supabaseAdmin.rpc('increment_billing_usage', {
    p_merchant_id: merchantId,
    p_event_type: eventType,
    p_return_id: returnId ?? null,
  });

  if (error) {
    console.error('billing.incrementUsage error:', error);
    return { allowed: true, reason: null, requestsUsed: 0, requestsLimit: -1 };
  }

  return {
    allowed: data.allowed as boolean,
    reason: (data.reason as UsageResult['reason']) ?? null,
    requestsUsed: data.requests_used as number,
    requestsLimit: data.requests_limit as number,
  };
}
