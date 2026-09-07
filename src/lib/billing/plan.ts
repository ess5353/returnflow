import type { AuthToken } from '@/models/auth-token';
import { ikasRawRequest } from '@/lib/ikas-client/raw-request';
import { GET_AVAILABLE_SUBSCRIPTIONS } from '@/lib/ikas-client/graphql-requests';
import { pickPlan, toPlan, type AvailableSub, type IkasPlan } from './plan-select';

export type { IkasPlan, AvailableSub } from './plan-select';
export { pickPlan, toPlan } from './plan-select';

export interface ResolvePlanResult {
  plan: IkasPlan | null;
  /** null on success; a machine code + message when the plan could not be resolved. */
  error: { code: string; httpStatus: number; message: string } | null;
}

/**
 * Resolves the app's published subscription plan straight from ikas
 * (`getAvailableSubscriptions`). The `storeAppListingSubscriptionKey` is NEVER
 * hardcoded — ikas generates it from the plan name and it can contain
 * codepoints (combining marks, `&`, Turkish letters) that do not survive being
 * typed into an env var.
 *
 * `IKAS_PRO_SUBSCRIPTION_KEY`, when set, is only an *optional pin*: it is used
 * only if it exactly matches a plan ikas returns; otherwise it is ignored. A
 * stale or wrong env value can therefore never break the purchase flow again.
 */
export async function resolveActivePlan(token: AuthToken): Promise<ResolvePlanResult> {
  const res = await ikasRawRequest<{ getAvailableSubscriptions: AvailableSub[] }>(
    token,
    GET_AVAILABLE_SUBSCRIPTIONS,
  );

  if (!res.ok || !res.data?.getAvailableSubscriptions) {
    return {
      plan: null,
      error: {
        code:
          (res.errors?.[0]?.extensions?.code as string | undefined) ?? 'AVAILABLE_SUBSCRIPTIONS_FAILED',
        httpStatus: res.httpStatus,
        message: res.errors?.[0]?.message ?? 'getAvailableSubscriptions failed',
      },
    };
  }

  const chosen = pickPlan(res.data.getAvailableSubscriptions, process.env.IKAS_PRO_SUBSCRIPTION_KEY);
  if (!chosen) {
    return {
      plan: null,
      error: {
        code: 'NO_PUBLISHED_PLAN',
        httpStatus: res.httpStatus,
        message: 'ikas returned zero available subscriptions for this app (listing not published?)',
      },
    };
  }

  return { plan: toPlan(chosen), error: null };
}
