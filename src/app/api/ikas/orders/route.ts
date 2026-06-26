import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authToken = await AuthTokenManager.get(
      user.authorizedAppId
    );

    if (!authToken) {
      return NextResponse.json(
        { error: 'Token not found' },
        { status: 404 }
      );
    }

    const ikas = getIkas(authToken);
console.log('IKAS:', ikas);
console.log('IKAS KEYS:', Object.keys(ikas));
console.log('CLIENT KEYS:', Object.keys((ikas as any).client || {}));
    const response = await ikas.queries.listOrder();
console.log(
  'RAW RESPONSE:',
  JSON.stringify(response, null, 2)
);
    
        const orders =
  response.data?.listOrder?.data?.map((order: any) => ({
    id: order.id,
    orderNumber: order.orderNumber,
    createdAt: order.orderedAt,
    status: order.status,

    customerName: [
      order.customer?.firstName,
      order.customer?.lastName,
    ]
      .filter(Boolean)
      .join(' ') || '-',

    totalPrice: order.totalPrice,
    currency: order.currencyCode,

    items:
      order.orderLineItems?.map((item: any) => ({
        name: item.variant?.name,
        sku: item.variant?.sku,
        quantity: item.quantity,
        price: item.finalPrice,
      })) || [],
  })) || [];

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load orders',
      },
      {
        status: 500,
      }
    );
  }
}