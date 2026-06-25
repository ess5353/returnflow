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
console.log(Object.keys(ikas.queries));
    const response = await ikas.queries.listOrder();

    const orders =
      response.data?.listOrder?.data?.map((order: any) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        createdAt: order.createdAt,
        status: order.status,

        customerName:
          order.customer?.fullName ||
          order.customer?.name ||
          '-',

        totalPrice:
          order.totalPrice ||
          order.total ||
          0,

        currency:
          order.currency ||
          'TRY',

        items:
          order.lineItems ||
          order.items ||
          [],
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