// Pure plan-selection logic — NO imports, so it is unit-testable in isolation.

export type AvailableSub = {
  id: string;
  key: string;
  name: string;
  currencyCode: string;
  prices: Array<{ period: 'MONTHLY' | 'YEARLY' | 'ONE_TIME'; price: number }>;
  trialConfig: { days: number };
};

export interface IkasPlan {
  /** The real storeAppListingSubscriptionKey — pass this to createMerchantAppPayment. */
  key: string;
  id: string;
  name: string;
  currencyCode: string;
  yearlyPrice: number | null;
  monthlyPrice: number | null;
  trialDays: number;
}

/**
 * `pinnedKey` (from IKAS_PRO_SUBSCRIPTION_KEY) wins only if it exactly matches a
 * real plan; otherwise prefer a yearly TRY plan, then any yearly plan, then the
 * first. Returns null for an empty list.
 */
export function pickPlan(subs: AvailableSub[], pinnedKey?: string | null): AvailableSub | null {
  if (subs.length === 0) return null;
  const pin = pinnedKey?.trim();
  return (
    (pin ? subs.find((s) => s.key === pin) : undefined) ||
    subs.find((s) => s.currencyCode === 'TRY' && s.prices.some((p) => p.period === 'YEARLY')) ||
    subs.find((s) => s.prices.some((p) => p.period === 'YEARLY')) ||
    subs[0]
  );
}

export function toPlan(chosen: AvailableSub): IkasPlan {
  return {
    key: chosen.key,
    id: chosen.id,
    name: chosen.name,
    currencyCode: chosen.currencyCode,
    yearlyPrice: chosen.prices.find((p) => p.period === 'YEARLY')?.price ?? null,
    monthlyPrice: chosen.prices.find((p) => p.period === 'MONTHLY')?.price ?? null,
    trialDays: chosen.trialConfig?.days ?? 14,
  };
}
