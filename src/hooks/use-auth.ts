'use client';

import { useEffect, useRef, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';

export const STAFF_TOKEN_KEY = 'pelyx_staff_token';

export interface AuthState {
  ready: boolean;
  authHeader: string | undefined;
  role: string;
  permissions: string[];
  can: (p: string) => boolean;
  isOwner: boolean;
  memberName: string | null;
  memberId: string | null;
}

const NOT_READY: AuthState = {
  ready: false,
  authHeader: undefined,
  role: 'owner',
  permissions: ['*'],
  can: () => false,
  isOwner: true,
  memberName: null,
  memberId: null,
};

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>(NOT_READY);

  useEffect(() => {
    (async () => {
      // Try staff JWT first
      try {
        const staffToken = localStorage.getItem(STAFF_TOKEN_KEY);
        if (staffToken) {
          const parts = staffToken.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1])) as {
              type?: string; exp?: number; role?: string;
              permissions?: string[]; name?: string; sub?: string;
            };
            if (payload.type === 'staff' && (payload.exp ?? 0) * 1000 > Date.now()) {
              const perms: string[] = payload.permissions ?? [];
              setState({
                ready: true,
                authHeader: `Bearer ${staffToken}`,
                role: payload.role ?? 'support',
                permissions: perms,
                can: (p) => perms.includes('*') || perms.includes(p),
                isOwner: false,
                memberName: payload.name ?? null,
                memberId: payload.sub ?? null,
              });
              return;
            }
          }
          localStorage.removeItem(STAFF_TOKEN_KEY);
        }
      } catch {
        // ignore corrupted token
      }

      // Fall back to ikas JWT
      const t = await TokenHelpers.getTokenForIframeApp();
      setState({
        ready: true,
        authHeader: t ? `JWT ${t}` : undefined,
        role: 'owner',
        permissions: ['*'],
        can: () => true,
        isOwner: true,
        memberName: null,
        memberId: null,
      });
    })();
  }, []);

  return state;
}

/** Stable ref to authHeader — useful in async callbacks that shouldn't re-run when auth changes */
export function useAuthRef(): { current: string | undefined } {
  const auth = useAuth();
  const ref = useRef<string | undefined>(undefined);
  ref.current = auth.authHeader;
  return ref;
}
