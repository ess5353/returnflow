import { supabaseAdmin } from '@/lib/supabase-admin';

/** Resolve a public store_key to its merchant_id. Returns null if not found. */
export async function resolveStoreKey(storeKey: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('store_settings')
    .select('merchant_id')
    .eq('store_key', storeKey)
    .maybeSingle();
  return data?.merchant_id ?? null;
}
