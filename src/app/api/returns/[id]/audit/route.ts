export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data, error } = await supabaseAdmin
    .from('audit_logs')
    .select('id, user_label, action, entity_type, entity_id, metadata, created_at')
    .eq('merchant_id', user.merchantId)
    .eq('entity_id', id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('return audit GET error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}
