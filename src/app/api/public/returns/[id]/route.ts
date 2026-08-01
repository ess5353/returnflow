export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withPublicAuth } from '@/lib/public-api/handler';
import type { ApiKeyContext } from '@/lib/public-api/auth';

async function handler(
  _request: NextRequest,
  ctx: ApiKeyContext,
  id: string,
): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('return_requests')
    .select(
      'id, rf_number, order_id, customer_name, customer_email, product, reason, status, request_type, amount, description, media_urls, admin_note, created_at, updated_at',
    )
    .eq('id', id)
    .eq('merchant_id', ctx.merchantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  return params.then(({ id }) =>
    withPublicAuth(`/api/public/returns/${id}`, (req, ctx) => handler(req, ctx, id))(request),
  );
}
