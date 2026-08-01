import { supabaseAdmin } from '@/lib/supabase-admin';

const LIMIT = 100;

export async function checkRateLimit(apiKeyId: string): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();

  const { count } = await supabaseAdmin
    .from('api_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('created_at', windowStart);

  const used = count ?? 0;
  const remaining = Math.max(0, LIMIT - used);
  return { allowed: used < LIMIT, remaining };
}
