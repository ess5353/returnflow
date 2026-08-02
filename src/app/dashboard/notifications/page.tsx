'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { NOTIFICATION_CONFIG, NOTIFICATION_TYPE_OPTIONS, timeAgo } from '@/lib/notifications/config';
import type { NotificationType } from '@/lib/notifications/create';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  related_return_id: string | null;
  read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const { authHeader: token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const { settings, loadSettings } = useStoreSettings();
  const router = useRouter();

  const fetchNotifications = useCallback(async (t: string, p: number, type: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (type !== 'all') params.set('type', type);
    const res = await fetch(`/api/notifications?${params}`, { headers: { Authorization: t } });
    if (!res.ok) { setLoading(false); return; }
    const { data, total: t2, unread: u } = await res.json();
    setItems(data ?? []);
    setTotal(t2 ?? 0);
    setUnread(u ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (token) fetchNotifications(token, page, typeFilter);
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, page, typeFilter]);

  const markRead = async (id: string) => {
    if (!token) return;
    await fetch(`/api/notifications/${id}`, { method: 'PATCH', headers: { Authorization: token ?? '' } });
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnread((u) => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    if (!token) return;
    await fetch('/api/notifications/read-all', { method: 'PATCH', headers: { Authorization: token ?? '' } });
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    toast('Tüm bildirimler okundu işaretlendi', 'success');
  };

  const deleteNotification = async (id: string) => {
    if (!token) return;
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE', headers: { Authorization: token ?? '' } });
    if (!res.ok) { toast('Silme başarısız', 'error'); return; }
    setItems((prev) => prev.filter((n) => n.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) await markRead(n.id);
    if (n.related_return_id) router.push('/dashboard/returns-management');
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleTypeFilter = (type: string) => {
    setTypeFilter(type);
    setPage(1);
  };

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 md:p-8 max-w-3xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bildirimler</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {unread > 0 ? `${unread} okunmamış bildirim` : 'Tüm bildirimler okundu'}
            </p>
          </div>
          {unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead} className="shrink-0 gap-2">
              <CheckCheck className="h-3.5 w-3.5" />
              Tümünü Okundu İşaretle
            </Button>
          )}
        </div>

        {/* Type filter */}
        <div className="flex flex-wrap gap-1.5">
          {NOTIFICATION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleTypeFilter(opt.value)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                typeFilter === opt.value
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {loading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-4">
                  <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-48" />
                    <Skeleton className="h-3 w-64" />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <Bell className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Bu kategoride bildirim yok</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => {
                const cfg = NOTIFICATION_CONFIG[n.type as NotificationType];
                if (!cfg) return null;
                const Icon = cfg.icon;
                return (
                  <div
                    key={n.id}
                    className={cn(
                      'flex items-start gap-3 px-4 py-4 group',
                      !n.read && 'bg-blue-50/40 dark:bg-blue-950/20',
                    )}
                  >
                    {/* Unread indicator */}
                    <div className="flex items-center pt-1 shrink-0">
                      <div className={cn('h-2 w-2 rounded-full transition-colors', !n.read ? 'bg-blue-500' : 'bg-transparent')} />
                    </div>

                    {/* Icon */}
                    <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', cfg.bgClass)}>
                      <Icon className={cn('h-4 w-4', cfg.iconClass)} />
                    </div>

                    {/* Content — clickable area */}
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex items-center gap-2">
                        <p className={cn('text-sm font-semibold', !n.read ? 'text-foreground' : 'text-muted-foreground')}>
                          {n.title}
                        </p>
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                          cfg.bgClass, cfg.iconClass,
                        )}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </button>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markRead(n.id)}
                          title="Okundu işaretle"
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(n.id)}
                        title="Sil"
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!loading && pageCount > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}
              </p>
              <div className="flex items-center gap-1">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                {Array.from({ length: Math.min(pageCount, 5) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors',
                      page === p ? 'bg-primary text-primary-foreground' : 'border border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  disabled={page === pageCount}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
