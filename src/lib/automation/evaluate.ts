import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification } from '@/lib/notifications/create';
import { triggerWebhookEvent } from '@/lib/webhooks/trigger';

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

function evaluateCondition(row: ReturnRow, c: Condition): boolean {
  const rawValue = (row as Record<string, unknown>)[c.field];

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

export async function evaluateAndApplyAutomation(returnId: string, merchantId: string): Promise<void> {
  const { data: row, error: rowError } = await supabaseAdmin
    .from('return_requests')
    .select('*')
    .eq('id', returnId)
    .single();

  if (rowError || !row) return;

  const returnRow = row as ReturnRow;
  if (returnRow.status !== 'Yeni Talep') return;

  const { data: rules, error: rulesError } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('merchant_id', merchantId)
    .eq('enabled', true)
    .order('priority', { ascending: true });

  if (rulesError || !rules || rules.length === 0) return;

  let matchedRule: AutomationRule | null = null;
  for (const rule of rules as AutomationRule[]) {
    if (evaluateRule(returnRow, rule)) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    await supabaseAdmin.from('automation_logs').insert(
      (rules as AutomationRule[]).map((r) => ({
        merchant_id: merchantId,
        rule_id: r.id,
        return_request_id: returnId,
        rule_name: r.name,
        matched: false,
        action_taken: null,
      })),
    );
    return;
  }

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
    .eq('id', returnId);

  await supabaseAdmin.from('automation_logs').insert([{
    merchant_id: merchantId,
    rule_id: matchedRule.id,
    return_request_id: returnId,
    rule_name: matchedRule.name,
    matched: true,
    action_taken: newStatus,
  }]);

  createNotification({
    merchantId,
    type: 'automation_triggered',
    title: `Otomasyon: ${matchedRule.name}`,
    message: `${notePrefix} · ${returnRow.rf_number}`,
    relatedReturnId: returnId,
  });

  triggerWebhookEvent(merchantId, 'automation.triggered', {
    return_request_id: returnId,
    rf_number: returnRow.rf_number,
    rule_name: matchedRule.name,
    action_taken: matchedRule.action,
    matched: true,
  }).catch(() => undefined);
}
