import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { NextRequest } from 'next/server';

export type ApiKeyContext = {
  apiKeyId: string;
  merchantId: string;
  keyPrefix: string;
  keyHash: string;
};

export async function validateApiKey(request: NextRequest): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const { data } = await supabaseAdmin
    .from('api_keys')
    .select('id, merchant_id, key_prefix, enabled, expires_at, revoked_at')
    .eq('key_hash', keyHash)
    .single();

  if (!data) return null;
  if (!data.enabled) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  // Update last_used_at fire-and-forget
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => undefined);

  return {
    apiKeyId: data.id as string,
    merchantId: data.merchant_id as string,
    keyPrefix: data.key_prefix as string,
    keyHash,
  };
}
