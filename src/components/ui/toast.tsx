'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  message: string;
  variant: Variant;
}

let _addToast: ((message: string, variant: Variant) => void) | null = null;

export function toast(message: string, variant: Variant = 'info') {
  _addToast?.(message, variant);
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    _addToast = (message, variant) => {
      const id = Math.random().toString(36).slice(2);
      setItems((prev) => [...prev, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    };
    return () => {
      _addToast = null;
    };
  }, [remove]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const Icon = t.variant === 'success' ? CheckCircle2 : t.variant === 'error' ? AlertCircle : Info;
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg text-sm font-medium min-w-[260px] max-w-xs',
              'animate-in slide-in-from-bottom-2 fade-in duration-200',
              t.variant === 'success' && 'border-emerald-200',
              t.variant === 'error' && 'border-red-200',
              t.variant === 'info' && 'border-border',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                t.variant === 'success' && 'text-emerald-600',
                t.variant === 'error' && 'text-red-600',
                t.variant === 'info' && 'text-muted-foreground',
              )}
            />
            <span className="flex-1 text-foreground">{t.message}</span>
            <button
              onClick={() => remove(t.id)}
              className="ml-1 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
