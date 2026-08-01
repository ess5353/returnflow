export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { computeMerchantStats } from '@/lib/insights/compute';
import { generateDeterministicInsights, generateAIInsights } from '@/lib/insights/generate';
import { getCachedInsights, setCachedInsights } from '@/lib/insights/cache';
import type { InsightsPayload } from '@/lib/insights/types';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Check cache first (unless force refresh requested)
  const forceRefresh = request.nextUrl.searchParams.get('refresh') === '1';
  if (!forceRefresh) {
    const cached = await getCachedInsights(user.merchantId);
    if (cached) {
      return NextResponse.json({ data: cached, cached: true });
    }
  }

  // Compute stats
  const stats = await computeMerchantStats(user.merchantId);

  // Try AI generation, fall back to deterministic
  let insights = await generateAIInsights(stats);
  const aiPowered = insights !== null;
  if (!insights) {
    insights = generateDeterministicInsights(stats);
  }

  const now = new Date();
  const payload: InsightsPayload = {
    insights,
    stats,
    generatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 12 * 3600 * 1000).toISOString(),
    aiPowered,
  };

  // Cache the result
  setCachedInsights(user.merchantId, payload).catch(() => undefined);

  return NextResponse.json({ data: payload, cached: false });
}
