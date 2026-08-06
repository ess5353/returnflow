export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { validateIkasWebhookSignature, WebhookScope, type IkasWebhook } from '@ikas/admin-api-client';
import { config } from '@/globals/config';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { syncMerchantBilling } from '@/lib/billing/sync';

/**
 * Receives ikas platform webhooks (app uninstall, app billing/payment events).
 * ikas signs every payload with HMAC-SHA256 over the `data` field using the
 * app's client secret — there is no user session here, the signature IS the
 * authentication. Register this URL as the "Webhook Adresi" in the ikas
 * Partner Panel for the store/app/deleted and store/app/payment scopes.
 */
export async function POST(request: NextRequest) {
  let body: IkasWebhook;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body?.data || !body?.signature) {
    return NextResponse.json({ error: 'Malformed webhook payload' }, { status: 400 });
  }

  if (!validateIkasWebhookSignature(body, config.oauth.clientSecret!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { scope, merchantId, authorizedAppId } = body;

  try {
    if (scope === WebhookScope.APP_DELETED) {
      // Merchant uninstalled the app — stop treating the OAuth token as usable
      // and cut off customer-portal access immediately (mirrors the "no active
      // subscription" branch in syncMerchantBilling).
      await AuthTokenManager.delete(authorizedAppId);

      const { data: billing } = await supabaseAdmin
        .from('merchant_billing')
        .select('status')
        .eq('merchant_id', merchantId)
        .maybeSingle();

      if (billing && billing.status !== 'expired') {
        const now = new Date().toISOString();
        await supabaseAdmin
          .from('merchant_billing')
          .update({ status: 'expired', ikas_status: 'APP_DELETED', updated_at: now })
          .eq('merchant_id', merchantId);

        await supabaseAdmin.from('billing_events').insert({
          merchant_id: merchantId,
          event: 'cancelled',
          data: { reason: 'app_uninstalled' },
        });
      }
    } else if (scope === WebhookScope.APP_PAYMENT) {
      // A payment/subscription event happened — re-sync immediately instead of
      // waiting for the next lazy poll so the dashboard reflects it right away.
      await syncMerchantBilling(merchantId, authorizedAppId);
    }
    // Any other scope: acknowledged, no action needed (we don't currently
    // subscribe to order/product/customer/stock webhooks).
  } catch (err) {
    console.error('ikas webhook handling error:', scope, merchantId, err);
    // Still return 200 — the signature was valid and we don't want ikas
    // retry-storming us over a transient DB error on our side.
  }

  return NextResponse.json({ ok: true });
}
