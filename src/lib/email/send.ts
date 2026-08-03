import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { renderTemplate, DEFAULT_TEMPLATES, TEMPLATE_META, type TemplateType } from './templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReturnEmail({
  merchantId,
  returnId,
  templateType,
}: {
  merchantId: string;
  returnId: string;
  templateType: TemplateType;
}): Promise<{ ok: boolean; error?: string }> {
  const [returnResult, settingsResult, templateResult] = await Promise.all([
    supabaseAdmin
      .from('return_requests')
      .select('customer_name, customer_email, rf_number, order_id, tracking_number, carrier')
      .eq('id', returnId)
      .eq('merchant_id', merchantId)
      .single(),
    supabaseAdmin
      .from('store_settings')
      .select('store_name, primary_color, logo_url, support_email, return_address, contact_phone, return_instructions, return_deadline_days')
      .eq('merchant_id', merchantId)
      .maybeSingle(),
    supabaseAdmin
      .from('email_templates')
      .select('subject, html')
      .eq('merchant_id', merchantId)
      .eq('template_type', templateType)
      .maybeSingle(),
  ]);

  if (returnResult.error || !returnResult.data) {
    return { ok: false, error: 'Return not found' };
  }

  const ret = returnResult.data;
  const settings = settingsResult.data;

  if (!ret.customer_email) {
    return { ok: false, error: 'No customer email' };
  }

  const meta = TEMPLATE_META[templateType];
  const subjectTpl = templateResult.data?.subject ?? meta.defaultSubject;
  const htmlTpl = templateResult.data?.html ?? DEFAULT_TEMPLATES[templateType];

  let returnDeadline = '';
  const deadlineDays = settings?.return_deadline_days;
  if (deadlineDays) {
    const d = new Date();
    d.setDate(d.getDate() + deadlineDays);
    returnDeadline = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const vars: Record<string, string> = {
    customer_name: ret.customer_name ?? '',
    store_name: settings?.store_name ?? 'Mağaza',
    rf_number: ret.rf_number ?? '',
    order_number: ret.order_id ?? '',
    return_address: settings?.return_address ?? '',
    contact_phone: settings?.contact_phone ?? '',
    return_instructions: settings?.return_instructions ?? '',
    return_deadline: returnDeadline,
    tracking_number: (ret as Record<string, unknown>).tracking_number as string ?? '',
    carrier: (ret as Record<string, unknown>).carrier as string ?? '',
    primary_color: settings?.primary_color ?? '#111827',
    logo_url: settings?.logo_url ?? '',
    support_email: settings?.support_email ?? '',
  };

  const subject = renderTemplate(subjectTpl, vars);
  const html = renderTemplate(htmlTpl, vars);

  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) {
    console.error('RESEND_FROM_EMAIL is not set — cannot send customer email');
    return { ok: false, error: 'Email sender not configured' };
  }

  const { error } = await resend.emails.send({
    from: `${settings?.store_name ?? 'ReturnFlow'} <${fromEmail}>`,
    to: [ret.customer_email],
    subject,
    html,
  });

  if (error) {
    console.error('sendReturnEmail error:', error);
    return { ok: false, error: 'Email send failed' };
  }

  return { ok: true };
}
