'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TokenHelpers } from '@/helpers/token-helpers';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
const [merchantId, setMerchantId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [returnAddress, setReturnAddress] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');

  useEffect(() => {const loadSettings = async () => {
  try {
    const token = await TokenHelpers.getTokenForIframeApp();

const response = await fetch('/api/ikas/get-merchant', {      headers: {
        Authorization: `JWT ${token}`,
      },
    });

    const result = await response.json();

    console.log('GET MERCHANT RESULT:', result);
console.log('MERCHANT:', result.merchant);

    if (!result.success) return;

setMerchantId(result.data.merchantInfo.id);
    const { data } = await supabase
      .from('store_settings')
      .select('*')
      .eq('merchant_id', result.data.merchantInfo.id)
      .single();

    if (data) {
      setStoreName(data.store_name || '');
      setNotificationEmail(data.notification_email || '');
      setSupportEmail(data.support_email || '');
      setLogoUrl(data.logo_url || '');
      setPrimaryColor(data.primary_color || '#000000');
      setReturnAddress(data.return_address || '');
      setReturnPolicy(data.return_policy || '');
    }

    setLoading(false);
  } catch (e) {
    console.error(e);
  }
};
  loadSettings();
}, []);

const saveSettings = async () => {
  if (!merchantId) {
    alert('Mağaza bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin.');
    return;
  }

  const { error } = await supabase
    .from('store_settings')
    .upsert(
      {
        merchant_id: merchantId,
        store_name: storeName,
        notification_email: notificationEmail,
        support_email: supportEmail,
        logo_url: logoUrl,
        primary_color: primaryColor,
        return_address: returnAddress,
        return_policy: returnPolicy,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'merchant_id',
      }
    );

  if (error) {
    console.error(error);
    alert(JSON.stringify(error, null, 2));
    return;
  }

  alert('Ayarlar kaydedildi.');
};

  return (
    <main className="min-h-screen bg-[#f4f5f7] p-8">
      <div className="mx-auto max-w-4xl">

        <h1 className="text-4xl font-bold tracking-[-0.05em]">
          Ayarlar
        </h1>

        <p className="mt-2 mb-8 text-gray-500">
          Mağaza ayarlarınızı buradan yönetin.
        </p>

        <div className="space-y-6">

          <input
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Mağaza Adı"
            className="w-full rounded-2xl border p-4"
          />

          <input
            value={notificationEmail}
            onChange={(e) => setNotificationEmail(e.target.value)}
            placeholder="Bildirim E-postası"
            className="w-full rounded-2xl border p-4"
          />

          <input
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
            placeholder="Destek E-postası"
            className="w-full rounded-2xl border p-4"
          />

          <input
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="Logo URL"
            className="w-full rounded-2xl border p-4"
          />

          <div>
            <label className="mb-2 block font-semibold">
              Ana Tema Rengi
            </label>

            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-14 w-24 cursor-pointer"
            />
          </div>

          <textarea
            value={returnAddress}
            onChange={(e) => setReturnAddress(e.target.value)}
            placeholder="İade Adresi"
            rows={3}
            className="w-full rounded-2xl border p-4"
          />

          <textarea
            value={returnPolicy}
            onChange={(e) => setReturnPolicy(e.target.value)}
            placeholder="İade Politikası"
            rows={6}
            className="w-full rounded-2xl border p-4"
          />

          <button
  onClick={saveSettings}
  className="w-full rounded-2xl bg-black py-4 font-bold text-white"
>
  Ayarları Kaydet
</button>

        </div>

      </div>
    </main>
  );
}