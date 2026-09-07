import type { AuthToken } from '@/models/auth-token';
import { onCheckToken } from '@/helpers/api-helpers';
import { config } from '@/globals/config';

export interface RawGqlResult<T> {
  /** true only when HTTP 2xx AND no GraphQL `errors` array. */
  ok: boolean;
  httpStatus: number;
  data: T | null;
  errors: Array<{ message: string; extensions?: Record<string, unknown> }> | null;
  /** token/secret-redacted first 800 chars of the response body, for logs. */
  bodySnippet: string;
}

/**
 * Executes ONE GraphQL operation against the ikas Admin API and returns the
 * complete result — HTTP status, `data`, and any `errors`.
 *
 * Why this exists: the generated `@ikas/admin-api-client` wrapper collapses an
 * HTTP-level failure (non-2xx from the ikas gateway) into an all-`undefined`
 * `APIResult` — its `ClientError` branch reads `.response.errors`, which is
 * absent for HTTP-level errors — so a caller literally cannot tell *why* a
 * mutation failed. `createMerchantAppPayment` needs that detail (bad
 * subscription key, unpublished plan, expired session, …) to show the merchant
 * a useful message and to log the real provider error. Same endpoint, same
 * documents from `graphql-requests.ts`, same `onCheckToken` refresh path.
 */
export async function ikasRawRequest<T>(
  token: AuthToken,
  document: string,
  variables?: Record<string, unknown>,
): Promise<RawGqlResult<T>> {
  // Refresh the access token if it is expired (mutates `token` in place and
  // persists it, exactly like the generated client's pre-request hook).
  try {
    await onCheckToken(token);
  } catch {
    /* fall through with whatever access token we have */
  }

  let res: Response;
  try {
    res = await fetch(config.graphApiUrl!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'returnflow-app',
        Authorization: `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify({ query: document, variables }),
    });
  } catch (e) {
    return {
      ok: false,
      httpStatus: 0,
      data: null,
      errors: [{ message: e instanceof Error ? e.message : 'network error' }],
      bodySnippet: '',
    };
  }

  const text = await res.text();
  let json: { data?: T; errors?: Array<{ message: string; extensions?: Record<string, unknown> }> } | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body (gateway error page, etc.) */
  }

  return {
    ok: res.ok && !json?.errors?.length,
    httpStatus: res.status,
    data: (json?.data ?? null) as T | null,
    errors: json?.errors ?? null,
    bodySnippet: redactSecrets(text).slice(0, 800),
  };
}

function redactSecrets(s: string): string {
  return s
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/"(access_token|refresh_token)"\s*:\s*"[^"]+"/gi, '"$1":"[redacted]"');
}
