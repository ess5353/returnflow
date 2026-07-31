// DIAGNOSTIC ONLY — remove before production release
import { NextResponse } from 'next/server';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // Step 1: raw auth_tokens rows
    const rawResult = await supabaseAdmin.from('auth_tokens').select('id, merchant_id, authorized_app_id, deleted');
    const rawRows = rawResult.data ?? [];

    // Step 2: via AuthTokenManager.list()
    const tokens = await AuthTokenManager.list();
    const activeToken = tokens.find((t) => !t.deleted);

    // Step 3: ikas API merchant_id (if token exists)
    let ikasMerchantId: string | null = null;
    let ikasError: string | null = null;
    if (activeToken) {
      try {
        const ikas = getIkas(activeToken);
        const res = await ikas.queries.getMerchant();
        ikasMerchantId = res.data?.getMerchant?.id ?? null;
      } catch (e) {
        ikasError = String(e);
      }
    }

    // Step 4: sample return_requests rows
    const returns = await supabaseAdmin
      .from('return_requests')
      .select('id, merchant_id, rf_number, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    return NextResponse.json({
      auth_tokens_raw: rawRows,
      auth_tokens_via_manager: tokens.map((t) => ({ id: t.id, merchantId: t.merchantId, deleted: t.deleted })),
      active_token_merchantId: activeToken?.merchantId ?? null,
      ikas_getMerchant_id: ikasMerchantId,
      ikas_error: ikasError,
      recent_returns: returns.data ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
