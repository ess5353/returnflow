'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/toast';
import type { PublicStoreSettings } from '@/app/api/store-settings/route';
import { ArrowLeftRight, RotateCcw } from 'lucide-react';

type OperationMode = 'both' | 'return_only' | 'exchange_only';

type Step = 'search' | 'order' | 'type' | 'reason' | 'exchange' | 'success';
type RequestType = 'return' | 'exchange';
type ExchangeType = 'same_product_size' | 'same_product_color' | 'different_product';

const EXCHANGE_TYPE_OPTIONS: { value: ExchangeType; label: string; description: string }[] = [
  { value: 'same_product_size', label: 'Aynı ürün, farklı beden', description: 'Aynı ürünü farklı bedende almak istiyorum.' },
  { value: 'same_product_color', label: 'Aynı ürün, farklı renk', description: 'Aynı ürünü farklı renkte almak istiyorum.' },
  { value: 'different_product', label: 'Farklı ürün', description: 'Başka bir ürünle değiştirmek istiyorum.' },
];

const EXCHANGE_VARIANT_LABEL: Record<ExchangeType, string> = {
  same_product_size: 'İstediğiniz beden',
  same_product_color: 'İstediğiniz renk',
  different_product: 'İstediğiniz ürün adı',
};

const EXCHANGE_VARIANT_PLACEHOLDER: Record<ExchangeType, string> = {
  same_product_size: 'Örn: XL, 42, Large...',
  same_product_color: 'Örn: Kırmızı, Lacivert...',
  different_product: 'Almak istediğiniz ürünü yazın',
};

const EXCHANGE_TYPE_LABELS: Record<ExchangeType, string> = {
  same_product_size: 'Aynı ürün, farklı beden',
  same_product_color: 'Aynı ürün, farklı renk',
  different_product: 'Farklı ürün',
};

