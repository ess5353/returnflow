import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helpers';
import { AuthTokenManager } from '@/models/auth-token/manager';
import { getIkas } from '@/helpers/api-helpers';

export async function GET(request: NextRequest) {
  const orderNo = request.nextUrl.searchParams.get('orderNo');

  return NextResponse.json({
    success: true,
    orderNo,
  });
}