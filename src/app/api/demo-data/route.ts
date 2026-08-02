export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { supabaseAdmin } from '@/lib/supabase-admin';

const DEMO_RETURNS = [
  {
    rf_number: 'RF-DEMO-0001',
    order_id: 'ORD-10023',
    customer_name: 'Ayşe Demir',
    customer_email: 'ayse.demir@ornek.com',
    product: 'Beyaz Pamuklu T-Shirt (L)',
    products: [{ name: 'Beyaz Pamuklu T-Shirt (L)', quantity: 1, price: 299 }],
    reason: 'Beden uyumsuzluğu',
    description: 'XL beden sipariş ettim ama L geldi.',
    amount: '299',
    status: 'Yeni Talep',
    media_urls: [],
    request_type: 'return',
    exchange_type: null,
    exchange_variant: null,
  },
  {
    rf_number: 'EX-DEMO-0001',
    order_id: 'ORD-10031',
    customer_name: 'Mehmet Yılmaz',
    customer_email: 'mehmet.yilmaz@ornek.com',
    product: 'Siyah Spor Ayakkabı (42)',
    products: [{ name: 'Siyah Spor Ayakkabı (42)', quantity: 1, price: 850 }],
    reason: 'Hatalı ürün gönderildi',
    description: null,
    amount: '850',
    status: 'Onaylandı',
    media_urls: [],
    request_type: 'exchange',
    exchange_type: 'same_product_size',
    exchange_variant: '43 numara',
  },
  {
    rf_number: 'RF-DEMO-0002',
    order_id: 'ORD-10044',
    customer_name: 'Zeynep Kaya',
    customer_email: 'zeynep.kaya@ornek.com',
    product: 'Kırmızı Elbise (M)',
    products: [{ name: 'Kırmızı Elbise (M)', quantity: 1, price: 520 }],
    reason: 'Ürün hasarlı geldi',
    description: 'Kargo sırasında yırtılmış.',
    amount: '520',
    status: 'Reddedildi',
    media_urls: [],
    request_type: 'return',
    exchange_type: null,
    exchange_variant: null,
  },
];

export async function POST(request: NextRequest) {
  const user = getAuthContext(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.can('returns.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Only allow seeding if there are no existing returns
  const { count } = await supabaseAdmin
    .from('return_requests')
    .select('*', { count: 'exact', head: true })
    .eq('merchant_id', user.merchantId);

  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Demo data can only be seeded on empty stores' }, { status: 409 });
  }

  const rows = DEMO_RETURNS.map((r) => ({ ...r, merchant_id: user.merchantId }));

  const { error } = await supabaseAdmin.from('return_requests').insert(rows);

  if (error) {
    console.error('demo-data seed error:', error);
    return NextResponse.json({ error: 'Failed to seed demo data' }, { status: 500 });
  }

  return NextResponse.json({ data: { seeded: rows.length } });
}
