import { NextRequest, NextResponse } from 'next/server';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const orderNo = request.nextUrl.searchParams.get('orderNo');
const email = request.nextUrl.searchParams.get('email');
    if (!orderNo) {
      return NextResponse.json(
        { success: false, error: 'Order no required' },
        { status: 400 }
      );
    }

    const tokens = await AuthTokenManager.list();
    const authToken = tokens.find((t) => !t.deleted);

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

    const ikas = getIkas(authToken);

    const response = await ikas.queries.listOrder();
console.log(
  "ORDERS:",
  JSON.stringify(response.data?.listOrder?.data, null, 2)
);
    const rawOrder = response.data?.listOrder?.data?.find(
      (o: any) => String(o.orderNumber) === String(orderNo).replace('#', '')
    );

    if (!rawOrder) {
      return NextResponse.json({
        success: false,
        error: 'Order not found',
      });
    }

    if (
  !email ||
  rawOrder.customer?.email?.toLowerCase() !== email.toLowerCase()
) {
  return NextResponse.json({
    success: false,
    error: 'E-posta eşleşmiyor',
  });
}

    const order = {
      id: rawOrder.id,
      orderNumber: rawOrder.orderNumber,
      order_no: rawOrder.orderNumber,
      customer_name: [rawOrder.customer?.firstName, rawOrder.customer?.lastName]
        .filter(Boolean)
        .join(' '),
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

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (e) {
    console.error(e);

    return NextResponse.json(
      { success: false, error: 'Failed' },
      { status: 500 }
    );
  }
}