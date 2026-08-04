'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Check, ChevronDown, ChevronUp, Circle } from 'lucide-react';
import Link from 'next/link';

const STORAGE_PREFIX = 'pelyx_checklist_';

interface ChecklistItem {
  id: string;
  label: string;
  desc: string;
  href: string;
  linkLabel: string;
}

const ITEMS: ChecklistItem[] = [
  {
    id: 'portal_link',
    label: 'Müşteri portal linkini paylaş',
    desc: 'Sipariş e-postalarına veya sitenize ekleyin.',
    href: `${process.env.NEXT_PUBLIC_DEPLOY_URL ?? ''}/returns`,
    linkLabel: 'Portala Git',
  },
  {
    id: 'email_setup',
    label: 'Bildirim e-postasını ayarla',
    desc: 'Yeni talepler için bildirim alın.',
    href: '/dashboard/settings',
    linkLabel: 'Ayarlara Git',
  },
  {
    id: 'email_template',
    label: 'E-posta şablonunu özelleştir',
    desc: 'Müşterilere gönderilen e-postaları markanıza uygun hale getirin.',
    href: '/dashboard/email-templates',
    linkLabel: 'Şablonlara Git',
  },
  {
    id: 'automation',
    label: 'İlk otomasyon kuralını oluştur',
    desc: 'Tekrarlayan işlemleri otomatikleştirin.',
    href: '/dashboard/automation',
    linkLabel: 'Otomasyona Git',
  },
  {
    id: 'team_invite',
    label: 'Takım üyesi davet et',
    desc: 'Ekibinize rol tabanlı erişim verin.',
    href: '/dashboard/team',
    linkLabel: 'Takıma Git',
  },
];

function useChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    return ITEMS.reduce<Record<string, boolean>>((acc, item) => {
      acc[item.id] = localStorage.getItem(`${STORAGE_PREFIX}${item.id}`) === '1';
      return acc;
    }, {});
  });

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`${STORAGE_PREFIX}${id}`, next[id] ? '1' : '0');
      }
      return next;
    });
  };

  return { checked, toggle };
}

export function OnboardingChecklist() {
  const { checked, toggle } = useChecklist();
  const [collapsed, setCollapsed] = useState(false);

  const done = Object.values(checked).filter(Boolean).length;
  const total = ITEMS.length;
  const allDone = done === total;

  if (allDone) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 shrink-0">
            <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted" />
              <circle
                cx="16" cy="16" r="13"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${(done / total) * 81.68} 81.68`}
                className="text-primary transition-all duration-500"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
              {done}/{total}
            </span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Kurulum Adımları</p>
            <p className="text-xs text-muted-foreground">{done === 0 ? 'Başlamak için ilk adımı tamamlayın' : `${done} / ${total} tamamlandı`}</p>
          </div>
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="border-t border-border divide-y divide-border">
          {ITEMS.map((item) => {
            const isDone = !!checked[item.id];
            return (
              <div key={item.id} className={cn('flex items-start gap-3 px-5 py-3.5', isDone && 'opacity-60')}>
                <button
                  onClick={() => toggle(item.id)}
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    isDone ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary',
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : <Circle className="h-2 w-2 opacity-0" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium', isDone && 'line-through')}>{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                {!isDone && (
                  <Link
                    href={item.href}
                    className="shrink-0 text-xs font-medium text-primary hover:underline whitespace-nowrap"
                  >
                    {item.linkLabel}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
