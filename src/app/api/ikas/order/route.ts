import { NextRequest, NextResponse } from 'next/server';
import { resolveStoreKey } from '@/lib/store/resolve';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const orderNo = searchParams.get('orderNo');
    const email = searchParams.get('email');
    const storeKey = searchParams.get('storeKey')?.trim();

    if (!orderNo) {
      return NextResponse.json({ success: false, error: 'Order no required' }, { status: 400 });
    }
    if (!storeKey) {
      return NextResponse.json({ success: false, error: 'storeKey required' }, { status: 400 });
    }

    const merchantId = await resolveStoreKey(storeKey);
    if (!merchantId) {
      return NextResponse.json({ success: false, error: 'Store not found' }, { status: 404 });
    }

    const authToken = await AuthTokenManager.getByMerchantId(merchantId);
    if (!authToken) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    const ikas = getIkas(authToken);
    const response = await ikas.queries.listOrderByNumber({
      orderNumber: { eq: String(orderNo).replace('#', '') },
      ...(email ? { customerEmail: { eq: email } } : {}),
    });

    const orders = response.data?.listOrder?.data ?? [];
    const rawOrder = orders[0];

    if (!rawOrder) {
      return NextResponse.json({ success: false, error: 'Order not found' });
    }

    if (!email || rawOrder.customer?.email?.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'E-posta eşleşmiyor' });
    }

    const order = {
      id: rawOrder.id,
      orderNumber: rawOrder.orderNumber,
      order_no: rawOrder.orderNumber,
      customer_name: [rawOrder.customer?.firstName, rawOrder.customer?.lastName].filter(Boolean).join(' '),
      customer_email: rawOrder.customer?.email,
      amount: rawOrder.totalPrice,
      totalPrice: rawOrder.totalPrice,
      currency: rawOrder.currencyCode,
      status: rawOrder.status,
      items:
        rawOrder.orderLineItems?.map((item: any) => ({
          name: item.variant?.name,
          sku: item.variant?.sku,
          quantity: item.quantity,
          price: item.finalPrice,
        })) || [],
    };

    return NextResponse.json({ success: true, order });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Failed' }, { status: 500 });
  }
}
