export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── GET: list all returns for the authenticated merchant ───────────────────
export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .select('*')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('returns GET error:', error);
    return NextResponse.json({ error: 'Failed to load returns' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

// ── POST: DIAGNOSTIC SENTINEL — replace with real implementation after test ─
export async function POST(_request: NextRequest) {
  return NextResponse.json({ route: '/api/returns', reached: true }, { status: 418 });
}
