import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext } from '@/lib/auth/context';
import { requireActiveEntitlement } from '@/lib/billing/guard';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const user = getAuthContext(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const gate = await requireActiveEntitlement(user.merchantId);
    if (gate) return gate;

    const authToken = await AuthTokenManager.get(user.authorizedAppId);

    if (!authToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    const ikas = getIkas(authToken);
    const response = await ikas.queries.listOrders();

    const orders =
      response.data?.listOrder?.data?.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.orderedAt,
        status: order.status,

        customerName:
          [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ') || '-',

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
      },
    );
  }
}
