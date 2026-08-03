import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog, getIp } from '@/lib/audit/log';

const settingsSchema = z.object({
  store_name:            z.string().max(100).nullable().optional(),
  notification_email:    z.string().email().max(254).nullable().optional(),
  support_email:         z.string().email().max(254).nullable().optional(),
  logo_url:              z.string().url().max(2048).nullable().optional(),
  primary_color:         z.string().regex(/^#[0-9a-fA-F]{3,6}$/).nullable().optional(),
  return_address:        z.string().max(500).nullable().optional(),
  return_policy:         z.string().max(10_000).nullable().optional(),
  contact_phone:         z.string().max(30).nullable().optional(),
  return_instructions:   z.string().max(5_000).nullable().optional(),
  return_deadline_days:  z.number().int().min(0).max(365).nullable().optional(),
  operation_mode:        z.enum(['both', 'return_only', 'exchange_only']).nullable().optional(),
}).strip();

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('store_settings')
    .select('*')
    .eq('merchant_id', user.merchantId)
    .maybeSingle();

  if (error) {
    console.error('Settings load error:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? null });
}

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('settings.edit')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = settingsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const body = parsed.data;

  const { error } = await supabaseAdmin.from('store_settings').upsert(
    {
      merchant_id: user.merchantId,
      store_name: body.store_name ?? null,
      notification_email: body.notification_email ?? null,
      support_email: body.support_email ?? null,
      logo_url: body.logo_url ?? null,
      primary_color: body.primary_color ?? null,
      return_address: body.return_address ?? null,
      return_policy: body.return_policy ?? null,
      contact_phone: body.contact_phone ?? null,
      return_instructions: body.return_instructions ?? null,
      return_deadline_days: body.return_deadline_days ?? null,
      operation_mode: body.operation_mode ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id' },
  );

  if (error) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'settings.updated',
    entityType: 'settings',
    ipAddress: getIp(request),
  });

  return NextResponse.json({ data: { success: true } });
}
