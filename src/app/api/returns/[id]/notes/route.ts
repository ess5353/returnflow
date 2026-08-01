export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createNotification } from '@/lib/notifications/create';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { data: row } = await supabaseAdmin
    .from('return_requests')
    .select('id')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from('return_notes')
    .select('id, author, message, created_at')
    .eq('return_request_id', id)
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('notes GET error:', error);
    return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  let body: { author?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.message?.trim()) {
    return NextResponse.json({ error: 'message required' }, { status: 400 });
  }

  const { data: row } = await supabaseAdmin
    .from('return_requests')
    .select('id, rf_number')
    .eq('id', id)
    .eq('merchant_id', user.merchantId)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const author = body.author?.trim() || 'Yönetici';

  const { data: note, error } = await supabaseAdmin
    .from('return_notes')
    .insert({
      merchant_id: user.merchantId,
      return_request_id: id,
      author,
      message: body.message.trim(),
    })
    .select('id, author, message, created_at')
    .single();

  if (error) {
    console.error('notes POST error:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }

  createNotification({
    merchantId: user.merchantId,
    type: 'note_added',
    title: `Dahili Not: ${row.rf_number}`,
    message: `${author}: ${note.message.slice(0, 80)}${note.message.length > 80 ? '…' : ''}`,
    relatedReturnId: id,
  });

  return NextResponse.json({ data: note });
}
