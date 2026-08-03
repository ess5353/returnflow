'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center px-4">
      <p className="text-7xl font-bold text-muted-foreground/30">!</p>
      <h1 className="text-2xl font-bold">Bir Hata Oluştu</h1>
      <p className="text-sm text-muted-foreground max-w-xs">
        Beklenmeyen bir hata meydana geldi. Lütfen tekrar deneyin.
      </p>
      <button
        onClick={reset}
        className="mt-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Tekrar Dene
      </button>
    </div>
  );
}
