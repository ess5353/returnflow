// DIAGNOSTIC ONLY — remove before production release
import { NextResponse } from 'next/server';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
  try {
    // 1. Raw auth_tokens rows
    const rawResult = await supabaseAdmin
      .from('auth_tokens')
      .select('id, merchant_id, authorized_app_id, deleted');

    // 2. Via AuthTokenManager.list()
    const tokens = await AuthTokenManager.list();
    const activeToken = tokens.find((t) => !t.deleted);

    // 3. ikas API merchant_id
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

    // 4. Recent returns
    const returns = await supabaseAdmin
      .from('return_requests')
      .select('id, merchant_id, rf_number, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. KEY TEST: Insert a row with a known sentinel merchant_id and read back what was actually stored.
    //    If the stored value differs from what we sent, the bug is at the database level (trigger or generated column).
    const sentMerchantId = 'DEBUG-TEST-' + Date.now();
    const testInsertResult = await supabaseAdmin
      .from('return_requests')
      .insert([{
        merchant_id: sentMerchantId,
        rf_number: 'DEBUG-RF',
        order_id: 'DEBUG-ORDER-' + Date.now(),
        customer_name: 'Debug User',
        reason: 'debug',
        amount: '0',
        status: 'DEBUG',
      }])
      .select('id, merchant_id')
      .single();

    const storedMerchantId = testInsertResult.data?.merchant_id ?? null;
    const testInsertError = testInsertResult.error ? JSON.stringify(testInsertResult.error) : null;

    // Clean up test row immediately
    if (testInsertResult.data?.id) {
      await supabaseAdmin.from('return_requests').delete().eq('id', testInsertResult.data.id);
    }

    return NextResponse.json({
      // Auth token info
      auth_tokens_raw: rawResult.data ?? [],
      auth_tokens_via_manager: tokens.map((t) => ({ id: t.id, merchantId: t.merchantId, deleted: t.deleted })),
      active_token_merchantId: activeToken?.merchantId ?? null,
      ikas_getMerchant_id: ikasMerchantId,
      ikas_error: ikasError,

      // Recent return rows
      recent_returns: returns.data ?? [],

      // THE KEY TEST — if sent != stored, the database is overriding merchant_id
      test_insert: {
        sent_merchant_id: sentMerchantId,
        stored_merchant_id: storedMerchantId,
        match: sentMerchantId === storedMerchantId,
        error: testInsertError,
      },

      verdict: sentMerchantId === storedMerchantId
        ? 'DB stores merchant_id correctly — bug is in application code'
        : 'DB is OVERRIDING merchant_id — trigger or generated column suspected',
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
