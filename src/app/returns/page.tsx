'use client';

import { ArrowLeftRight } from 'lucide-react';

export default function ReturnsIndexPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl border border-gray-100 p-8 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
          <ArrowLeftRight className="h-7 w-7 text-gray-400" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Geçersiz Portal Bağlantısı</h1>
        <p className="mt-3 text-sm text-gray-500 leading-relaxed">
          Bu sayfa geçerli bir mağaza bağlantısı içermiyor. Lütfen mağazanın size sağladığı özel iade bağlantısını kullanın.
        </p>
        <p className="mt-4 text-xs text-gray-400">
          Doğru bağlantı genellikle şu formattadır:<br />
          <code className="font-mono text-gray-600">/returns/[mağaza-kodu]</code>
        </p>
      </div>
    </main>
  );
}
