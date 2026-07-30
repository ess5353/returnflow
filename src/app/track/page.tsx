'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { PublicStoreSettings } from '@/app/api/store-settings/route';
import { ArrowLeftRight, Check, Clock, X } from 'lucide-react';

type ReturnRequest = {
  id: string;
  rf_number: string;
  order_id: string;
  customer_name: string;
  reason: string;
  description: string | null;
  admin_note: string | null;
  amount: string;
  status: string;
  created_at: string;
  products: { name: string; quantity: number; price: number }[] | null;
  media_urls: string[] | null;
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    'Onaylandı': { label: 'Onaylandı', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    'Reddedildi': { label: 'Reddedildi', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    'Yeni Talep': { label: 'İncelemede', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
  };
  const config = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground ring-1 ring-border' };
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${config.cls}`}>{config.label}</span>;
}

export default function TrackPage() {
  const [trackingId, setTrackingId] = useState('');
  const [email, setEmail] = useState('');
  const [request, setRequest] = useState<ReturnRequest | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [settings, setSettings] = useState<PublicStoreSettings | null>(null);

  useEffect(() => {
    fetch('/api/store-settings')
      .then((r) => r.json())
      .then((result) => { if (result.data) setSettings(result.data); })
      .catch((err) => console.error('Store settings yüklenemedi:', err));
  }, []);

  const searchRequest = async () => {
    const { data, error } = await supabase
      .from('return_requests')
      .select('*')
      .or(`order_id.eq.${trackingId},rf_number.eq.${trackingId}`)
      .eq('customer_email', email);

    if (error) {
      console.error(error);
    }

    if (data && data.length > 0) {
      setRequest(data[0] as ReturnRequest);
      setNotFound(false);
    } else {
      setRequest(null);
      setNotFound(true);
    }
  };

  const accentColor = settings?.primary_color || '#000000';

  const timelineSteps = [
    {
      label: 'Talep Oluşturuldu',
      done: true,
      icon: Check,
    },
    {
      label: 'İnceleme Süreci',
      done: request ? request.status !== 'Yeni Talep' : false,
      icon: Clock,
    },
    {
      label: request?.status === 'Onaylandı' ? 'İade Onaylandı' : request?.status === 'Reddedildi' ? 'İade Reddedildi' : 'Karar Bekleniyor',
      done: request ? request.status === 'Onaylandı' || request.status === 'Reddedildi' : false,
      rejected: request?.status === 'Reddedildi',
      icon: request?.status === 'Reddedildi' ? X : Check,
    },
  ];

  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-8 md:p-10">
      <section className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-9 w-9 rounded-xl border border-gray-200 bg-white object-contain p-1" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
              <ArrowLeftRight className="h-4 w-4 text-gray-500" />
            </div>
          )}
          <div>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Return Portal</p>
            <p className="text-sm font-bold leading-tight">{settings?.store_name || 'PELYXCOMMERCE'}</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-xl border border-gray-100 overflow-hidden">
          {/* Search section */}
          <div className="p-6 md:p-8 border-b border-gray-100">
            <h1 className="text-2xl font-bold tracking-tight">İade Takibi</h1>
            <p className="mt-1 text-sm text-gray-500">Sipariş numaranız veya RF takip kodunuzla talebinizi sorgulayın.</p>

            <div className="mt-6 space-y-3">
              <div>
                <label htmlFor="trackingId" className="mb-1.5 block text-xs font-medium text-gray-600">
                  Sipariş No veya RF Takip Kodu
                </label>
                <input
                  id="trackingId"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="#1001 veya RF-2024.01.01-0001"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <div>
                <label htmlFor="trackEmail" className="mb-1.5 block text-xs font-medium text-gray-600">
                  E-posta Adresi
                </label>
                <input
                  id="trackEmail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="siparis@email.com"
                  type="email"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                />
              </div>
              <button
                onClick={searchRequest}
                style={{ background: accentColor }}
                className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90"
              >
                Sorgula
              </button>
            </div>
          </div>

          {/* Not found */}
          {notFound && (
            <div className="p-6 md:p-8">
              <div className="rounded-2xl border border-red-100 bg-red-50 p-5">
                <p className="font-semibold text-sm text-red-700">İade talebi bulunamadı</p>
                <p className="mt-1 text-sm text-red-600">Sipariş numarası veya e-posta adresinizi kontrol edin.</p>
              </div>
            </div>
          )}

          {/* Result */}
          {request && (
            <div className="p-6 md:p-8 space-y-6">
              {/* Request header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-gray-500">Talep No</p>
                  <p className="font-mono text-xl font-bold mt-0.5">{request.rf_number}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Sipariş: {request.order_id} · {new Date(request.created_at).toLocaleDateString('tr-TR')}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-4 rounded-2xl bg-gray-50 p-4 border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500">Sebep</p>
                  <p className="font-semibold text-sm mt-0.5">{request.reason}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tutar</p>
                  <p className="font-semibold text-sm mt-0.5">₺{Number(request.amount).toLocaleString('tr-TR')}</p>
                </div>
              </div>

              {/* Products */}
              {request.products && request.products.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">İade Edilen Ürünler</p>
                  <div className="space-y-2">
                    {request.products.map((item, index) => (
                      <div key={index} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <p className="font-semibold text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {item.quantity} Adet · ₺{item.price}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {request.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Açıklama</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{request.description}</p>
                </div>
              )}

              {/* Media */}
              {request.media_urls && request.media_urls.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Yüklenen Dosyalar</p>
                  <div className="grid grid-cols-2 gap-2">
                    {request.media_urls.map((url: string, index: number) => (
                      <img key={index} src={url} alt="media" className="w-full rounded-xl border border-gray-100 object-cover" />
                    ))}
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                <p className="text-xs font-semibold text-gray-600 mb-4">İade Süreci</p>
                <div className="space-y-4">
                  {timelineSteps.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0 ${
                            s.done ? (s.rejected ? 'bg-red-500' : 'bg-emerald-500') : 'bg-gray-200'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className={`text-sm font-medium ${s.done ? 'text-gray-800' : 'text-gray-400'}`}>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Admin note */}
              {request.admin_note && (
                <div
                  style={{ background: accentColor }}
                  className="rounded-2xl p-5 text-white"
                >
                  <p className="text-xs font-semibold text-white/70 mb-1.5">Mağaza Notu</p>
                  <p className="text-sm leading-relaxed">{request.admin_note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
