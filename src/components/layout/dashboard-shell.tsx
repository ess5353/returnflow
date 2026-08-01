'use client';

import { Sidebar } from './sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';

interface DashboardShellProps {
  children: React.ReactNode;
  storeName?: string | null;
  logoUrl?: string | null;
}

export function DashboardShell({ children, storeName, logoUrl }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar storeName={storeName} logoUrl={logoUrl} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-11 shrink-0 items-center justify-end border-b border-border bg-card px-4">
          <NotificationBell />
        </header>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
