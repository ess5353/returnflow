export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog } from '@/lib/audit/log';

// GET: list rules for merchant
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('merchant_id', user.merchantId)
    .order('priority', { ascending: true });

  if (error) {
    console.error('automation rules GET error:', error);
    return NextResponse.json({ error: 'Failed to load rules' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// POST: create a new rule
export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, enabled, condition_logic, conditions, action, action_note } = body as {
    name: string;
    enabled?: boolean;
    condition_logic?: string;
    conditions?: unknown[];
    action: string;
    action_note?: string | null;
  };

  if (!name || !action) {
    return NextResponse.json({ error: 'name and action are required' }, { status: 400 });
  }

  // Assign priority = max existing + 1 (appends to bottom of list)
  const { data: existing } = await supabaseAdmin
    .from('automation_rules')
    .select('priority')
    .eq('merchant_id', user.merchantId)
    .order('priority', { ascending: false })
    .limit(1);

  const nextPriority = existing && existing.length > 0 ? (existing[0].priority as number) + 1 : 0;

  const { data, error } = await supabaseAdmin
    .from('automation_rules')
    .insert([
      {
        merchant_id: user.merchantId,
        name,
        enabled: enabled ?? true,
        priority: nextPriority,
        condition_logic: condition_logic ?? 'AND',
        conditions: conditions ?? [],
        action,
        action_note: action_note ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('automation rule POST error:', error);
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'automation_rule.created',
    entityType: 'automation_rule',
    entityId: data?.id as string | undefined,
    metadata: { name, action },
  });

  return NextResponse.json({ data });
}
