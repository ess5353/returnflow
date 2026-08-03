export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { renderTemplate, DEFAULT_TEMPLATES, TEMPLATE_META, SAMPLE_VARS, type TemplateType } from '@/lib/email/templates';
import { rateLimit, LIMITS } from '@/lib/security/rate-limit';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate limit: 5 test emails per merchant per hour
  const rl = rateLimit(`email.test:${user.merchantId}`, LIMITS.email.max, LIMITS.email.windowMs);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many test emails, please try again later' }, { status: 429 });
  }

  let body: { template_type?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const templateType = body.template_type as TemplateType | undefined;
  if (!templateType) return NextResponse.json({ error: 'template_type required' }, { status: 400 });

  const [settingsResult, templateResult] = await Promise.all([
    supabaseAdmin
      .from('store_settings')
      .select('store_name, primary_color, logo_url, notification_email, return_address, contact_phone, return_instructions, return_deadline_days, support_email')
      .eq('merchant_id', user.merchantId)
      .maybeSingle(),
    supabaseAdmin
      .from('email_templates')
      .select('subject, html')
      .eq('merchant_id', user.merchantId)
      .eq('template_type', templateType)
      .maybeSingle(),
  ]);

  const settings = settingsResult.data;
  const toEmail = settings?.notification_email;
  if (!toEmail) {
    return NextResponse.json({ error: 'notification_email not configured in settings' }, { status: 422 });
  }

  const meta = TEMPLATE_META[templateType];
  const subjectTpl = templateResult.data?.subject ?? meta.defaultSubject;
  const htmlTpl = templateResult.data?.html ?? DEFAULT_TEMPLATES[templateType];

  const vars: Record<string, string> = {
    ...SAMPLE_VARS,
    store_name: settings?.store_name ?? SAMPLE_VARS.store_name,
    return_address: settings?.return_address ?? SAMPLE_VARS.return_address,
    contact_phone: settings?.contact_phone ?? SAMPLE_VARS.contact_phone,
    return_instructions: settings?.return_instructions ?? SAMPLE_VARS.return_instructions,
    primary_color: settings?.primary_color ?? SAMPLE_VARS.primary_color,
    logo_url: settings?.logo_url ?? '',
    support_email: settings?.support_email ?? '',
  };

  const subject = `[Test] ${renderTemplate(subjectTpl, vars)}`;
  const html = renderTemplate(htmlTpl, vars);

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.error('RESEND_FROM_EMAIL is not set — cannot send test email');
    return NextResponse.json({ error: 'Email sender not configured — set RESEND_FROM_EMAIL' }, { status: 503 });
  }

  const { error } = await resend.emails.send({
    from: `${settings?.store_name ?? 'ReturnFlow'} <${fromEmail}>`,
    to: [toEmail],
    subject,
    html,
  });

  if (error) {
    console.error('email-templates test error:', error);
    return NextResponse.json({ error: 'Email send failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent_to: toEmail });
}
