export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';

// ── Types ──────────────────────────────────────────────────────────────────

type ReturnRow = {
  id: string;
  merchant_id: string;
  order_id: string;
  rf_number: string;
  customer_name: string;
  customer_email: string | null;
  product: string;
  reason: string;
  description: string | null;
  amount: string;
  status: string;
  media_urls: string[] | null;
};

type Condition = {
  field: string;
  operator: string;
  value: string | string[];
};

type AutomationRule = {
  id: string;
  merchant_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  condition_logic: 'AND' | 'OR';
  conditions: Condition[];
  action: 'auto_approve' | 'auto_reject' | 'move_to_review';
  action_note: string | null;
};

// ── Evaluation engine (extensible: add new fields/operators here) ──────────

function evaluateCondition(row: ReturnRow, c: Condition): boolean {
  const rawValue = (row as Record<string, unknown>)[c.field];

  // media_urls is a JSON array — needs special handling
  if (c.field === 'media_urls') {
    const arr = Array.isArray(rawValue) ? rawValue : [];
    if (c.operator === 'is_empty') return arr.length === 0;
    if (c.operator === 'is_not_empty') return arr.length > 0;
    return false;
  }

  const fieldStr = rawValue === null || rawValue === undefined ? '' : String(rawValue);

  switch (c.operator) {
    case 'eq': return fieldStr.toLowerCase() === String(c.value).toLowerCase();
    case 'not_eq': return fieldStr.toLowerCase() !== String(c.value).toLowerCase();
    case 'lt': return Number(fieldStr) < Number(c.value);
    case 'lte': return Number(fieldStr) <= Number(c.value);
    case 'gt': return Number(fieldStr) > Number(c.value);
    case 'gte': return Number(fieldStr) >= Number(c.value);
    case 'contains': return fieldStr.toLowerCase().includes(String(c.value).toLowerCase());
    case 'not_contains': return !fieldStr.toLowerCase().includes(String(c.value).toLowerCase());
    case 'ends_with': return fieldStr.toLowerCase().endsWith(String(c.value).toLowerCase());
    case 'is_empty': return !fieldStr.trim();
    case 'is_not_empty': return !!fieldStr.trim();
    default: return false;
  }
}

function evaluateRule(row: ReturnRow, rule: AutomationRule): boolean {
  if (!rule.conditions || rule.conditions.length === 0) return false;
  const results = rule.conditions.map((c) => evaluateCondition(row, c));
  return rule.condition_logic === 'OR' ? results.some(Boolean) : results.every(Boolean);
}

// ── Route ──────────────────────────────────────────────────────────────────

// Called internally after a return is created. Takes the return ID,
// fetches rules for that merchant, applies first matching rule.
export async function POST(request: NextRequest) {
  let body: { return_id: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { return_id } = body;
  if (!return_id) return NextResponse.json({ error: 'return_id required' }, { status: 400 });

  // Fetch the return
  const { data: row, error: rowError } = await supabaseAdmin
    .from('return_requests')
    .select('*')
    .eq('id', return_id)
    .single();

  if (rowError || !row) {
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }

  const returnRow = row as ReturnRow;

  // Only evaluate against newly submitted returns
  if (returnRow.status !== 'Yeni Talep') {
    return NextResponse.json({ evaluated: false, reason: 'status_not_new' });
  }

  // Fetch enabled rules for this merchant, ordered by priority
  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('merchant_id', returnRow.merchant_id)
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (rulesError) {
    console.error('automation rules fetch error:', rulesError);
    return NextResponse.json({ evaluated: false, reason: 'rules_fetch_error' });
  }

  if (!rules || rules.length === 0) {
    return NextResponse.json({ evaluated: true, matched: false });
  }

  // First-match-wins evaluation
  let matchedRule: AutomationRule | null = null;
  for (const rule of rules as AutomationRule[]) {
    if (evaluateRule(returnRow, rule)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    // Log all rules as unmatched (only log if there are rules to evaluate)
    await supabaseAdmin.from('automation_logs').insert(
      (rules as AutomationRule[]).map((r) => ({
        merchant_id: returnRow.merchant_id,
        rule_id: r.id,
        return_request_id: return_id,
        rule_name: r.name,
        matched: false,
        action_taken: null,
      })),
    );
    return NextResponse.json({ evaluated: true, matched: false });
  }

  // Apply action
  const ACTION_STATUS: Record<string, string> = {
    auto_approve: 'Onaylandı',
    auto_reject: 'Reddedildi',
    move_to_review: 'İncelemede',
  };
  const ACTION_NOTE_PREFIX: Record<string, string> = {
    auto_approve: 'Otomatik onaylandı',
    auto_reject: 'Otomatik reddedildi',
    move_to_review: 'İncelemeye gönderildi',
  };
  const newStatus = ACTION_STATUS[matchedRule.action] ?? 'İncelemede';
  const notePrefix = ACTION_NOTE_PREFIX[matchedRule.action] ?? 'İşlem uygulandı';
  const adminNote = matchedRule.action_note
    ? `[${notePrefix}] ${matchedRule.action_note}`
    : `[${notePrefix}] Kural: ${matchedRule.name}`;

  await supabaseAdmin
    .from('return_requests')
    .update({ status: newStatus, admin_note: adminNote })
    .eq('id', return_id);

  // Log the matched rule
  await supabaseAdmin.from('automation_logs').insert([
    {
      merchant_id: returnRow.merchant_id,
      rule_id: matchedRule.id,
      return_request_id: return_id,
      rule_name: matchedRule.name,
      matched: true,
      action_taken: newStatus,
    },
  ]);

  createNotification({
    merchantId: returnRow.merchant_id,
    type: 'automation_triggered',
    title: `Otomasyon: ${matchedRule.name}`,
    message: `${notePrefix} · ${returnRow.rf_number}`,
    relatedReturnId: return_id,
  });

  triggerWebhookEvent(returnRow.merchant_id, 'automation.triggered', {
    return_request_id: return_id,
    rf_number: returnRow.rf_number,
    rule_name: matchedRule.name,
    action_taken: matchedRule.action,
    matched: true,
  }).catch(() => undefined);

  return NextResponse.json({ evaluated: true, matched: true, action: newStatus, rule: matchedRule.name });
}
