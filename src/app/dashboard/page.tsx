'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type ReturnRequest = {
  id: string;
  order_id: string;
  customer_name: string;
  product: string;
  reason: string;
  description: string | null;
  admin_note: string | null;
  amount: string;
  status: string;
  created_at: string;
  media_urls: string [] | null;
};

export default function DashboardPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('Tümü');
  const [search, setSearch] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('return_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      alert('İade talepleri alınamadı');
      return;
    }

    setRequests(data || []);
    setSelectedRequest((current) => current ?? data?.[0] ?? null);
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const updateStatus = async (status: string) => {
  if (!selectedRequest) return;

  const { error } = await supabase
    .from('return_requests')
    .update({ status })
    .eq('id', selectedRequest.id);

  if (error) {
    console.error(error);
    alert('Durum güncellenemedi');
    return;
  }

  await fetchRequests();

  setSelectedRequest({
    ...selectedRequest,
    status,
  });
};

const filteredRequests = requests.filter((r) => {
  const matchesFilter =
    filter === 'Tümü' || r.status === filter;

  const matchesSearch =
  (r.customer_name || '')
    .toLowerCase()
    .includes(search.toLowerCase()) ||
  (r.order_id || '')
    .toLowerCase()
    .includes(search.toLowerCase());

  return matchesFilter && matchesSearch;
});
  const selected = selectedRequest;

const reasonCounts = requests.reduce((acc: any, item) => {
  acc[item.reason] = (acc[item.reason] || 0) + 1;
  return acc;
}, {});

