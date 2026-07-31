'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/toast';
import type { PublicStoreSettings } from '@/app/api/store-settings/route';

export default function ReturnsPage() {
  const [step, setStep] = useState<'search' | 'order' | 'reason' | 'success'>('search');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [createdRfNumber, setCreatedRfNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [settings, setSettings] = useState<PublicStoreSettings | null>(null);

  useEffect(() => {
    fetch('/api/store-settings')
      .then((res) => res.json())
      .then((result) => {
        if (result.data) setSettings(result.data);
      })
      .catch((err) => console.error('Store settings yüklenemedi:', err));
  }, []);

  const createReturnRequest = async () => {
    setIsSubmitting(true);

    // Upload files to Supabase Storage (storage bucket uses anon key — unchanged)
    const uploadedUrls: string[] = [];
    if (files) {
      for (const file of Array.from(files)) {
        const extension = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
        const { error: uploadError } = await supabase.storage.from('return-files').upload(fileName, file);
        if (uploadError) {
          console.error('Dosya yüklenemedi:', uploadError);
          setIsSubmitting(false);
          toast('Dosya yüklenemedi', 'error');
          return;
        }
        const { data } = supabase.storage.from('return-files').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }
    }

    // Submit return via server-side API (service role, merchant-scoped)
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: settings?.merchant_id,
        order_id: order.order_no,
        customer_name: order.customer_name,
        customer_email: email,
        product: selectedItems.map((item) => item.name).join(', '),
        products: selectedItems.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
        reason,
        description,
        amount: selectedItems.reduce((total, item) => total + Number(item.price || 0), 0),
        media_urls: uploadedUrls,
      }),
    });

    const result = await res.json();

    if (!res.ok || !result.data) {
      setIsSubmitting(false);
      toast('Kayıt sırasında hata oluştu', 'error');
      return;
    }

    const rfNumber: string = result.data.rf_number;

    // Fire automation evaluation (best-effort — do not block success screen)
    fetch('/api/automation/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ return_id: result.data.id }),
    }).catch(() => {});

    // Send notification email (best-effort)
    fetch('/api/email/return-created', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, customerName: order.customer_name, rfNumber, orderNo: order.order_no }),
    }).catch(() => {});

    setCreatedRfNumber(rfNumber);
    setIsSubmitting(false);
    setStep('success');
  };

  const findOrder = async () => {
    if (!settings?.merchant_id) {
      toast('Mağaza bilgisi yüklenemedi', 'error');
      return;
    }

    // Duplicate check is now server-side; just look up the order
    const url = `/api/ikas/order?orderNo=${encodeURIComponent(orderNo)}&email=${encodeURIComponent(email)}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!result.success) {
      toast('Sipariş bulunamadı', 'error');
      return;
    }

    setOrder(result.order);
    setStep('order');
  };

  const accentColor = settings?.primary_color || '#000000';
  const STEPS = ['Sipariş Bul', 'Ürün Seç', 'Sebep Gir'] as const;
  const stepIndex = step === 'search' ? 0 : step === 'order' ? 1 : step === 'reason' ? 2 : 3;

  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-8 md:p-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]">
            {/* Left panel */}
            <div style={{ background: accentColor }} className="text-white p-8 md:p-10 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />

              <div className="relative z-10">
                <div className="mb-8 flex items-center gap-3">
                  {settings?.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-12 w-12 rounded-xl bg-white object-contain p-2 border border-white/20" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.3em] text-white/60 uppercase">Return Portal</div>
                    <div className="text-lg font-bold leading-tight">{settings?.store_name || 'PELYXCOMMERCE'}</div>
                  </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">İade Merkezi</h1>
                <p className="mt-4 text-white/70 text-base leading-7">
                  Sipariş bilgilerinizi girin, iade talebinizi birkaç adımda oluşturun.
                </p>

                {settings?.support_email && (
                  <p className="mt-5 text-sm text-white/60">Destek: {settings.support_email}</p>
                )}

                {settings?.return_policy && (
                  <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/90 border border-white/10">
                    <strong className="block mb-1">İade Politikası</strong>
                    <p className="whitespace-pre-line text-white/80">{settings.return_policy}</p>
                  </div>
                )}

                {step !== 'success' && (
                  <div className="mt-10 space-y-3">
                    {STEPS.map((label, i) => (
                      <div key={label} className="flex items-center gap-3">
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                            i < stepIndex ? 'bg-white text-black' : i === stepIndex ? 'bg-white text-black' : 'bg-white/20 text-white/60'
                          }`}
                        >
                          {i < stepIndex ? '✓' : i + 1}
                        </div>
                        <span className={`text-sm font-medium ${i <= stepIndex ? 'text-white' : 'text-white/50'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel */}
            <div className="p-7 md:p-10">
              {step === 'search' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Siparişimi Bul</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">
                    İade talebi oluşturmak için sipariş numaranızı ve e-posta adresinizi girin.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="orderNo" className="mb-1.5 block text-xs font-medium text-gray-600">
                        Sipariş Numarası
                      </label>
                      <input
                        id="orderNo"
                        value={orderNo}
                        onChange={(e) => setOrderNo(e.target.value)}
                        placeholder="#1001"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-gray-600">
                        E-posta Adresi
                      </label>
                      <input
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="siparis@email.com"
                        type="email"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                      />
                    </div>
                    <button
                      onClick={findOrder}
                      style={{ background: accentColor }}
                      className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90"
                    >
                      Siparişimi Bul
                    </button>
                  </div>
                </>
              )}

              {step === 'order' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Sipariş Bulundu</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">İade etmek istediğiniz ürünleri seçin.</p>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 mb-6">
                    <p className="text-xs text-gray-500">Sipariş No</p>
                    <p className="font-bold text-lg mt-0.5">{order.id}</p>

                    <div className="mt-5">
                      <p className="text-xs text-gray-500 mb-3">Ürünler</p>
                      <div className="space-y-2">
                        {order.items?.map((item: any, index: number) => {
                          const checked = selectedItems.some((x) => x.name === item.name);
                          return (
                            <button
                              key={index}
                              onClick={() =>
                                checked ? setSelectedItems(selectedItems.filter((x) => x.name !== item.name)) : setSelectedItems([...selectedItems, item])
                              }
                              style={checked ? { borderColor: accentColor, background: accentColor } : {}}
                              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                                checked ? 'text-white' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                              }`}
                            >
                              {checked ? '✓ ' : ''}
                              {item.name} — {item.quantity} adet — ₺{item.price}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs text-gray-500">Toplam Tutar</p>
                      <p className="font-bold text-lg mt-0.5">{order.amount}</p>
                    </div>
                  </div>

                  <button
                    disabled={selectedItems.length === 0}
                    onClick={() => setStep('reason')}
                    style={{ background: accentColor }}
                    className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    Seçili Ürünlerle Devam Et
                  </button>
                </>
              )}

              {step === 'reason' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">İade Sebebi</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">Mağazanın talebinizi daha hızlı incelemesi için sebep seçin.</p>

                  <div className="space-y-2 mb-6">
                    {['Küçük geldi', 'Büyük geldi', 'Hasarlı geldi', 'Yanlış ürün geldi', 'Diğer'].map((item) => (
                      <button
                        key={item}
                        onClick={() => setReason(item)}
                        style={reason === item ? { borderColor: accentColor, background: accentColor } : {}}
                        className={`w-full text-left rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                          reason === item ? 'text-white' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>

                  <div className="mb-5">
                    <label htmlFor="description" className="block mb-1.5 text-xs font-medium text-gray-600">
                      Açıklama <span className="text-gray-400">(isteğe bağlı)</span>
                    </label>
                    <textarea
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="İade sebebini detaylı açıklayın..."
                      className="w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-gray-400 resize-none transition-colors"
                    />
                  </div>

                  <div className="mb-6">
                    <label htmlFor="mediaFiles" className="block mb-1.5 text-xs font-medium text-gray-600">
                      Fotoğraf / Video <span className="text-gray-400">(isteğe bağlı)</span>
                    </label>
                    <input
                      id="mediaFiles"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => setFiles(e.target.files)}
                      className="w-full rounded-xl border border-gray-200 p-4 text-sm"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">JPG, PNG, WEBP, MP4, MOV desteklenir.</p>
                  </div>

                  <button
                    disabled={!reason || isSubmitting}
                    onClick={createReturnRequest}
                    style={{ background: accentColor }}
                    className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    {isSubmitting ? 'Yükleniyor...' : 'İade Talebi Oluştur'}
                  </button>
                </>
              )}

              {step === 'success' && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div
                    style={{ background: accentColor }}
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-white text-2xl"
                  >
                    ✓
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight">Talebiniz Alındı</h2>
                  <p className="text-gray-500 mt-3 text-sm leading-6 max-w-xs">
                    İade talebiniz mağazaya iletildi. İnceleme sonrası size bilgi verilecektir.
                  </p>

                  <div className="mt-8 w-full rounded-2xl bg-gray-50 border border-gray-100 p-5 text-left">
                    <p className="text-xs text-gray-500">Talep No</p>
                    <p className="text-2xl font-bold mt-0.5">{createdRfNumber}</p>
                    <p className="mt-3 text-xs text-gray-500 leading-5">
                      Talebinizi takip etmek için İade Takibi sayfasını ziyaret edebilirsiniz.
                    </p>
                    <a
                      href="/track"
                      style={{ background: accentColor }}
                      className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    >
                      İade Takibine Git
                    </a>

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Durum</p>
                        <p className="font-semibold text-sm mt-0.5">İncelemede</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Sebep</p>
                        <p className="font-semibold text-sm mt-0.5">{reason}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
