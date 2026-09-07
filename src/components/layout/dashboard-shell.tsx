'use client';

import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Menu } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Paywall } from '@/components/billing/paywall';
import type { Entitlement } from '@/lib/billing/entitlement';

interface DashboardShellProps {
  children: React.ReactNode;
  storeName?: string | null;
  logoUrl?: string | null;
}

type Gate =
  | { phase: 'loading' }
  | { phase: 'allowed' }
  | { phase: 'blocked'; entitlement: Entitlement | null };

export function DashboardShell({ children, storeName, logoUrl }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { authHeader, ready, isOwner, can } = useAuth();
  const [gate, setGate] = useState<Gate>({ phase: 'loading' });

  const checkEntitlement = useCallback(async () => {
    if (!authHeader) return;
    try {
      const res = await fetch('/api/billing/status', { headers: { Authorization: authHeader } });
      if (!res.ok) {
        // Fail OPEN on a transient status error — server-side guards still
        // protect every operational endpoint, so we never wrongly lock out a
        // paying merchant over a blip.
        setGate({ phase: 'allowed' });
        return;
      }
      const json = await res.json();
      const entitlement = json.data as Entitlement | undefined;
      if (entitlement && entitlement.isActive === false) {
        setGate({ phase: 'blocked', entitlement });
      } else {
        setGate({ phase: 'allowed' });
      }
    } catch {
      setGate({ phase: 'allowed' });
    }
  }, [authHeader]);

  useEffect(() => {
    if (!ready) return;
    if (!authHeader) {
      // No session yet — let the page's own auth handling run.
      setGate({ phase: 'allowed' });
      return;
    }
    void checkEntitlement();
  }, [ready, authHeader, checkEntitlement]);

  if (gate.phase === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (gate.phase === 'blocked') {
    return (
      <Paywall
        entitlement={gate.entitlement}
        authHeader={authHeader}
        canManageBilling={isOwner || can('billing.manage')}
        isStaff={!isOwner}
        storeName={storeName}
        logoUrl={logoUrl}
        onReactivated={() => {
          setGate({ phase: 'loading' });
          void checkEntitlement();
        }}
      />
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        storeName={storeName}
        logoUrl={logoUrl}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-card px-4">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü Aç"
            className="flex md:hidden items-center justify-center h-8 w-8 rounded-md hover:bg-muted transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
