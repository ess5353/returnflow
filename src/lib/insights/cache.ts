import { supabaseAdmin } from '@/lib/supabase-admin';
import type { InsightsPayload } from './types';

const CACHE_HOURS = 12;

export async function getCachedInsights(merchantId: string): Promise<InsightsPayload | null> {
  const { data } = await supabaseAdmin
    .from('ai_insights_cache')
    .select('insights, expires_at')
    .eq('merchant_id', merchantId)
    .single();

  if (!data) return null;

  if (new Date(data.expires_at as string) < new Date()) return null;

  return data.insights as InsightsPayload;
}

export async function setCachedInsights(
  merchantId: string,
  payload: InsightsPayload,
): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_HOURS * 3600 * 1000).toISOString();

  await supabaseAdmin.from('ai_insights_cache').upsert(
    {
      merchant_id: merchantId,
      insights: payload,
      generated_at: new Date().toISOString(),
      expires_at: expiresAt,
    },
    { onConflict: 'merchant_id' },
  );
}
