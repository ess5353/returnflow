'use client';

import { Sidebar } from './sidebar';

interface DashboardShellProps {
  children: React.ReactNode;
  storeName?: string | null;
  logoUrl?: string | null;
}

export function DashboardShell({ children, storeName, logoUrl }: DashboardShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar storeName={storeName} logoUrl={logoUrl} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
