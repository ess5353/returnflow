'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TokenHelpers } from '@/helpers/token-helpers';

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


const createReturnRequest = async () => {
  setIsSubmitting(true);
  console.log('DESCRIPTION:', description);
  let uploadedUrls: string[] = [];

  if (files) {
    for (const file of Array.from(files)) {
      const extension = file.name.split('.').pop();

const fileName = `${Date.now()}-${Math.random()
  .toString(36)
  .substring(2)}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('return-files')
        .upload(fileName, file);
        console.log('UPLOAD ERROR:', uploadError);

      if (uploadError) {
        console.error(uploadError);
        setIsSubmitting(false);
        alert('Dosya yüklenemedi');
        return;
      }

      const { data } = supabase.storage
        .from('return-files')
        .getPublicUrl(fileName);

      uploadedUrls.push(data.publicUrl);
    }
  }
console.log('ORDER DATA:', order);
const now = new Date();

const datePart = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(
  now.getDate()
).padStart(2, '0')}`;

const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

const { count, error: countError } = await supabase
  .from('return_requests')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', startOfDay);

if (countError) {
  console.error(countError);
  setIsSubmitting(false);
  alert('RF numarası oluşturulamadı');
  return;
}

const sequence = String((count || 0) + 1).padStart(4, '0');
const rfNumber = `RF-${datePart}-${sequence}`;
  const { error } = await supabase
    .from('return_requests')
    .insert([
      {
        rf_number: rfNumber,
        order_id: order.order_no,
        customer_name: order.customer_name,
        customer_email: email,
product: selectedItems.map((item) => item.name).join(', '),        reason,
        description,
        amount: String(
  selectedItems.reduce((total, item) => total + Number(item.price || 0), 0)
),
        status: 'Yeni Talep',
        media_urls: uploadedUrls,
      },
    ]);

  if (error) {
    console.error(error);
    setIsSubmitting(false);
    alert('Kayıt sırasında hata oluştu');
    return;
  }
  setCreatedRfNumber(rfNumber);
setIsSubmitting(false);
  setStep('success');
};

const findOrder = async () => {
  const existingRequest = await supabase
  .from('return_requests')
  .select('id')
  .eq('order_id', orderNo);

if (
  existingRequest.data &&
  existingRequest.data.length > 0
) {
  alert('Bu sipariş için zaten iade talebi oluşturulmuş.');
  return;
}
  console.log('Aranan:', orderNo);

 const token = await TokenHelpers.getTokenForIframeApp();

console.log("ORDER NO STATE:", orderNo);
console.log("EMAIL STATE:", email);

console.log(
  "URL:",
`/api/ikas/order?orderNo=${encodeURIComponent(orderNo)}&email=${encodeURIComponent(email)}`);

const response = await fetch(
  `/api/ikas/order?orderNo=${encodeURIComponent(orderNo)}`,
  {
    headers: {
      Authorization: `JWT ${token}`,
    },
  }
);
const result = await response.json();

console.log(result);
if (!result.success) {
  alert('Sipariş bulunamadı');
  return;
}

setOrder(result.order);
setStep('order');
  
};
  

  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-8 md:p-10 text-[#111]">
      <section className="mx-auto max-w-5xl">
        <div className="rounded-[32px] md:rounded-[44px] bg-white shadow-2xl overflow-hidden border border-gray-100">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            <div className="bg-black text-white p-8 md:p-12 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br from-blue-300 to-indigo-500 opacity-40" />

              <div className="relative z-10">
                <div className="inline-flex rounded-full bg-white/10 px-4 py-2 text-xs font-bold tracking-widest mb-8">
                  PELYXCOMMERCE
                </div>

                <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.07em] leading-none">
                  İade Merkezi
                </h1>

                <p className="text-white/60 mt-5 text-lg leading-8">
                  Sipariş bilgilerinizi girin, iade talebinizi birkaç adımda oluşturun.
                </p>

                <div className="mt-10 space-y-4">
                  {['Siparişinizi bulun', 'İade sebebinizi seçin', 'Talebinizi mağazaya iletin'].map(
                    (item, index) => (
                      <div key={item} className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold">
                          {index + 1}
                        </div>
                        <span className="text-white/80">{item}</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-12">
              {step === 'search' && (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.05em]">
                    Siparişimi Bul
                  </h2>
                  <p className="text-gray-500 mt-3 mb-8">
                    İade talebi oluşturmak için sipariş numaranızı ve telefon/e-posta bilginizi girin.
                  </p>

                  <div className="space-y-5">
                    <input
  value={orderNo}
  onChange={(e) => setOrderNo(e.target.value)}
  placeholder="Sipariş numarası — örn: #1001"
  className="w-full rounded-2xl border border-gray-200 px-5 py-4 outline-none focus:border-black"
/>
                   <input
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="E-posta adresiniz"
  className="w-full rounded-2xl border border-gray-200 px-5 py-4 outline-none focus:border-black"
/>
                    <button
                      onClick={findOrder}
                      className="w-full rounded-2xl bg-black text-white py-5 font-extrabold shadow-lg"
                    >
                      Siparişimi Bul
                    </button>
                  </div>
                </>
              )}

              {step === 'order' && (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.05em]">
                    Sipariş Bulundu
                  </h2>
                  <p className="text-gray-500 mt-3 mb-8">
                    İade etmek istediğiniz ürünü kontrol edin.
                  </p>

                  <div className="rounded-3xl border border-gray-100 bg-gray-50 p-6 mb-6">
                    <p className="text-gray-500 text-sm">Sipariş</p>
                    <h3 className="text-2xl font-bold">{order.id}</h3>

                    <div className="mt-5">
  <p className="text-gray-500 text-sm mb-3">İade edilecek ürünler</p>

  <div className="space-y-3">
    {order.items?.map((item: any, index: number) => {
      const checked = selectedItems.some((x) => x.name === item.name);

      return (
        <button
          key={index}
          onClick={() => {
            if (checked) {
              setSelectedItems(selectedItems.filter((x) => x.name !== item.name));
            } else {
              setSelectedItems([...selectedItems, item]);
            }
          }}
          className={`w-full rounded-2xl border px-4 py-4 text-left font-bold ${
            checked ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-black'
          }`}
        >
          {checked ? '✓ ' : ''}{item.name} — {item.quantity} adet — ₺{item.price}
        </button>
      );
    })}
  </div>
</div>

                    <div className="mt-5">
                      <p className="text-gray-500 text-sm">Tutar</p>
                      <h3 className="text-xl font-bold">{order.amount}</h3>
                    </div>
                  </div>

                  <button
  disabled={selectedItems.length === 0}
  onClick={() => setStep('reason')}
  className="w-full rounded-2xl bg-black text-white py-5 font-extrabold shadow-lg disabled:opacity-30"
>
  Seçili Ürünlerle Devam Et
</button>
                </>
              )}

              {step === 'reason' && (
                <>
                  <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.05em]">
                    İade Sebebi
                  </h2>
                  <p className="text-gray-500 mt-3 mb-8">
                    Mağazanın talebinizi daha hızlı incelemesi için sebep seçin.
                  </p>

                  <div className="space-y-3 mb-6">
                    {['Küçük geldi', 'Büyük geldi', 'Hasarlı geldi', 'Yanlış ürün geldi', 'Diğer'].map(
                      (item) => (
                        <button
                          key={item}
                          onClick={() => setReason(item)}
                          className={`w-full text-left rounded-2xl border px-5 py-4 font-bold ${
                            reason === item
                              ? 'border-black bg-black text-white'
                              : 'border-gray-200 bg-white text-black'
                          }`}
                        >
                          {item}
                        </button>
                      )
                    )}
                  </div>
<div className="mb-6">
  <label className="block mb-3 font-bold">
    <div className="mb-6">
  <label className="block mb-3 font-bold">
    Açıklama
  </label>

  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    rows={4}
    placeholder="İade sebebini detaylı açıklayın..."
    className="w-full rounded-2xl border border-gray-200 p-4"
  />
</div>
    Fotoğraf / Video Yükle
  </label>

  <input
    type="file"
    multiple
    accept="image/*,video/*"
    onChange={(e) => setFiles(e.target.files)}
    className="w-full rounded-2xl border border-gray-200 p-4"
  />

  <p className="mt-2 text-sm text-gray-500">
    JPG, PNG, WEBP, MP4, MOV desteklenir.
  </p>
</div>
                  <button
  disabled={!reason || isSubmitting}
  onClick={createReturnRequest}
  className="w-full rounded-2xl bg-black text-white py-5 font-extrabold shadow-lg disabled:opacity-30"
>
  {isSubmitting
    ? 'Dosyalar yükleniyor...'
    : 'İade Talebi Oluştur'}
</button>
                </>
              )}

              {step === 'success' && (
                <div className="text-center py-10">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-black text-white text-3xl">
                    ✓
                  </div>

                  <h2 className="text-3xl md:text-4xl font-bold tracking-[-0.05em]">
                    Talebiniz Alındı
                  </h2>

                  <p className="text-gray-500 mt-4 leading-7">
                    İade talebiniz mağazaya iletildi. İnceleme sonrası size bilgi verilecektir.
                  </p>

                  <div className="mt-8 rounded-3xl bg-gray-50 border border-gray-100 p-5 text-left">
                    <p className="text-gray-500 text-sm">Talep No</p>
                    <h3 className="text-2xl font-bold">{createdRfNumber}</h3>

                    <p className="text-gray-500 text-sm mt-5">Durum</p>
                    <h3 className="text-xl font-bold">İncelemede</h3>

                    <p className="text-gray-500 text-sm mt-5">Sebep</p>
                    <h3 className="text-xl font-bold">{reason}</h3>
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