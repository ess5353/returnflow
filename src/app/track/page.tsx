'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState('');
  const [request, setRequest] = useState<any>(null);
const [email, setEmail] = useState('');


  const searchRequest = async () => {
  const { data, error } = await supabase
    .from('return_requests')
    .select('*')
    .eq('order_id', trackingId)
      .eq('customer_email', email);

  console.log('TRACKING ID:', trackingId);
  console.log('DATA:', data);
  console.log('ERROR:', error);

  if (data && data.length > 0) {
    setRequest(data[0]);
  }
};

  return (
    <main className="min-h-screen bg-[#f4f5f7] p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-4xl font-bold mb-6">
          İade Takibi
        </h1>

      <div className="space-y-3">
  <input
    value={trackingId}
    onChange={(e) => setTrackingId(e.target.value)}
    placeholder="Sipariş No Gir"
    className="w-full rounded-2xl border p-4"
  />

  <input
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="E-posta Adresiniz"
    className="w-full rounded-2xl border p-4"
  />

  <button
    onClick={searchRequest}
    className="w-full rounded-2xl bg-black py-4 text-white font-bold"
  >
    Sorgula
  </button>
</div>

        {request && (
          <div className="mt-8 rounded-3xl bg-white p-6 border">
            <h2 className="text-2xl font-bold">
              {request.order_id}
              <p className="mt-2 text-gray-500">
  {new Date(request.created_at).toLocaleDateString('tr-TR')}
</p>
            </h2>

            <div className="mt-4">
  <span
    className={`inline-flex rounded-full px-4 py-2 text-sm font-bold ${
      request.status === 'Onaylandı'
        ? 'bg-green-100 text-green-700'
        : request.status === 'Reddedildi'
        ? 'bg-red-100 text-red-700'
        : 'bg-yellow-100 text-yellow-700'
    }`}
  >
    {request.status}
  </span>
</div>

            <p className="mt-2">
              <strong>Sebep:</strong> {request.reason}
            </p>

          {request.description && (
  <p className="mt-2">
    <strong>Açıklama:</strong> {request.description}
  </p>
)}

{request.media_urls && request.media_urls.length > 0 && (
  <div className="mt-6">
    <p className="font-bold mb-3">
      Yüklenen Dosyalar
    </p>

    <div className="grid grid-cols-2 gap-3">
      {request.media_urls.map((url: string, index: number) => (
        <img
          key={index}
          src={url}
          alt="media"
          className="rounded-2xl border"
        />
      ))}
    </div>
  </div>
)}

           <div className="mt-8 rounded-3xl bg-[#f8f9fb] p-6">
  <h3 className="font-bold mb-5">
    İade Süreci
  </h3>

  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <div className="h-8 w-8 rounded-full bg-green-500 text-white flex items-center justify-center">
        ✓
      </div>
      <span>Talep Oluşturuldu</span>
    </div>

    <div className="flex items-center gap-3">
      <div
        className={`h-8 w-8 rounded-full text-white flex items-center justify-center ${
          request.status !== 'Yeni Talep'
            ? 'bg-green-500'
            : 'bg-gray-300'
        }`}
      >
        ✓
      </div>
      <span>İnceleme Süreci</span>
    </div>

    <div className="flex items-center gap-3">
      <div
        className={`h-8 w-8 rounded-full text-white flex items-center justify-center ${
          request.status === 'Onaylandı'
            ? 'bg-green-500'
            : request.status === 'Reddedildi'
            ? 'bg-red-500'
            : 'bg-gray-300'
        }`}
      >
        ✓
      </div>

      <span>
        {request.status === 'Onaylandı'
          ? 'İade Onaylandı'
          : request.status === 'Reddedildi'
          ? 'İade Reddedildi'
          : 'Karar Bekleniyor'}
      </span>
    </div>
  </div>
</div>

{request.admin_note && (
  <div className="mt-6 rounded-3xl bg-black p-5 text-white">
    <p className="text-white/60 text-sm mb-2">
      Mağaza Notu
    </p>

    <p>
      {request.admin_note}
    </p>
  </div>
)}

          </div>
        )}
      </div>
    </main>
  );
}