export type TemplateType =
  | 'return_received'
  | 'exchange_received'
  | 'return_approved'
  | 'return_rejected'
  | 'exchange_approved'
  | 'exchange_rejected'
  | 'return_shipment_awaited'
  | 'exchange_shipment_awaited'
  | 'return_shipment_received'
  | 'exchange_shipment_received'
  | 'return_refunded'
  | 'return_completed'
  | 'exchange_completed';

export interface TemplateMeta {
  label: string;
  description: string;
  defaultSubject: string;
}

export const TEMPLATE_META: Record<TemplateType, TemplateMeta> = {
  return_received: {
    label: 'İade Talebi Alındı',
    description: 'Müşteri iade talebini oluşturduğunda gönderilen onay e-postası.',
    defaultSubject: 'İade Talebiniz Alındı — {{rf_number}}',
  },
  exchange_received: {
    label: 'Değişim Talebi Alındı',
    description: 'Müşteri değişim talebini oluşturduğunda gönderilen onay e-postası.',
    defaultSubject: 'Değişim Talebiniz Alındı — {{rf_number}}',
  },
  return_approved: {
    label: 'İade Onaylandı',
    description: 'Müşterinin iade talebi onaylandığında gönderilir.',
    defaultSubject: 'İade Talebiniz Onaylandı — {{rf_number}}',
  },
  return_rejected: {
    label: 'İade Reddedildi',
    description: 'Müşterinin iade talebi reddedildiğinde gönderilir.',
    defaultSubject: 'İade Talebiniz Hakkında — {{rf_number}}',
  },
  exchange_approved: {
    label: 'Değişim Onaylandı',
    description: 'Müşterinin değişim talebi onaylandığında gönderilir.',
    defaultSubject: 'Değişim Talebiniz Onaylandı — {{rf_number}}',
  },
  exchange_rejected: {
    label: 'Değişim Reddedildi',
    description: 'Müşterinin değişim talebi reddedildiğinde gönderilir.',
    defaultSubject: 'Değişim Talebiniz Hakkında — {{rf_number}}',
  },
  return_shipment_awaited: {
    label: 'İade — Kargo Bekleniyor',
    description: 'Müşterinin iade kargo göndermesi beklendiğinde gönderilir.',
    defaultSubject: 'İadenizi Gönderin — {{rf_number}}',
  },
  exchange_shipment_awaited: {
    label: 'Değişim — Kargo Bekleniyor',
    description: 'Değişim için müşterinin kargo göndermesi beklendiğinde gönderilir.',
    defaultSubject: 'Değişim Ürününü Gönderin — {{rf_number}}',
  },
  return_shipment_received: {
    label: 'İade — Kargo Alındı',
    description: 'Müşterinin iade kargosu teslim alındığında gönderilir.',
    defaultSubject: 'İade Kargonuz Alındı — {{rf_number}}',
  },
  exchange_shipment_received: {
    label: 'Değişim — Kargo Alındı',
    description: 'Değişim için müşterinin kargosu teslim alındığında gönderilir.',
    defaultSubject: 'Değişim Kargonuz Alındı — {{rf_number}}',
  },
  return_refunded: {
    label: 'Para İadesi Yapıldı',
    description: 'Para iadesi işleme alındığında gönderilir.',
    defaultSubject: 'Para İadeniz İşlemde — {{rf_number}}',
  },
  return_completed: {
    label: 'İade Tamamlandı',
    description: 'İade işlemi tamamlandığında gönderilir.',
    defaultSubject: 'İade İşleminiz Tamamlandı — {{rf_number}}',
  },
  exchange_completed: {
    label: 'Değişim Tamamlandı',
    description: 'Değişim işlemi tamamlandığında (ürün gönderildiğinde) gönderilir.',
    defaultSubject: 'Değişim İşleminiz Tamamlandı — {{rf_number}}',
  },
};

