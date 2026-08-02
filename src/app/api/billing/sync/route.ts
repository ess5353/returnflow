export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { syncMerchantBilling } from '@/lib/billing/sync';

/**
 * POST /api/billing/sync
 * Cron endpoint — syncs billing for all merchants with stale ikas data.
 * Protected by CRON_SECRET. Compatible with cron-job.org / Supabase Cron.
 * Header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = request.headers.get('Authorization') ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Find all merchants with billing records that have an ikas subscription key
  // and haven't been synced in the last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

  const { data: merchants, error } = await supabaseAdmin
    .from('merchant_billing')
    .select('merchant_id')
    .not('ikas_subscription_key', 'is', null)
    .or(`ikas_last_synced_at.is.null,ikas_last_synced_at.lt.${twoHoursAgo}`);

  if (error) {
    console.error('billing/sync: query error:', error);
    return NextResponse.json({ error: 'Query failed' }, { status: 500 });
  }

  // Also fetch auth tokens to map merchantId → authorizedAppId
  const { data: tokens } = await supabaseAdmin
    .from('auth_tokens')
    .select('merchant_id, authorized_app_id')
    .eq('deleted', false);

  const tokenMap = new Map<string, string>(
    (tokens ?? []).map((t) => [t.merchant_id as string, t.authorized_app_id as string]),
  );

  const results = await Promise.allSettled(
    (merchants ?? []).map(async ({ merchant_id }) => {
      const authorizedAppId = tokenMap.get(merchant_id);
      if (!authorizedAppId) return;
      await syncMerchantBilling(merchant_id, authorizedAppId);
    }),
  );

  const succeeded = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return NextResponse.json({
    data: { synced: succeeded, failed, total: merchants?.length ?? 0 },
  });
}
