import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { supabaseAdmin } from '@/lib/supabase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

function deadlineDateLabel(approvedAt: Date, days: number): string {
  const d = new Date(approvedAt);
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function buildApprovalEmailHtml(p: {
  storeName: string;
  primaryColor: string;
  logoUrl: string | null;
  customerName: string;
  rfNumber: string;
  orderId: string;
  returnAddress: string | null;
  contactPhone: string | null;
  returnInstructions: string | null;
  deadlineLabel: string | null;
  supportEmail: string | null;
}): string {
  const color = p.primaryColor || '#111827';

  const logo = p.logoUrl
    ? `<img src="${p.logoUrl}" alt="${p.storeName}" style="height:40px;max-width:160px;object-fit:contain;display:block;margin:0 auto 12px;">`
    : '';

  const section = (title: string, content: string) => `
    <div style="margin:0 0 14px;">
      <p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 7px;">${title}</p>
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">
        ${content}
      </div>
    </div>`;

  const addressSection = p.returnAddress
    ? section('İade Adresi', `<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;white-space:pre-line;">${p.returnAddress}</p>`)
    : '';

  const phoneSection = p.contactPhone
    ? section('İletişim', `<p style="font-size:13px;font-weight:600;color:#111;margin:0;">${p.contactPhone}</p>`)
    : '';

  const instructionsSection = p.returnInstructions
    ? section('İade Adımları', `<p style="font-size:13px;color:#374151;margin:0;line-height:1.7;white-space:pre-line;">${p.returnInstructions}</p>`)
    : '';

  const deadlineSection = p.deadlineLabel
    ? `<div style="margin:0 0 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;">
         <p style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">Son Gönderim Tarihi</p>
         <p style="font-size:15px;font-weight:700;color:#78350f;margin:0;">${p.deadlineLabel}</p>
       </div>`
    : '';

  const footerEmail = p.supportEmail
    ? `<p style="font-size:12px;color:#9ca3af;margin:0 0 4px;">Sorularınız için: <a href="mailto:${p.supportEmail}" style="color:#6b7280;text-decoration:none;">${p.supportEmail}</a></p>`
    : '';

  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="padding:40px 16px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

      <div style="background:${color};padding:28px 32px;text-align:center;">
        ${logo}
        <p style="color:rgba(255,255,255,0.92);font-size:17px;font-weight:700;margin:0;">${p.storeName}</p>
      </div>

      <div style="padding:32px 32px 0;text-align:center;">
        <div style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:100px;padding:7px 18px;margin-bottom:20px;">
          <span style="color:#15803d;font-size:13px;font-weight:700;">✓ İadeniz Onaylandı</span>
        </div>
        <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;">Merhaba, ${p.customerName}!</h1>
        <p style="color:#6b7280;font-size:14px;margin:0;">${p.storeName} iade talebinizi inceledi ve onayladı.</p>
      </div>

      <div style="margin:24px 32px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="font-size:12px;color:#6b7280;font-weight:500;padding-bottom:8px;">İade Referans No</td>
            <td style="text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#111;padding-bottom:8px;">${p.rfNumber}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#6b7280;font-weight:500;border-top:1px solid #e5e7eb;padding-top:8px;">Sipariş No</td>
            <td style="text-align:right;font-size:13px;font-weight:600;color:#111;border-top:1px solid #e5e7eb;padding-top:8px;">${p.orderId}</td>
          </tr>
        </table>
      </div>

      <div style="padding:20px 32px 8px;">
        ${addressSection}
        ${phoneSection}
        ${instructionsSection}
        ${deadlineSection}
      </div>

      <div style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;">
        ${footerEmail}
        <p style="font-size:11px;color:#d1d5db;margin:0;">Bu e-posta ${p.storeName} ReturnFlow sistemi tarafından gönderildi.</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

export async function POST(request: NextRequest) {
  const user = getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { return_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.return_id) {
    return NextResponse.json({ error: 'return_id required' }, { status: 400 });
  }

  const [returnResult, settingsResult] = await Promise.all([
    supabaseAdmin
      .from('return_requests')
      .select('customer_name, customer_email, rf_number, order_id')
      .eq('id', body.return_id)
      .eq('merchant_id', user.merchantId)
      .single(),
    supabaseAdmin
      .from('store_settings')
      .select('store_name, primary_color, logo_url, support_email, return_address, contact_phone, return_instructions, return_deadline_days')
      .eq('merchant_id', user.merchantId)
      .maybeSingle(),
  ]);

  if (returnResult.error || !returnResult.data) {
    console.error('return-approved: return not found', returnResult.error);
    return NextResponse.json({ error: 'Return not found' }, { status: 404 });
  }

  const ret = returnResult.data;
  const settings = settingsResult.data;

  if (!ret.customer_email) {
    return NextResponse.json({ error: 'No customer email on record' }, { status: 422 });
  }

  const deadlineDays = settings?.return_deadline_days;
  const deadlineLabel = deadlineDays ? deadlineDateLabel(new Date(), deadlineDays) : null;

  const html = buildApprovalEmailHtml({
    storeName: settings?.store_name ?? 'Mağaza',
    primaryColor: settings?.primary_color ?? '#111827',
    logoUrl: settings?.logo_url ?? null,
    customerName: ret.customer_name,
    rfNumber: ret.rf_number,
    orderId: ret.order_id,
    returnAddress: settings?.return_address ?? null,
    contactPhone: settings?.contact_phone ?? null,
    returnInstructions: settings?.return_instructions ?? null,
    deadlineLabel,
    supportEmail: settings?.support_email ?? null,
  });

  const { error } = await resend.emails.send({
    from: `${settings?.store_name ?? 'ReturnFlow'} <onboarding@resend.dev>`,
    to: [ret.customer_email],
    subject: `İade Talebiniz Onaylandı — ${ret.rf_number}`,
    html,
  });

  if (error) {
    console.error('return-approved email error:', error);
    return NextResponse.json({ error: 'Email could not be sent' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