export default function ReturnsPage() {
  const { storeKey } = useParams<{ storeKey: string }>();

  const [step, setStep] = useState<Step>('search');
  const [requestType, setRequestType] = useState<RequestType>('return');
  const [exchangeType, setExchangeType] = useState<ExchangeType | null>(null);
  const [exchangeVariant, setExchangeVariant] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileList | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFindingOrder, setIsFindingOrder] = useState(false);
  const [email, setEmail] = useState('');
  const [orderNo, setOrderNo] = useState('');
  const [order, setOrder] = useState<Record<string, unknown> | null>(null);
  const [createdRfNumber, setCreatedRfNumber] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ name: string; quantity: number; price: number }[]>([]);
  const [settings, setSettings] = useState<PublicStoreSettings | null>(null);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalFilesCount, setTotalFilesCount] = useState(0);

  useEffect(() => {
    if (!storeKey) return;
    fetch(`/api/store-settings?storeKey=${encodeURIComponent(storeKey)}`)
      .then((res) => res.json())
      .then((result) => { if (result.data) setSettings(result.data); })
      .catch(() => undefined);
  }, [storeKey]);

  const createRequest = async () => {
    setIsSubmitting(true);
    setUploadedCount(0);

    const fileList = files ? Array.from(files) : [];
    setTotalFilesCount(fileList.length);

    const uploadedUrls: string[] = [];
    for (const file of fileList) {
      const extension = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('return-files').upload(fileName, file);
      if (uploadError) {
        setIsSubmitting(false);
        setTotalFilesCount(0);
        toast('Dosya yüklenemedi', 'error');
        return;
      }
      const { data } = supabase.storage.from('return-files').getPublicUrl(fileName);
      uploadedUrls.push(data.publicUrl);
      setUploadedCount((n) => n + 1);
    }

    const payload: Record<string, unknown> = {
      store_key: storeKey,
      order_id: (order as Record<string, unknown>).order_no,
      customer_name: (order as Record<string, unknown>).customer_name,
      customer_email: email,
      product: selectedItems.map((item) => item.name).join(', '),
      products: selectedItems.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })),
      amount: selectedItems.reduce((total, item) => total + Number(item.price || 0), 0),
      media_urls: uploadedUrls,
      request_type: requestType,
    };

    if (requestType === 'return') {
      payload.reason = reason;
      payload.description = description;
    } else {
      payload.reason = 'Değişim Talebi';
      payload.description = description;
      payload.exchange_type = exchangeType;
      payload.exchange_variant = exchangeVariant;
    }

    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok || !result.data) {
      setIsSubmitting(false);
      if (res.status === 403 && result.code === 'PLAN_EXPIRED') {
        toast('Bu mağaza şu anda iade kabulü yapmıyor. Lütfen mağazayla iletişime geçin.', 'error');
      } else {
        toast(res.status === 409 ? 'Bu sipariş için zaten bir talep oluşturulmuş.' : 'Kayıt sırasında hata oluştu', 'error');
      }
      return;
    }

    setCreatedRfNumber(result.data.rf_number);
    setIsSubmitting(false);
    setTotalFilesCount(0);
    setStep('success');
  };

  const findOrder = async () => {
    if (!orderNo.trim() || !email.trim()) {
      toast('Sipariş numarası ve e-posta gerekli', 'error');
      return;
    }

    setIsFindingOrder(true);
    const url = `/api/ikas/order?orderNo=${encodeURIComponent(orderNo)}&email=${encodeURIComponent(email)}&storeKey=${encodeURIComponent(storeKey)}`;
    const response = await fetch(url);
    const result = await response.json();
    setIsFindingOrder(false);

    if (!result.success) {
      toast('Sipariş bulunamadı', 'error');
      return;
    }

    setOrder(result.order);
    setStep('order');
  };

  const accentColor = settings?.primary_color || '#000000';
  const operationMode: OperationMode = useMemo(() => {
    const mode = settings?.operation_mode;
    if (mode === 'return_only' || mode === 'exchange_only') return mode;
    return 'both';
  }, [settings?.operation_mode]);

  useEffect(() => {
    if (operationMode === 'return_only' && requestType !== 'return') {
      setRequestType('return');
    } else if (operationMode === 'exchange_only' && requestType !== 'exchange') {
      setRequestType('exchange');
    }
  }, [operationMode, requestType]);

  useEffect(() => {
    if (step !== 'type') return;
    if (operationMode === 'return_only') setStep('reason');
    else if (operationMode === 'exchange_only') setStep('exchange');
  }, [operationMode, step]);

  const STEPS = operationMode === 'return_only'
    ? ['Sipariş Bul', 'Ürün Seç', 'Sebep Gir']
    : operationMode === 'exchange_only'
      ? ['Sipariş Bul', 'Ürün Seç', 'Değişim Detayı']
      : ['Sipariş Bul', 'Ürün Seç', 'Talep Türü', requestType === 'exchange' ? 'Değişim Detayı' : 'Sebep Gir'];

  const stepIndex = operationMode === 'both'
    ? (step === 'search' ? 0 : step === 'order' ? 1 : step === 'type' ? 2 : (step === 'reason' || step === 'exchange') ? 3 : 4)
    : (step === 'search' ? 0 : step === 'order' ? 1 : (step === 'reason' || step === 'exchange') ? 2 : 3);

  const canSubmitExchange = exchangeType !== null && exchangeVariant.trim().length > 0;
  const orderItems = ((order as Record<string, unknown>)?.items as { name: string; quantity: number; price: number }[]) ?? [];

  const heroTitle = operationMode === 'return_only'
    ? 'İade Merkezi'
    : operationMode === 'exchange_only'
      ? 'Değişim Merkezi'
      : (requestType === 'exchange' && step !== 'type' ? 'Değişim Merkezi' : 'İade & Değişim');

  const brandName = settings?.store_name || 'Mağaza';

  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-8 md:p-10">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white shadow-xl overflow-hidden border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]">

            {/* ── Left panel ─────────────────────────────────────────────── */}
            <div style={{ background: accentColor }} className="hidden lg:block text-white p-8 md:p-10 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-white/10" />
              <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/5" />

              <div className="relative z-10">
                <div className="mb-8 flex items-center gap-3">
                  {settings?.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-12 w-12 rounded-xl bg-white object-contain p-2 border border-white/20" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.3em] text-white/60 uppercase">Müşteri Hizmetleri</div>
                    <div className="text-lg font-bold leading-tight">{brandName}</div>
                  </div>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-none">
                  {heroTitle}
                </h1>
                <p className="mt-4 text-white/70 text-base leading-7">
                  Sipariş bilgilerinizi girin, talebinizi birkaç adımda oluşturun.
                </p>

                {(settings?.support_email || settings?.contact_phone) && (
                  <div className="mt-5 space-y-1 text-sm text-white/60">
                    {settings?.support_email && <p>Destek: {settings.support_email}</p>}
                    {settings?.contact_phone && <p>Telefon: {settings.contact_phone}</p>}
                  </div>
                )}

                {settings?.return_policy && (
                  <div className="mt-5 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/90 border border-white/10">
                    <strong className="block mb-1">İade Politikası</strong>
                    <p className="whitespace-pre-line text-white/80">{settings.return_policy}</p>
                  </div>
                )}

                {settings?.return_instructions && (
                  <div className="mt-3 rounded-2xl bg-white/10 p-4 text-sm leading-6 text-white/90 border border-white/10">
                    <strong className="block mb-1">Nasıl İade Ederim?</strong>
                    <p className="whitespace-pre-line text-white/80">{settings.return_instructions}</p>
                  </div>
                )}

                {step !== 'success' && (
                  <div className="mt-10 space-y-3">
                    {STEPS.map((label, i) => (
                      <div key={label} className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                          i <= stepIndex ? 'bg-white text-black' : 'bg-white/20 text-white/60'
                        }`}>
                          {i < stepIndex ? '✓' : i + 1}
                        </div>
                        <span className={`text-sm font-medium ${i <= stepIndex ? 'text-white' : 'text-white/50'}`}>{label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Right panel ────────────────────────────────────────────── */}
            <div className="p-4 sm:p-7 md:p-10">

              {/* Mobile-only branding header */}
              <div className="lg:hidden mb-6 pb-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {settings?.logo_url && (
                    <img src={settings.logo_url} alt="Logo" className="h-9 w-9 rounded-lg object-contain border border-gray-200 bg-white" />
                  )}
                  <div>
                    <div className="text-[10px] font-bold tracking-[0.25em] text-gray-400 uppercase">Müşteri Hizmetleri</div>
                    <div className="text-sm font-bold leading-tight text-gray-800">{brandName}</div>
                  </div>
                  {settings?.support_email && (
                    <a href={`mailto:${settings.support_email}`} className="ml-auto text-xs text-gray-400 hover:text-gray-600 truncate max-w-[140px]">
                      {settings.support_email}
                    </a>
                  )}
                </div>
              </div>

              {/* STEP: Search */}
              {step === 'search' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Siparişimi Bul</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">
                    İade veya değişim talebi oluşturmak için sipariş numaranızı ve e-posta adresinizi girin.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="orderNo" className="mb-1.5 block text-xs font-medium text-gray-600">Sipariş Numarası</label>
                      <input
                        id="orderNo"
                        value={orderNo}
                        onChange={(e) => setOrderNo(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && findOrder()}
                        placeholder="#1001"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-gray-600">E-posta Adresi</label>
                      <input
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && findOrder()}
                        placeholder="siparis@email.com"
                        type="email"
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                      />
                    </div>
                    <button
                      onClick={findOrder}
                      disabled={isFindingOrder}
                      style={{ background: accentColor }}
                      className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {isFindingOrder ? 'Aranıyor...' : 'Siparişimi Bul'}
                    </button>
                  </div>
                </>
              )}

              {/* STEP: Order (select items) */}
              {step === 'order' && order && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Sipariş Bulundu</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">İşlem yapmak istediğiniz ürünleri seçin.</p>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5 mb-6">
                    <p className="text-xs text-gray-500">Sipariş No</p>
                    <p className="font-bold text-lg mt-0.5">{order.id as string}</p>

                    <div className="mt-5">
                      <p className="text-xs text-gray-500 mb-3">Ürünler</p>
                      <div className="space-y-2">
                        {orderItems.map((item, index) => {
                          const checked = selectedItems.some((x) => x.name === item.name);
                          return (
                            <button
                              key={index}
                              onClick={() => checked
                                ? setSelectedItems(selectedItems.filter((x) => x.name !== item.name))
                                : setSelectedItems([...selectedItems, item])
                              }
                              style={checked ? { borderColor: accentColor, background: accentColor } : {}}
                              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${
                                checked ? 'text-white' : 'border-gray-200 bg-white text-gray-800 hover:border-gray-300'
                              }`}
                            >
                              {checked ? '✓ ' : ''}{item.name} — {item.quantity} adet — ₺{item.price}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-5">
                      <p className="text-xs text-gray-500">Toplam Tutar</p>
                      <p className="font-bold text-lg mt-0.5">{order.amount as string}</p>
                    </div>
                  </div>

                  <button
                    disabled={selectedItems.length === 0}
                    onClick={() => {
                      if (operationMode === 'return_only') { setRequestType('return'); setStep('reason'); }
                      else if (operationMode === 'exchange_only') { setRequestType('exchange'); setStep('exchange'); }
                      else setStep('type');
                    }}
                    style={{ background: accentColor }}
                    className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    Seçili Ürünlerle Devam Et
                  </button>
                </>
              )}

              {/* STEP: Type choice */}
              {step === 'type' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Ne yapmak istersiniz?</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">
                    Seçtiğiniz ürün için iade mi yoksa değişim mi istediğinizi belirtin.
                  </p>

                  <div className="space-y-3 mb-8">
                    <button
                      onClick={() => { setRequestType('return'); setStep('reason'); }}
                      className="w-full flex items-start gap-4 rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-left hover:border-gray-400 transition-colors group"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100 transition-colors">
                        <RotateCcw className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">İade Et</p>
                        <p className="text-sm text-gray-500 mt-0.5">Ürünü iade etmek ve ücret iadesi almak istiyorum.</p>
                      </div>
                    </button>

                    <button
                      onClick={() => { setRequestType('exchange'); setStep('exchange'); }}
                      className="w-full flex items-start gap-4 rounded-2xl border-2 border-gray-200 bg-white px-5 py-4 text-left hover:border-gray-400 transition-colors group"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-100 transition-colors">
                        <ArrowLeftRight className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">Değişim Yap</p>
                        <p className="text-sm text-gray-500 mt-0.5">Ürünü farklı beden, renk veya başka bir ürünle değiştirmek istiyorum.</p>
                      </div>
                    </button>
                  </div>

                  <button onClick={() => setStep('order')} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    ← Geri Dön
                  </button>
                </>
              )}

              {/* STEP: Return reason */}
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
                      rows={3}
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
                      onChange={(e) => {
                        const fl = e.target.files;
                        if (fl) {
                          const oversized = Array.from(fl).find((f) => f.size > 10 * 1024 * 1024);
                          if (oversized) { toast('Dosya boyutu 10 MB sınırını aşıyor', 'error'); e.target.value = ''; return; }
                        }
                        setFiles(fl);
                      }}
                      className="w-full rounded-xl border border-gray-200 p-4 text-sm"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">JPG, PNG, WEBP, MP4, MOV — maks 10 MB.</p>
                  </div>

                  {isSubmitting && totalFilesCount > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <p className="text-xs text-gray-500 text-center">
                        Dosyalar yükleniyor... ({uploadedCount}/{totalFilesCount})
                      </p>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ background: accentColor, width: `${totalFilesCount > 0 ? Math.round((uploadedCount / totalFilesCount) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <button
                    disabled={!reason || isSubmitting}
                    onClick={createRequest}
                    style={{ background: accentColor }}
                    className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    {isSubmitting
                      ? (totalFilesCount > 0 ? 'Video yükleniyor...' : 'Gönderiliyor...')
                      : 'İade Talebi Oluştur'}
                  </button>
                  <button onClick={() => setStep(operationMode === 'both' ? 'type' : 'order')} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    ← Geri Dön
                  </button>
                </>
              )}

              {/* STEP: Exchange detail */}
              {step === 'exchange' && (
                <>
                  <h2 className="text-2xl font-bold tracking-tight">Değişim Detayı</h2>
                  <p className="text-muted-foreground mt-2 mb-7 text-sm">Nasıl bir değişim yapmak istediğinizi belirtin.</p>

                  <div className="space-y-2.5 mb-6">
                    {EXCHANGE_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => { setExchangeType(opt.value); setExchangeVariant(''); }}
                        style={exchangeType === opt.value ? { borderColor: accentColor } : {}}
                        className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-colors ${
                          exchangeType === opt.value
                            ? 'bg-gray-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{opt.description}</p>
                      </button>
                    ))}
                  </div>

                  {exchangeType && (
                    <div className="mb-5">
                      <label className="block mb-1.5 text-xs font-medium text-gray-600">
                        {EXCHANGE_VARIANT_LABEL[exchangeType]} <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={exchangeVariant}
                        onChange={(e) => setExchangeVariant(e.target.value)}
                        placeholder={EXCHANGE_VARIANT_PLACEHOLDER[exchangeType]}
                        className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gray-400 transition-colors"
                      />
                    </div>
                  )}

                  <div className="mb-5">
                    <label htmlFor="exchangeDesc" className="block mb-1.5 text-xs font-medium text-gray-600">
                      Açıklama <span className="text-gray-400">(isteğe bağlı)</span>
                    </label>
                    <textarea
                      id="exchangeDesc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Değişim talebinizi detaylı açıklayın..."
                      className="w-full rounded-xl border border-gray-200 p-4 text-sm outline-none focus:border-gray-400 resize-none transition-colors"
                    />
                  </div>

                  <div className="mb-6">
                    <label htmlFor="exchangeMedia" className="block mb-1.5 text-xs font-medium text-gray-600">
                      Fotoğraf / Video <span className="text-gray-400">(isteğe bağlı)</span>
                    </label>
                    <input
                      id="exchangeMedia"
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const fl = e.target.files;
                        if (fl) {
                          const oversized = Array.from(fl).find((f) => f.size > 10 * 1024 * 1024);
                          if (oversized) { toast('Dosya boyutu 10 MB sınırını aşıyor', 'error'); e.target.value = ''; return; }
                        }
                        setFiles(fl);
                      }}
                      className="w-full rounded-xl border border-gray-200 p-4 text-sm"
                    />
                    <p className="mt-1.5 text-xs text-gray-400">JPG, PNG, WEBP, MP4, MOV — maks 10 MB.</p>
                  </div>

                  {isSubmitting && totalFilesCount > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <p className="text-xs text-gray-500 text-center">
                        Dosyalar yükleniyor... ({uploadedCount}/{totalFilesCount})
                      </p>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ background: accentColor, width: `${totalFilesCount > 0 ? Math.round((uploadedCount / totalFilesCount) * 100) : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <button
                    disabled={!canSubmitExchange || isSubmitting}
                    onClick={createRequest}
                    style={{ background: accentColor }}
                    className="w-full rounded-xl py-3.5 font-bold text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-30"
                  >
                    {isSubmitting
                      ? (totalFilesCount > 0 ? 'Video yükleniyor...' : 'Gönderiliyor...')
                      : 'Değişim Talebi Oluştur'}
                  </button>
                  <button onClick={() => setStep(operationMode === 'both' ? 'type' : 'order')} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 transition-colors">
                    ← Geri Dön
                  </button>
                </>
              )}

              {/* STEP: Success */}
              {step === 'success' && (
                <div className="flex flex-col items-center py-8 text-center">
                  <div
                    style={{ background: accentColor }}
                    className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full text-white"
                  >
                    {requestType === 'exchange'
                      ? <ArrowLeftRight className="h-7 w-7" />
                      : <span className="text-2xl">✓</span>
                    }
                  </div>

                  <h2 className="text-2xl font-bold tracking-tight">
                    {requestType === 'exchange' ? 'Değişim Talebiniz Alındı' : 'İade Talebiniz Alındı'}
                  </h2>
                  <p className="text-gray-500 mt-3 text-sm leading-6 max-w-xs">
                    Talebiniz mağazaya iletildi. İnceleme sonrası size e-posta ile bilgi verilecektir.
                  </p>

                  <div className="mt-8 w-full rounded-2xl bg-gray-50 border border-gray-100 p-5 text-left">
                    <p className="text-xs text-gray-500">Talep No</p>
                    <p className="text-2xl font-bold font-mono mt-0.5">{createdRfNumber}</p>
                    <a
                      href={`/track/${storeKey}`}
                      style={{ background: accentColor }}
                      className="mt-4 inline-flex rounded-xl px-5 py-2.5 text-sm font-bold text-white hover:opacity-90 transition-opacity"
                    >
                      Takibime Git
                    </a>

                    {settings?.return_address && requestType === 'return' && (
                      <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <p className="text-xs font-semibold text-blue-700 mb-1">İade Adresi</p>
                        <p className="text-sm text-blue-900 whitespace-pre-line leading-relaxed">{settings.return_address}</p>
                      </div>
                    )}

                    <div className="mt-5 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Durum</p>
                        <p className="font-semibold text-sm mt-0.5">İncelemede</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Talep Türü</p>
                        <p className="font-semibold text-sm mt-0.5">{requestType === 'exchange' ? 'Değişim' : 'İade'}</p>
                      </div>
                      {requestType === 'exchange' && exchangeType && (
                        <>
                          <div>
                            <p className="text-xs text-gray-500">Değişim Türü</p>
                            <p className="font-semibold text-sm mt-0.5">{EXCHANGE_TYPE_LABELS[exchangeType]}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">İstenen</p>
                            <p className="font-semibold text-sm mt-0.5 truncate">{exchangeVariant}</p>
                          </div>
                        </>
                      )}
                      {requestType === 'return' && (
                        <div>
                          <p className="text-xs text-gray-500">Sebep</p>
                          <p className="font-semibold text-sm mt-0.5">{reason}</p>
                        </div>
                      )}
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
