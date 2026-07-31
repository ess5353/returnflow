import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
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
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();

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
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'merchant_id' },
  );

  if (error) {
    console.error('Settings save error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }

  return NextResponse.json({ data: { success: true } });
}
