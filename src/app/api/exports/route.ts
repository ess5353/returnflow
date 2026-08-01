export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('export_jobs')
    .select('id, format, filters, columns, row_count, file_name, created_at')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('exports GET error:', error);
    return NextResponse.json({ error: 'Failed to load history' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    format?: string;
    filters?: Record<string, unknown>;
    columns?: string[];
    row_count?: number;
    file_name?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('export_jobs').insert({
    merchant_id: user.merchantId,
    format: body.format ?? 'xlsx',
    filters: body.filters ?? {},
    columns: body.columns ?? [],
    row_count: body.row_count ?? 0,
    file_name: body.file_name ?? 'export',
  });

  if (error) {
    console.error('exports POST error:', error);
    return NextResponse.json({ error: 'Failed to save export record' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'export.generated',
    entityType: 'export',
    metadata: { format: body.format ?? 'xlsx', row_count: body.row_count ?? 0, file_name: body.file_name ?? 'export' },
    ipAddress: getIp(request),
  });

  return NextResponse.json({ ok: true });
}
