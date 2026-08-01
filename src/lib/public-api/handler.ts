import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey, type ApiKeyContext } from './auth';
import { checkRateLimit } from './rate-limit';
import { logApiRequest } from './log';

type PublicHandler = (
  request: NextRequest,
  ctx: ApiKeyContext,
) => Promise<NextResponse>;

export function withPublicAuth(endpoint: string, handler: PublicHandler) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const start = Date.now();

    const ctx = await validateApiKey(request);
    if (!ctx) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'INVALID_API_KEY' },
        { status: 401 },
      );
    }

    const { allowed, remaining } = await checkRateLimit(ctx.apiKeyId);
    if (!allowed) {
      logApiRequest({
        merchantId: ctx.merchantId,
        apiKeyId: ctx.apiKeyId,
        keyPrefix: ctx.keyPrefix,
        endpoint,
        method: request.method,
        responseCode: 429,
        responseTimeMs: Date.now() - start,
      });
      return NextResponse.json(
        { error: 'Rate limit exceeded', code: 'RATE_LIMIT_EXCEEDED' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 60_000) * 60),
          },
        },
      );
    }

    let response: NextResponse;
    try {
      response = await handler(request, ctx);
    } catch (err) {
      console.error(`Public API error [${endpoint}]:`, err);
      response = NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 },
      );
    }

    const responseTimeMs = Date.now() - start;

    logApiRequest({
      merchantId: ctx.merchantId,
      apiKeyId: ctx.apiKeyId,
      keyPrefix: ctx.keyPrefix,
      endpoint,
      method: request.method,
      responseCode: response.status,
      responseTimeMs,
    });

    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', String(remaining - 1));
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(Date.now() / 60_000) * 60));

    return response;
  };
}
