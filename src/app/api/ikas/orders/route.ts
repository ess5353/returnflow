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

    const response = await ikas.queries.listOrder();
console.log('LIST ORDER RESPONSE:', JSON.stringify(response, null, 2));

    return NextResponse.json(response.data);
  } catch (error: any) {
  console.error('ORDERS ERROR:', error);

  return NextResponse.json(
    {
      error: 'Failed',
      details: String(error),
    },
    { status: 500 }
  );
}
}