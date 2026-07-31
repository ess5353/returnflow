export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ── PATCH: update status and/or admin_note ─────────────────────────────────
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if ('status' in body) update.status = body.status;
  if ('admin_note' in body) update.admin_note = body.admin_note;
  if ('priority' in body) update.priority = body.priority;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  // Scope by merchant_id to prevent cross-merchant writes
  const { error } = await supabaseAdmin
    .from('return_requests')
    .update(update)
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('return PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update return' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE: remove a return ────────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Scope by merchant_id to prevent cross-merchant deletes
  const { error } = await supabaseAdmin
    .from('return_requests')
    .delete()
    .eq('id', id)
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('return DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete return' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
