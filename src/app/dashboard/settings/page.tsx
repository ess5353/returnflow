'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { TokenHelpers } from '@/helpers/token-helpers';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
const [logoFile, setLogoFile] = useState<File | null>(null);
  const [merchantId, setMerchantId] = useState('');
  const [storeName, setStoreName] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [returnAddress, setReturnAddress] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');

  const getMerchantId = async () => {
    const token = await TokenHelpers.getTokenForIframeApp();

    const response = await fetch('/api/ikas/get-merchant', {
      headers: {
        Authorization: `JWT ${token}`,
      },
    });

    const result = await response.json();

    const id = result?.data?.merchantInfo?.id;

    if (!id) {
      console.error('MERCHANT RESULT:', result);
      return '';
    }

    return id;
  };

  const loadSettings = async () => {
    try {
      const id = await getMerchantId();

      if (!id) {
        setLoading(false);
        return;
      }

      setMerchantId(id);

      const { data } = await supabase
        .from('store_settings')
        .select('*')
        .eq('merchant_id', id)
        .maybeSingle();

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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);

    const id = merchantId || (await getMerchantId());

    if (!id) {
      setSaving(false);
      alert('Mağaza bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin.');
      return;
    }
let uploadedLogo = logoUrl;

if (logoFile) {
  const fileName = `${merchantId}-${Date.now()}`;

  const { error: uploadError } = await supabase.storage
    .from('store-assets')
    .upload(fileName, logoFile, {
      upsert: true,
    });

  if (uploadError) {
    alert('Logo yüklenemedi');
    return;
  }

  const { data } = supabase.storage
    .from('store-assets')
    .getPublicUrl(fileName);

  uploadedLogo = data.publicUrl;
}
    const { error } = await supabase
      .from('store_settings')
      
      .upsert(
        {
          merchant_id: id,
          store_name: storeName,
          notification_email: notificationEmail,
          support_email: supportEmail,
          logo_url: uploadedLogo,
          primary_color: primaryColor,
          return_address: returnAddress,
          return_policy: returnPolicy,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'merchant_id',
        }
      );

    setSaving(false);

    if (error) {
      console.error(error);
      alert(JSON.stringify(error, null, 2));
      return;
    }

    setMerchantId(id);
    alert('Ayarlar kaydedildi.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f5f7] p-8">
        <p>Ayarlar yükleniyor...</p>
      </main>
    );
  }

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

          <div>
  <label className="mb-2 block font-semibold">
    Mağaza Logosu
  </label>

  <input
    type="file"
    accept="image/*"
    onChange={(e) =>
      setLogoFile(e.target.files?.[0] || null)
    }
    className="w-full rounded-2xl border p-4"
  />
  {(logoFile || logoUrl) && (
  <div className="mt-4">
    <img
      src={
        logoFile
          ? URL.createObjectURL(logoFile)
          : logoUrl
      }
      alt="Logo"
      className="h-24 w-24 rounded-2xl border object-contain bg-white"
    />
  </div>
)}
</div>

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
            disabled={saving}
            className="w-full rounded-2xl bg-black py-4 font-bold text-white disabled:opacity-50"
          >
            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
        </div>
      </div>
    </main>
  );
}