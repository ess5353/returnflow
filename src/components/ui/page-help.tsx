'use client';

import { useState, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHelpProps {
  title: string;
  content: ReactNode;
  className?: string;
}

/**
 * Small help icon button that opens a slide-in panel with page-specific help content.
 * Meant to be placed at the top-right corner of a dashboard page header.
 */
export function PageHelp({ title, content, className }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          aria-label="Bu sayfa hakkında yardım"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            className,
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            'fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <HelpCircle className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <Dialog.Title className="text-sm font-semibold text-foreground">{title}</Dialog.Title>
                <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                  Bu sayfayla ilgili kısa yardım
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Kapat"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-5 text-sm leading-relaxed text-foreground">
            {content}
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
            Daha fazla yardım için sol menüden{' '}
            <span className="font-medium text-foreground">Yardım</span> sayfasını ziyaret edin.
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
