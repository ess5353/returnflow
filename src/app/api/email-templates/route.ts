export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { DEFAULT_TEMPLATES, TEMPLATE_META, type TemplateType } from '@/lib/email/templates';

const ALL_TYPES: TemplateType[] = [
  'return_approved', 'return_rejected', 'exchange_approved',
  'exchange_rejected', 'return_completed', 'exchange_completed',
];

export async function GET(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('email_templates')
    .select('template_type, subject, html')
    .eq('merchant_id', user.merchantId);

  if (error) {
    console.error('email-templates GET error:', error);
    return NextResponse.json({ error: 'Failed to load templates' }, { status: 500 });
  }

  const saved: Record<string, { subject: string; html: string }> = {};
  for (const row of data ?? []) {
    saved[row.template_type] = { subject: row.subject, html: row.html };
  }

  const result: Record<string, { subject: string; html: string }> = {};
  for (const type of ALL_TYPES) {
    result[type] = saved[type] ?? {
      subject: TEMPLATE_META[type].defaultSubject,
      html: DEFAULT_TEMPLATES[type],
    };
  }

  return NextResponse.json({ data: result });
}
