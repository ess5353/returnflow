'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Menu } from 'lucide-react';

interface DashboardShellProps {
  children: React.ReactNode;
  storeName?: string | null;
  logoUrl?: string | null;
}

export function DashboardShell({ children, storeName, logoUrl }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

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
