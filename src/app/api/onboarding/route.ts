export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/context';
import { requireActiveEntitlement } from '@/lib/billing/guard';
import { supabaseAdmin } from '@/lib/supabase-admin';

const onboardingSchema = z.object({
  completed: z.boolean().optional(),
  currentStep: z.string().max(100).nullable().optional(),
}).strip();

// Per-merchant onboarding state, backing the first-run wizard and the
// reopenable "Yardım" guide. Any authenticated staff member of the merchant
// may advance/dismiss it — it's UI-progress state, not a sensitive setting.
export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gate = await requireActiveEntitlement(user.merchantId);
  if (gate) return gate;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'Invalid input' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('store_settings')
    .select('onboarding_started_at')
    .eq('merchant_id', user.merchantId)
    .maybeSingle();

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (!existing?.onboarding_started_at) update.onboarding_started_at = new Date().toISOString();
  if (parsed.data.currentStep !== undefined) update.onboarding_current_step = parsed.data.currentStep;
  if (parsed.data.completed !== undefined) {
    update.onboarding_completed = parsed.data.completed;
    update.onboarding_completed_at = parsed.data.completed ? new Date().toISOString() : null;
  }

  const { error } = await supabaseAdmin
    .from('store_settings')
    .upsert({ merchant_id: user.merchantId, ...update }, { onConflict: 'merchant_id' });

  if (error) return NextResponse.json({ error: 'Failed to save onboarding state' }, { status: 500 });

  return NextResponse.json({ data: { success: true } });
}
