import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  try {
    const orderNo = request.nextUrl.searchParams.get('orderNo');

    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authToken = await AuthTokenManager.get(user.authorizedAppId);

    if (!authToken) {
      return NextResponse.json(
        { success: false, error: 'Token not found' },
        { status: 404 }
      );
    }

const ikas = getIkas(authToken);

console.log("BEFORE LIST ORDER");

const response = await ikas.queries.listOrder();

console.log("AFTER LIST ORDER");
console.log("RESPONSE:", response);
console.log("DATA:", response.data);
console.log("ALL ORDERS:", JSON.stringify(response.data, null, 2));

    return NextResponse.json({
      success: true
    });

  } catch (e) {
    console.error(e);

    return NextResponse.json(
      {
        success: false,
      },
      {
        status: 500,
      }
    );
  }
}