export const SUPPORTED_VARIABLES: { key: string; label: string }[] = [
  { key: 'customer_name', label: 'Müşteri Adı' },
  { key: 'store_name', label: 'Mağaza Adı' },
  { key: 'rf_number', label: 'Referans No' },
  { key: 'order_number', label: 'Sipariş No' },
  { key: 'return_address', label: 'İade Adresi' },
  { key: 'contact_phone', label: 'İletişim Telefonu' },
  { key: 'return_instructions', label: 'İade Adımları' },
  { key: 'return_deadline', label: 'Son Gönderim Tarihi' },
  { key: 'tracking_number', label: 'Kargo Takip No' },
  { key: 'carrier', label: 'Kargo Firması' },
];

export const SAMPLE_VARS: Record<string, string> = {
  customer_name: 'Ahmet Yılmaz',
  store_name: 'Test Mağaza',
  rf_number: 'RF-2024.01.15-0001',
  order_number: '#12345',
  return_address: 'Örnek Mah. Test Sok. No:1\nKadıköy / İstanbul 34710',
  contact_phone: '+90 212 555 01 23',
  return_instructions: '1. Ürünü orijinal ambalajında paketleyin\n2. Bu e-postayı pakete koyun\n3. Kargo şubesine teslim edin',
  return_deadline: '15 Şubat 2024',
  tracking_number: '1234567890',
  carrier: 'Yurtiçi Kargo',
  primary_color: '#111827',
  logo_url: '',
  support_email: '',
};

// Values can originate from customer-controlled data (e.g. their ikas profile
// name flows into customer_name) — escape before embedding in HTML so a
// crafted name/field can't inject markup into the rendered email.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function renderTemplate(html: string, vars: Record<string, string>): string {
  let result = html.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName: string, content: string) => {
    return vars[varName] ? content : '';
  });
  result = result.replace(/\{\{(\w+)\}\}/g, (_, varName: string) => (vars[varName] ? escapeHtml(vars[varName]) : ''));
  return result;
}

// ── Internal layout builder ────────────────────────────────────────────────

function section(title: string, contentHtml: string): string {
  return `<div style="margin:0 0 14px;"><p style="font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 7px;">${title}</p><div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">${contentHtml}</div></div>`;
}

