'use client';

import { useEffect, useState } from 'react';
import type { PublicStoreSettings } from '@/app/api/store-settings/route';
import { ArrowLeftRight, Check, Clock, ExternalLink, Hash, Truck, X } from 'lucide-react';
import { getCarrierLabel, getShippingStatusLabel, getTrackingUrl } from '@/lib/shipping/carriers';

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
  request_type: 'return' | 'exchange' | null;
  exchange_type: 'same_product_size' | 'same_product_color' | 'different_product' | null;
  exchange_variant: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shipping_status: string | null;
  shipping_date: string | null;
  delivered_date: string | null;
};

const EXCHANGE_TYPE_LABELS: Record<string, string> = {
  same_product_size: 'Aynı ürün, farklı beden',
  same_product_color: 'Aynı ürün, farklı renk',
  different_product: 'Farklı ürün',
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    'Onaylandı': { label: 'Onaylandı', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
    'Reddedildi': { label: 'Reddedildi', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
    'Yeni Talep': { label: 'İncelemede', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    'İncelemede': { label: 'İncelemede', cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' },
    'Kargoya Verildi': { label: 'Kargoya Verildi', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
    'Tamamlandı': { label: 'Tamamlandı', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' },
  };
  const config = map[status] ?? { label: status, cls: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200' };
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
    const params = new URLSearchParams({ q: trackingId.trim(), email: email.trim() });
    const res = await fetch(`/api/track?${params.toString()}`);
    const result = await res.json();

    if (result.data && result.data.length > 0) {
      setRequest(result.data[0] as ReturnRequest);
      setNotFound(false);
    } else {
      setRequest(null);
      setNotFound(true);
    }
  };

  const accentColor = settings?.primary_color || '#000000';

  const isExchange = request?.request_type === 'exchange';
  const isShipped = request?.status === 'Kargoya Verildi';
  const isCompleted = request?.status === 'Tamamlandı';

  const timelineSteps = [
    { label: 'Talep Oluşturuldu', done: true, icon: Check },
    { label: 'İnceleme Süreci', done: request ? request.status !== 'Yeni Talep' : false, icon: Clock },
    {
      label: request?.status === 'Onaylandı' ? (isExchange ? 'Değişim Onaylandı' : 'İade Onaylandı')
        : request?.status === 'Reddedildi' ? (isExchange ? 'Değişim Reddedildi' : 'İade Reddedildi')
        : 'Karar Bekleniyor',
      done: request ? ['Onaylandı', 'Reddedildi', 'Kargoya Verildi', 'Tamamlandı'].includes(request.status) : false,
      rejected: request?.status === 'Reddedildi',
      icon: request?.status === 'Reddedildi' ? X : Check,
    },
    ...(isExchange ? [{
      label: isCompleted ? 'Tamamlandı' : isShipped ? 'Kargoya Verildi' : 'Ürün Gönderimi Bekleniyor',
      done: isShipped || isCompleted,
      rejected: false,
      icon: Check,
    }] : []),
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
            <p className="text-sm font-bold leading-tight">{settings?.store_name || 'Mağaza'}</p>
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
                  <p className="text-xs text-gray-500">Talep Türü</p>
                  <p className="font-semibold text-sm mt-0.5">{request.request_type === 'exchange' ? 'Değişim' : 'İade'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Tutar</p>
                  <p className="font-semibold text-sm mt-0.5">₺{Number(request.amount).toLocaleString('tr-TR')}</p>
                </div>
                {request.request_type === 'exchange' && request.exchange_type ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">Değişim Türü</p>
                      <p className="font-semibold text-sm mt-0.5">{EXCHANGE_TYPE_LABELS[request.exchange_type] ?? request.exchange_type}</p>
                    </div>
                    {request.exchange_variant && (
                      <div>
                        <p className="text-xs text-gray-500">İstenen</p>
                        <p className="font-semibold text-sm mt-0.5">{request.exchange_variant}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500">Sebep</p>
                    <p className="font-semibold text-sm mt-0.5">{request.reason}</p>
                  </div>
                )}
              </div>

              {/* Products */}
              {request.products && request.products.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">{request.request_type === 'exchange' ? 'Değişim Ürünleri' : 'İade Edilen Ürünler'}</p>
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
                <p className="text-xs font-semibold text-gray-600 mb-4">{request.request_type === 'exchange' ? 'Değişim Süreci' : 'İade Süreci'}</p>
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

              {/* Shipping info */}
              {(request.carrier || request.tracking_number) && (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5">
                  <p className="text-xs font-semibold text-gray-600 mb-3">Kargo Takibi</p>
                  <div className="space-y-2.5">
                    {request.carrier && (
                      <div className="flex items-center gap-2.5">
                        <Truck className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-semibold">{getCarrierLabel(request.carrier)}</span>
                      </div>
                    )}
                    {request.tracking_number && (
                      <div className="flex items-center gap-2.5">
                        <Hash className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-sm font-mono tracking-wide">{request.tracking_number}</span>
                      </div>
                    )}
                    {request.shipping_status && (
                      <div className="flex items-center gap-2.5">
                        <div className={`h-2 w-2 rounded-full shrink-0 ${
                          request.shipping_status === 'delivered' ? 'bg-emerald-500'
                          : request.shipping_status === 'failed' ? 'bg-red-500'
                          : request.shipping_status === 'out_for_delivery' ? 'bg-blue-500'
                          : 'bg-amber-400'
                        }`} />
                        <span className="text-sm text-gray-700">{getShippingStatusLabel(request.shipping_status)}</span>
                      </div>
                    )}
                  </div>
                  {request.carrier && request.tracking_number && (() => {
                    const url = getTrackingUrl(request.carrier, request.tracking_number);
                    if (!url) return null;
                    return (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ background: accentColor }}
                        className="mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                      >
                        <ExternalLink className="h-4 w-4" />
                        Kargonu Takip Et
                      </a>
                    );
                  })()}
                </div>
              )}

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
