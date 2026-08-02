import { JwtHelpers } from '@/helpers/jwt-helpers';
import { verifyStaffToken } from './staff-jwt';

export interface AuthContext {
  merchantId: string;
  authorizedAppId: string;
  memberId?: string;
  role: string;
  permissions: string[];
  can: (p: string) => boolean;
  isOwner: boolean;
}

export function getAuthContext(request: Request): AuthContext | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;

  // Staff JWT: Authorization: Bearer <token>
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyStaffToken(token);
    if (!payload || !payload.merchantId) return null;
    const perms: string[] = payload.permissions ?? [];
    return {
      merchantId: payload.merchantId,
      authorizedAppId: payload.authorizedAppId,
      memberId: payload.sub ?? undefined,
      role: payload.role,
      permissions: perms,
      can: (p) => perms.includes('*') || perms.includes(p),
      isOwner: false,
    };
  }

  // ikas JWT: Authorization: JWT <token>
  if (authHeader.startsWith('JWT ')) {
    const token = authHeader.slice(4).trim();
    const tokenData = JwtHelpers.verifyToken(token);
    if (!tokenData || !tokenData.sub) return null;
    return {
      merchantId: tokenData.sub,
      authorizedAppId: tokenData.aud as string,
      role: 'owner',
      permissions: ['*'],
      can: () => true,
      isOwner: true,
    };
  }

  return null;
}

export function forbidden() {
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
