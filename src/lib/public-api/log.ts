import { supabaseAdmin } from '@/lib/supabase-admin';

export function logApiRequest(params: {
  merchantId: string;
  apiKeyId: string;
  keyPrefix: string;
  endpoint: string;
  method: string;
  responseCode: number;
  responseTimeMs: number;
}): void {
  supabaseAdmin
    .from('api_logs')
    .insert({
      merchant_id: params.merchantId,
      api_key_id: params.apiKeyId,
      key_prefix: params.keyPrefix,
      endpoint: params.endpoint,
      method: params.method,
      response_code: params.responseCode,
      response_time_ms: params.responseTimeMs,
    })
    .then(() => undefined);
}
