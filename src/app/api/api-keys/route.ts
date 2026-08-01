export const dynamic = 'force-dynamic';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createAuditLog, getIp } from '@/lib/audit/log';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, name, key_prefix, enabled, expires_at, last_used_at, revoked_at, created_at')
    .eq('merchant_id', user.merchantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('api-keys GET error:', error);
    return NextResponse.json({ error: 'Failed to load API keys' }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { name?: string; expires_at?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name, expires_at } = body;
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }

  // Generate key: plx_ + 32 random bytes as hex (68 chars total)
  const rawKey = 'plx_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12); // "plx_" + first 8 hex chars

  const { data, error } = await supabaseAdmin
    .from('api_keys')
    .insert({
      merchant_id: user.merchantId,
      name: name.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      enabled: true,
      expires_at: expires_at ?? null,
    })
    .select('id, name, key_prefix, enabled, expires_at, created_at')
    .single();

  if (error) {
    console.error('api-keys POST error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  createAuditLog({
    merchantId: user.merchantId,
    user: 'Mağaza',
    action: 'api_key.created',
    entityType: 'api_key',
    entityId: data?.id as string | undefined,
    metadata: { name: name?.trim(), key_prefix: keyPrefix, expires_at: expires_at ?? null },
    ipAddress: getIp(request),
  });

  // Return the plaintext key ONCE — never stored, never retrievable again
  return NextResponse.json({ data: { ...data, raw_key: rawKey } }, { status: 201 });
}