const topReason =
  Object.entries(reasonCounts).sort(
    (a: any, b: any) => b[1] - a[1]
  )[0];

  const reasonStats = Object.entries(reasonCounts)
  .sort((a: any, b: any) => b[1] - a[1])
  .slice(0, 5);




  return (
    <main className="min-h-screen bg-[#f4f5f7] p-4 md:p-8 text-[#111]">
      <section className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-5">
          <div>
            <div className="mb-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-bold tracking-[0.24em] text-white">
              PELYXCOMMERCE
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-[-0.07em]">
              ReturnFlow
            </h1>

            <p className="mt-3 max-w-xl text-gray-500 text-base md:text-lg">
              İade taleplerini tek panelden yönet, onayla ve süreci müşteriye daha profesyonel yaşat.
            </p>
          </div>

          <button
            onClick={fetchRequests}
            className="rounded-2xl bg-black px-6 py-4 font-bold text-white shadow-xl"
          >
            Yenile
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-5">
          <div className="space-y-5">
            <div className="rounded-[32px] bg-black p-6 md:p-8 text-white shadow-2xl">
              <p className="text-white/50 font-semibold">İade Portal Linki</p>

              <h2 className="mt-3 text-2xl md:text-3xl font-bold tracking-[-0.05em]">
                Bu linki mağazanızdaki “İade & Değişim” alanına ekleyin.
              </h2>

              <div className="mt-6 flex flex-col md:flex-row gap-3 rounded-2xl bg-white/10 p-4 border border-white/10">
                <span className="flex-1 break-all text-white/80">
                  https://returnflow.pelyxcommerce.com/pelyxcommerce
                </span>

                <button className="rounded-xl bg-white px-5 py-3 font-extrabold text-black">
                  Kopyala
                </button>
              </div>
            </div>

<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">              <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
                <p className="text-gray-500 font-semibold">Toplam İade</p>
                <h3 className="mt-3 text-4xl font-bold tracking-[-0.06em]">
                  {requests.length}
                </h3>
              </div>

              <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
                <p className="text-gray-500 font-semibold">Yeni Talep</p>
                <h3 className="mt-3 text-4xl font-bold tracking-[-0.06em]">
                  {requests.filter((r) => r.status === 'Yeni Talep').length}
                </h3>
              </div>

        <div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
  <p className="text-gray-500 font-semibold">Onaylanan</p>

  <h3 className="mt-3 text-4xl font-bold tracking-[-0.06em]">
    {requests.filter((r) => r.status === 'Onaylandı').length}
  </h3>
</div>

<div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
  <p className="text-gray-500 font-semibold">Reddedilen</p>



  <h3 className="mt-3 text-4xl font-bold tracking-[-0.06em]">
    {requests.filter((r) => r.status === 'Reddedildi').length}
  </h3>
</div>

<div className="rounded-[28px] bg-white p-6 shadow-sm border border-gray-100">
  <p className="text-gray-500 font-semibold">
    En Çok İade Sebebi
  </p>

  <h3 className="mt-3 text-xl font-bold">
    {topReason ? topReason[0] : '-'}
  </h3>

  <p className="mt-2 text-sm text-gray-500">
    {topReason ? `${topReason[1]} kez` : ''}
  </p>
</div>
            </div>

<div className="rounded-[32px] bg-white p-5 md:p-7 shadow-sm border border-gray-100">
  <h2 className="text-2xl font-bold tracking-[-0.04em]">
    İade Sebebi Analizi
  </h2>

  <p className="mt-1 text-gray-500">
    En çok gelen iade sebeplerini gör.
  </p>

  <div className="mt-6 space-y-4">
    {reasonStats.map(([reason, count]: any) => (
      <div key={reason}>
        <div className="mb-2 flex justify-between text-sm font-bold">
          <span>{reason}</span>
          <span>{count} kez</span>
        </div>

        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-black"
            style={{
              width: `${Math.min((Number(count) / requests.length) * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    ))}
  </div>
</div>



            <div className="rounded-[32px] bg-white p-5 md:p-7 shadow-sm border border-gray-100">
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.05em]">
                  İade Talepleri
                </h2>
                <p className="mt-1 text-gray-500">
                  Müşterilerden gelen gerçek iade kayıtları.
                </p>

<div className="mt-4 flex flex-wrap gap-2">
  <div className="mt-4">
  <input
    type="text"
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    placeholder="Sipariş no veya müşteri ara..."
    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-black"
  />
</div>
  {['Tümü', 'Yeni Talep', 'Onaylandı', 'Reddedildi'].map((item) => (
    <button
      key={item}
      onClick={() => setFilter(item)}
      className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
        filter === item
          ? 'bg-black text-white'
          : 'bg-gray-100 text-black'
      }`}
    >
      {item}
    </button>
  ))}
</div>


              </div>

              {loading && <p className="text-gray-500">Yükleniyor...</p>}

              {!loading && requests.length === 0 && (
                <p className="text-gray-500">Henüz iade talebi yok.</p>
              )}

              <div className="space-y-3">
                {filteredRequests.map((request) => {
                  const isSelected = selected?.id === request.id;

                  return (
                    <div
                      key={request.id}
                      className={`grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_auto] gap-4 rounded-3xl border p-5 md:items-center transition ${
                        isSelected
                          ? 'border-black bg-white shadow-md'
                          : 'border-gray-100 bg-[#fafafa]'
                      }`}
                    >
                      <div>
                        <div className="flex flex-wrap gap-2 items-center">
                          <strong>RF-{request.id.slice(0, 4).toUpperCase()}</strong>
                          <span className={`rounded-full px-3 py-1 text-xs font-bold ${

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
                        <p className="mt-2 text-gray-500">
                          {request.order_id} — {request.customer_name}
                        </p>
                        <p className="mt-1 font-semibold">{request.product}</p>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400">Sebep</p>
                        <strong>{request.reason}</strong>
                      </div>

                      <div>
                        <p className="text-sm text-gray-400">Tutar</p>
                        <strong>{request.amount}</strong>
                      </div>

                      <button
                       onClick={() => {
  setSelectedRequest(request);
  setAdminNote(request.admin_note || '');
}}
                        className="rounded-2xl bg-black px-5 py-3 font-bold text-white"
                      >
                        İncele
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <aside className="rounded-[32px] bg-white p-6 md:p-8 shadow-sm border border-gray-100 h-fit lg:sticky lg:top-8">
            <p className="text-gray-500 font-semibold">Seçili İade Talebi</p>

            {!selected ? (
              <p className="mt-4 text-gray-500">Henüz talep yok.</p>
            ) : (
              <>
                <h2 className="mt-3 text-3xl font-bold tracking-[-0.05em]">
                  RF-{selected.id.slice(0, 4).toUpperCase()}
                </h2>

                <div className="mt-6 space-y-5">
                  <div>
                    <p className="text-sm text-gray-400">Sipariş</p>
                    <strong>{selected.order_id}</strong>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Müşteri</p>
                    <strong>{selected.customer_name}</strong>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Ürün</p>
                    <strong>{selected.product}</strong>
                  </div>

                <div>
  <p className="text-sm text-gray-400">İade Sebebi</p>
  <strong>{selected.reason}</strong>
</div>

{selected.description && (
  <div>
    <p className="text-sm text-gray-400">Açıklama</p>

    <div className="mt-2 rounded-2xl bg-[#f4f5f7] p-4 text-sm leading-6">
      {selected.description}
    </div>
  </div>
)}

                  <div>
                    <p className="text-sm text-gray-400">Tutar</p>
                    <strong>{selected.amount}</strong>
                  </div>

                  <div>
                    <p className="text-sm text-gray-400">Durum</p>
                    <strong>{selected.status}</strong>
                  </div>
{selected.media_urls && selected.media_urls.length > 0 && (
  <div>
    <p className="text-sm text-gray-400 mb-3">Kanıt Dosyaları</p>

    <div className="grid grid-cols-2 gap-3">
      {selected.media_urls.map((url, index) => {
        const isVideo =
          url.includes('.mp4') ||
          url.includes('.mov') ||
          url.includes('.webm');

        return isVideo ? (
          <video
            key={index}
            controls
            className="w-full rounded-2xl border"
          >
            <source src={url} />
          </video>
        ) : (
          <img
            key={index}
            src={url}
            alt="Return media"
            className="w-full rounded-2xl border"
          />
        );
      })}
    </div>
  </div>
)}
                  <div className="rounded-3xl bg-[#f4f5f7] p-5">
                    <p className="text-sm text-gray-500">
                      Bu alanda mağaza sahibi seçilen iade talebini inceleyip onay/red işlemi yapacak.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
<div>
  <p className="text-sm text-gray-400 mb-2">
    Mağaza Notu
  </p>

  <textarea
    value={adminNote}
    onChange={(e) => setAdminNote(e.target.value)}
    rows={4}
    className="w-full rounded-2xl border border-gray-200 p-4"
    placeholder="İade ile ilgili not bırak..."
  />
</div>

<button
  onClick={async () => {
    if (!selected) return;

    await supabase
      .from('return_requests')
      .update({
        admin_note: adminNote,
      })
      .eq('id', selected.id);

    await fetchRequests();
  }}
  className="rounded-2xl border border-gray-200 py-3 font-bold"
>
  Notu Kaydet
</button>

                  <button
  onClick={() => updateStatus('Onaylandı')}
  className="rounded-2xl bg-black py-4 font-bold text-white"
>
  Talebi Onayla
</button>

                    

                    <button
  onClick={() => updateStatus('Reddedildi')}
  className="rounded-2xl border border-gray-200 py-4 font-bold"
>
  Talebi Reddet
</button>
<button
  onClick={async () => {
    if (!selected) return;

    console.log('SELECTED:', selected);
    console.log('SELECTED ID:', selected.id);

    const kontrol = await supabase
      .from('return_requests')
      .select('*')
      .eq('id', selected.id);

    console.log('KONTROL:', kontrol.data);

    const { data, error } = await supabase
      .from('return_requests')
      .delete()
      .eq('id', selected.id)
      .select();

    console.log('SILINEN:', data);
    console.log('ERROR:', error);

    await fetchRequests();

    setSelectedRequest(null);
  }}
  className="rounded-2xl bg-red-500 py-4 font-bold text-white"
>
  Talebi Sil
</button>                </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}