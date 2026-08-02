export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, noteId } = await params;

  const { error } = await supabaseAdmin
    .from('return_notes')
    .delete()
    .eq('id', noteId)
    .eq('return_request_id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('notes DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
