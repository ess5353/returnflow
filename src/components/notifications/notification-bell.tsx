'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { NOTIFICATION_CONFIG, timeAgo } from '@/lib/notifications/config';
import type { NotificationType } from '@/lib/notifications/create';
import { cn } from '@/lib/utils';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_return_id: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [token, setToken] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const fetchUnread = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/notifications?limit=1', { headers: { Authorization: `JWT ${t}` } });
      if (!res.ok) return;
      const { unread: u } = await res.json();
      setUnread(u ?? 0);
    } catch {}
  }, []);

  const fetchDropdown = useCallback(async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=10', { headers: { Authorization: `JWT ${t}` } });
      if (!res.ok) return;
      const { data, unread: u } = await res.json();
      setItems(data ?? []);
      setUnread(u ?? 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    TokenHelpers.getTokenForIframeApp().then((t) => {
      setToken(t);
      if (t) fetchUnread(t);
    });
  }, [fetchUnread]);

  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => fetchUnread(token), 30_000);
    return () => clearInterval(id);
  }, [token, fetchUnread]);

  useEffect(() => {
    if (open && token) fetchDropdown(token);
  }, [open, token, fetchDropdown]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = useCallback(async (id: string) => {
    if (!token) return;
    await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { Authorization: `JWT ${token}` } });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  }, [token]);

  const markAllRead = async () => {
    if (!token) return;
    await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: `JWT ${token}` } });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    setOpen(false);
    router.push('/dashboard/returns-management');
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Bildirimler"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white leading-none">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">Bildirimler</p>
              {unread > 0 && (
                <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {loading ? (
              <div className="flex flex-col gap-2 p-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="h-7 w-7 rounded-full bg-muted shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-muted rounded w-3/4" />
                      <div className="h-2.5 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-8">
                <Bell className="h-7 w-7 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Henüz bildirim yok</p>
              </div>
            ) : (
              items.map((n) => {
                const cfg = NOTIFICATION_CONFIG[n.type as NotificationType];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors',
                      !n.read && 'bg-blue-50/40 dark:bg-blue-950/20',
                    )}
                  >
                    <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', cfg.bgClass)}>
                      <Icon className={cn('h-3.5 w-3.5', cfg.iconClass)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className={cn('text-xs font-semibold truncate', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
                          {n.title}
                        </p>
                        {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:underline"
            >
              Tüm bildirimleri gör →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
