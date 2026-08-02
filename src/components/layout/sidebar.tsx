'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ArrowLeftRight, BarChart2, Bell, BookOpen, Brain, ChevronLeft, ChevronRight, ClipboardList, CreditCard, Globe, HelpCircle, Info, Key, LayoutDashboard, LayoutList, Mail, ScrollText, Settings, ShieldCheck, Users, Zap } from 'lucide-react';

type NavItem = { href: string; label: string; icon: React.ElementType; exact: boolean };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Genel Bakış', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/returns-management', label: 'İade Yönetimi', icon: LayoutList, exact: false },
  { href: '/dashboard/analytics', label: 'Analiz', icon: BarChart2, exact: false },
  { href: '/dashboard/insights', label: 'AI Insights', icon: Brain, exact: false },
  { href: '/dashboard/automation', label: 'Otomasyon', icon: Zap, exact: false },
  { href: '/dashboard/notifications', label: 'Bildirimler', icon: Bell, exact: false },
  { href: '/dashboard/email-templates', label: 'E-posta Şablonları', icon: Mail, exact: false },
  { href: '/dashboard/webhooks', label: 'Webhooks', icon: Globe, exact: false },
  { href: '/dashboard/api-keys', label: 'API Anahtarları', icon: Key, exact: false },
  { href: '/dashboard/api-docs', label: 'API Belgeleri', icon: BookOpen, exact: false },
  { href: '/dashboard/team', label: 'Takım', icon: Users, exact: false },
  { href: '/dashboard/audit-logs', label: 'Denetim Günlüğü', icon: ClipboardList, exact: false },
  { href: '/dashboard/billing', label: 'Fatura & Plan', icon: CreditCard, exact: false },
  { href: '/dashboard/security', label: 'Güvenlik', icon: ShieldCheck, exact: false },
  { href: '/dashboard/settings', label: 'Ayarlar', icon: Settings, exact: false },
];

const NAV_BOTTOM: NavItem[] = [
  { href: '/dashboard/help', label: 'Yardım', icon: HelpCircle, exact: false },
  { href: '/dashboard/changelog', label: 'Değişiklikler', icon: ScrollText, exact: false },
  { href: '/dashboard/about', label: 'Hakkında', icon: Info, exact: false },
];

interface SidebarProps {
  storeName?: string | null;
  logoUrl?: string | null;
}

export function Sidebar({ storeName, logoUrl }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-border bg-card transition-[width] duration-300 ease-in-out shrink-0',
        collapsed ? 'w-14' : 'w-56',
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-14 items-center gap-2.5 border-b border-border overflow-hidden', collapsed ? 'px-3 justify-center' : 'px-4')}>
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-7 w-7 rounded-md object-contain shrink-0 border border-border bg-white" />
        ) : (
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
            <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
          </div>
        )}
        {!collapsed && (
          <span className="truncate text-sm font-semibold text-foreground leading-tight">{storeName || 'ReturnFlow'}</span>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 overflow-y-auto space-y-0.5 py-3', collapsed ? 'px-2' : 'px-3')}>
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom nav — help / changelog / about */}
      <div className={cn('border-t border-border py-2 space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        {NAV_BOTTOM.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? 'Genişlet' : 'Daralt'}
        className="absolute -right-3 top-[3.25rem] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm hover:bg-muted transition-colors z-10"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}
