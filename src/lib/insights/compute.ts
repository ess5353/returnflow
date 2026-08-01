import { supabaseAdmin } from '@/lib/supabase-admin';
import type { MerchantStats, TopItem, WeeklyPoint } from './types';

function topN(
  items: Record<string, number>,
  total: number,
  n = 5,
): TopItem[] {
  return Object.entries(items)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({
      label,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function weekLabel(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

function truncateToWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday start
  return d.toISOString();
}

export async function computeMerchantStats(merchantId: string): Promise<MerchantStats> {
  const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 3600 * 1000).toISOString();

  // Fetch all returns (no date filter for aggregates, date filter for trend)
  const [{ data: allRows }, { data: trendRows }, { data: autoLogs }] = await Promise.all([
    supabaseAdmin
      .from('return_requests')
      .select('id, status, request_type, amount, customer_email, customer_name, product, reason, created_at, updated_at')
      .eq('merchant_id', merchantId),
    supabaseAdmin
      .from('return_requests')
      .select('id, request_type, created_at')
      .eq('merchant_id', merchantId)
      .gte('created_at', eightWeeksAgo),
    supabaseAdmin
      .from('automation_logs')
      .select('rule_name, action_taken, return_request_id')
      .eq('merchant_id', merchantId)
      .eq('matched', true),
  ]);

  const rows = allRows ?? [];
  const trend = trendRows ?? [];
  const logs = autoLogs ?? [];

  // ── Basic counts ──────────────────────────────────────────────────────────
  const totalReturns = rows.filter((r) => (r.request_type ?? 'return') === 'return').length;
  const totalExchanges = rows.filter((r) => r.request_type === 'exchange').length;
  const totalRequests = rows.length;

  // ── Status distribution ───────────────────────────────────────────────────
  const byStatus: Record<string, number> = {};
  for (const r of rows) {
    const s = (r.status as string) ?? 'Bilinmiyor';
    byStatus[s] = (byStatus[s] ?? 0) + 1;
  }

  // ── Weekly trend (last 8 weeks) ───────────────────────────────────────────
  const weekMap: Record<string, { returns: number; exchanges: number; date: Date }> = {};
  // Pre-populate 8 week slots
  for (let i = 7; i >= 0; i--) {
    const d = new Date(Date.now() - i * 7 * 24 * 3600 * 1000);
    const key = truncateToWeek(d);
    if (!weekMap[key]) weekMap[key] = { returns: 0, exchanges: 0, date: new Date(key) };
  }
  for (const r of trend) {
    const key = truncateToWeek(new Date(r.created_at as string));
    if (!weekMap[key]) weekMap[key] = { returns: 0, exchanges: 0, date: new Date(key) };
    if ((r.request_type ?? 'return') === 'return') weekMap[key].returns++;
    else weekMap[key].exchanges++;
  }
  const weeklyTrend: WeeklyPoint[] = Object.entries(weekMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([, v]) => ({ week: weekLabel(v.date), returns: v.returns, exchanges: v.exchanges }));

  // ── Top products ──────────────────────────────────────────────────────────
  const productCounts: Record<string, number> = {};
  for (const r of rows.filter((r) => (r.request_type ?? 'return') === 'return')) {
    const p = ((r.product as string) || 'Belirtilmemiş').trim();
    productCounts[p] = (productCounts[p] ?? 0) + 1;
  }
  const topReturnedProducts = topN(productCounts, totalReturns);

  // ── Top reasons ───────────────────────────────────────────────────────────
  const reasonCounts: Record<string, number> = {};
  for (const r of rows) {
    const reason = ((r.reason as string) || 'Belirtilmemiş').trim();
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }
  const topReturnReasons = topN(reasonCounts, totalRequests);

  // ── Automation ────────────────────────────────────────────────────────────
  const automatedIds = new Set(logs.map((l) => l.return_request_id as string));
  const totalAutomated = automatedIds.size;
  const automationMatchRate = totalRequests > 0 ? Math.round((totalAutomated / totalRequests) * 100) : 0;

  const ruleCounts: Record<string, number> = {};
  for (const l of logs) {
    const name = (l.rule_name as string) || (l.action_taken as string) || 'Bilinmiyor';
    ruleCounts[name] = (ruleCounts[name] ?? 0) + 1;
  }
  const topAutomationRules = Object.entries(ruleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ruleName, count]) => ({ ruleName, count }));

  // ── Financial ─────────────────────────────────────────────────────────────
  let totalAmount = 0;
  let approvedAmount = 0;
  let rejectedAmount = 0;
  for (const r of rows) {
    const amt = parseFloat(r.amount as string ?? '0');
    if (!isNaN(amt)) {
      totalAmount += amt;
      if (r.status === 'Onaylandı' || r.status === 'Tamamlandı') approvedAmount += amt;
      if (r.status === 'Reddedildi') rejectedAmount += amt;
    }
  }
  const avgAmount = totalRequests > 0 ? totalAmount / totalRequests : 0;

  // ── Customer behaviour ────────────────────────────────────────────────────
  const emailCounts: Record<string, number> = {};
  for (const r of rows) {
    const email = ((r.customer_email as string) || (r.customer_name as string) || '').toLowerCase().trim();
    if (email) emailCounts[email] = (emailCounts[email] ?? 0) + 1;
  }
  const totalUniqueCustomers = Object.keys(emailCounts).length;
  const repeatCustomers = Object.values(emailCounts).filter((c) => c > 1).length;

  // Average resolution days (updated_at - created_at) for resolved requests
  const resolved = rows.filter((r) => r.status === 'Tamamlandı' || r.status === 'Onaylandı' || r.status === 'Reddedildi');
  let totalResolutionMs = 0;
  for (const r of resolved) {
    const diff = new Date(r.updated_at as string).getTime() - new Date(r.created_at as string).getTime();
    if (diff > 0) totalResolutionMs += diff;
  }
  const avgResolutionDays = resolved.length > 0
    ? Math.round((totalResolutionMs / resolved.length / (1000 * 3600 * 24)) * 10) / 10
    : 0;

  return {
    totalRequests,
    totalReturns,
    totalExchanges,
    byStatus,
    weeklyTrend,
    topReturnedProducts,
    topReturnReasons,
    totalAutomated,
    automationMatchRate,
    topAutomationRules,
    totalAmount,
    approvedAmount,
    rejectedAmount,
    avgAmount,
    totalUniqueCustomers,
    repeatCustomers,
    avgResolutionDays,
  };
}