function layout(opts: {
  badge: string;
  badgeBg: string;
  badgeBorder: string;
  badgeColor: string;
  headline: string;
  subline: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="padding:40px 16px;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:{{primary_color}};padding:28px 32px;text-align:center;">
      {{#if logo_url}}<img src="{{logo_url}}" alt="{{store_name}}" style="height:40px;max-width:160px;object-fit:contain;display:block;margin:0 auto 12px;">{{/if}}
      <p style="color:rgba(255,255,255,0.92);font-size:17px;font-weight:700;margin:0;">{{store_name}}</p>
    </div>
    <div style="padding:32px 32px 0;text-align:center;">
      <div style="display:inline-block;background:${opts.badgeBg};border:1px solid ${opts.badgeBorder};border-radius:100px;padding:7px 18px;margin-bottom:20px;">
        <span style="color:${opts.badgeColor};font-size:13px;font-weight:700;">${opts.badge}</span>
      </div>
      <h1 style="font-size:22px;font-weight:800;color:#111;margin:0 0 8px;">${opts.headline}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0;">${opts.subline}</p>
    </div>
    <div style="margin:24px 32px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="font-size:12px;color:#6b7280;font-weight:500;padding-bottom:8px;">Referans No</td>
          <td style="text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#111;padding-bottom:8px;">{{rf_number}}</td>
        </tr>
        <tr>
          <td style="font-size:12px;color:#6b7280;font-weight:500;border-top:1px solid #e5e7eb;padding-top:8px;">Sipariş No</td>
          <td style="text-align:right;font-size:13px;font-weight:600;color:#111;border-top:1px solid #e5e7eb;padding-top:8px;">{{order_number}}</td>
        </tr>
      </table>
    </div>
    ${opts.bodyHtml}
    <div style="padding:20px 32px 28px;border-top:1px solid #f3f4f6;text-align:center;">
      {{#if support_email}}<p style="font-size:12px;color:#9ca3af;margin:0 0 4px;">Sorularınız için: <a href="mailto:{{support_email}}" style="color:#6b7280;text-decoration:none;">{{support_email}}</a></p>{{/if}}
      <p style="font-size:11px;color:#d1d5db;margin:0;">Bu e-posta {{store_name}} ReturnFlow sistemi tarafından gönderildi.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

const receivedBody = `
    <div style="padding:20px 32px 8px;">
      ${section('Sonraki Adım', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;">Talebinizi en kısa sürede inceleyeceğiz. Durum değişikliklerinde e-posta ile bilgilendirileceksiniz.</p>')}
      {{#if return_address}}${section('İade Gönderi Adresi', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;white-space:pre-line;">{{return_address}}</p><p style="font-size:11px;color:#6b7280;margin:6px 0 0;">Onay beklemeden ürünü bu adrese gönderebilirsiniz.</p>')}{{/if}}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

const approvedBody = `
    <div style="padding:20px 32px 8px;">
      {{#if return_address}}${section('İade Adresi', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;white-space:pre-line;">{{return_address}}</p>')}{{/if}}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
      {{#if return_instructions}}${section('İade Adımları', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.7;white-space:pre-line;">{{return_instructions}}</p>')}{{/if}}
      {{#if return_deadline}}<div style="margin:0 0 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;"><p style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">Son Gönderim Tarihi</p><p style="font-size:15px;font-weight:700;color:#78350f;margin:0;">{{return_deadline}}</p></div>{{/if}}
    </div>`;

const rejectedBody = `
    <div style="padding:20px 32px 8px;">
      {{#if contact_phone}}${section('Bize Ulaşın', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

const completedBody = `
    <div style="padding:20px 32px 8px;">
      {{#if tracking_number}}${section('Kargo Takip', '<p style="font-size:12px;color:#6b7280;margin:0 0 4px;">{{carrier}}</p><p style="font-size:14px;font-weight:700;font-family:monospace;color:#111;margin:0;">{{tracking_number}}</p>')}{{/if}}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

const shipmentAwaitedBody = `
    <div style="padding:20px 32px 8px;">
      {{#if return_address}}${section('Göndereceğiniz Adres', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;white-space:pre-line;">{{return_address}}</p>')}{{/if}}
      {{#if return_instructions}}${section('Nasıl Gönderirsiniz?', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.7;white-space:pre-line;">{{return_instructions}}</p>')}{{/if}}
      {{#if return_deadline}}<div style="margin:0 0 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 16px;"><p style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 4px;">Son Gönderim Tarihi</p><p style="font-size:15px;font-weight:700;color:#78350f;margin:0;">{{return_deadline}}</p></div>{{/if}}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

const shipmentReceivedBody = `
    <div style="padding:20px 32px 8px;">
      ${section('Durum', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;">Gönderdiğiniz kargoyu teslim aldık. İnceleme tamamlandıktan sonra bilgilendirileceksiniz.</p>')}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

const refundedBody = `
    <div style="padding:20px 32px 8px;">
      ${section('Para İadesi', '<p style="font-size:13px;color:#374151;margin:0;line-height:1.65;">Para iadeniz işleme alındı. Bankanıza veya ödeme yönteminize bağlı olarak 3-10 iş günü içinde hesabınıza yansır.</p>')}
      {{#if contact_phone}}${section('İletişim', '<p style="font-size:13px;font-weight:600;color:#111;margin:0;">{{contact_phone}}</p>')}{{/if}}
    </div>`;

export const DEFAULT_TEMPLATES: Record<TemplateType, string> = {
  return_received: layout({
    badge: '📬 Talebiniz Alındı',
    badgeBg: '#f0f9ff', badgeBorder: '#bae6fd', badgeColor: '#0369a1',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} iade talebinizi aldı. En kısa sürede inceleme yapılacaktır.',
    bodyHtml: receivedBody,
  }),
  exchange_received: layout({
    badge: '📬 Talebiniz Alındı',
    badgeBg: '#f0f9ff', badgeBorder: '#bae6fd', badgeColor: '#0369a1',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} değişim talebinizi aldı. En kısa sürede inceleme yapılacaktır.',
    bodyHtml: receivedBody,
  }),
  return_approved: layout({
    badge: '✓ İadeniz Onaylandı',
    badgeBg: '#f0fdf4', badgeBorder: '#bbf7d0', badgeColor: '#15803d',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} iade talebinizi inceledi ve onayladı.',
    bodyHtml: approvedBody,
  }),
  return_rejected: layout({
    badge: '✕ İadeniz Reddedildi',
    badgeBg: '#fef2f2', badgeBorder: '#fecaca', badgeColor: '#dc2626',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'Maalesef {{store_name}} bu iade talebini onaylayamadı.',
    bodyHtml: rejectedBody,
  }),
  exchange_approved: layout({
    badge: '✓ Değişiminiz Onaylandı',
    badgeBg: '#f0fdf4', badgeBorder: '#bbf7d0', badgeColor: '#15803d',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} değişim talebinizi inceledi ve onayladı.',
    bodyHtml: approvedBody,
  }),
  exchange_rejected: layout({
    badge: '✕ Değişiminiz Reddedildi',
    badgeBg: '#fef2f2', badgeBorder: '#fecaca', badgeColor: '#dc2626',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'Maalesef {{store_name}} bu değişim talebini onaylayamadı.',
    bodyHtml: rejectedBody,
  }),
  return_shipment_awaited: layout({
    badge: '📦 Kargo Bekleniyor',
    badgeBg: '#fefce8', badgeBorder: '#fde68a', badgeColor: '#854d0e',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'İade talebiniz onaylandı. Lütfen ürününüzü aşağıdaki adrese gönderin.',
    bodyHtml: shipmentAwaitedBody,
  }),
  exchange_shipment_awaited: layout({
    badge: '📦 Kargo Bekleniyor',
    badgeBg: '#fefce8', badgeBorder: '#fde68a', badgeColor: '#854d0e',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'Değişim talebiniz onaylandı. Lütfen ürününüzü aşağıdaki adrese gönderin.',
    bodyHtml: shipmentAwaitedBody,
  }),
  return_shipment_received: layout({
    badge: '✓ Kargo Teslim Alındı',
    badgeBg: '#f0fdf4', badgeBorder: '#bbf7d0', badgeColor: '#15803d',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} iade kargonuzu teslim aldı. İnceleme sürecindeyiz.',
    bodyHtml: shipmentReceivedBody,
  }),
  exchange_shipment_received: layout({
    badge: '✓ Kargo Teslim Alındı',
    badgeBg: '#f0fdf4', badgeBorder: '#bbf7d0', badgeColor: '#15803d',
    headline: 'Merhaba, {{customer_name}}!',
    subline: '{{store_name}} değişim kargonuzu teslim aldı. İşlem sürecindeyiz.',
    bodyHtml: shipmentReceivedBody,
  }),
  return_refunded: layout({
    badge: '💳 Para İadesi Yapıldı',
    badgeBg: '#f5f3ff', badgeBorder: '#ddd6fe', badgeColor: '#6d28d9',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'İade tutarınız hesabınıza aktarılmaktadır.',
    bodyHtml: refundedBody,
  }),
  return_completed: layout({
    badge: '✓ İade Tamamlandı',
    badgeBg: '#eff6ff', badgeBorder: '#bfdbfe', badgeColor: '#1d4ed8',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'İade işleminiz tamamlandı. Para iadeniz hesabınıza aktarılmaktadır.',
    bodyHtml: completedBody,
  }),
  exchange_completed: layout({
    badge: '✓ Değişim Tamamlandı',
    badgeBg: '#eff6ff', badgeBorder: '#bfdbfe', badgeColor: '#1d4ed8',
    headline: 'Merhaba, {{customer_name}}!',
    subline: 'Değişim işleminiz tamamlandı. Yeni ürününüz yola çıktı.',
    bodyHtml: completedBody,
  }),
};
