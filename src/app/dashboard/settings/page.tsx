'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/components/ui/toast';
import { Upload } from 'lucide-react';

export default function SettingsPage() {
  const { authHeader: token } = useAuth();
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
  const [contactPhone, setContactPhone] = useState('');
  const [returnInstructions, setReturnInstructions] = useState('');
  const [returnDeadlineDays, setReturnDeadlineDays] = useState('');
  const [returnPolicy, setReturnPolicy] = useState('');
  const [operationMode, setOperationMode] = useState<'both' | 'return_only' | 'exchange_only'>('both');

  const loadSettings = useCallback(async (t: string) => {
    try {
      const res = await fetch('/api/settings', { headers: { Authorization: t } });
      const result = await res.json();
      if (result.data) {
        const d = result.data;
        setMerchantId(d.merchant_id || '');
        setStoreName(d.store_name || '');
        setNotificationEmail(d.notification_email || '');
        setSupportEmail(d.support_email || '');
        setLogoUrl(d.logo_url || '');
        setPrimaryColor(d.primary_color || '#000000');
        setReturnAddress(d.return_address || '');
        setContactPhone(d.contact_phone || '');
        setReturnInstructions(d.return_instructions || '');
        setReturnDeadlineDays(d.return_deadline_days != null ? String(d.return_deadline_days) : '');
        setReturnPolicy(d.return_policy || '');
        const mode = d.operation_mode;
        setOperationMode(mode === 'return_only' || mode === 'exchange_only' ? mode : 'both');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { AppBridgeHelper.closeLoader(); }, []);
  useEffect(() => {
    if (token) loadSettings(token);
    else setLoading(false);
  }, [token, loadSettings]);

  const saveSettings = async () => {
    const t = token;
    if (!t) {
      toast('Oturum bilgisi alınamadı. Sayfayı yenileyip tekrar deneyin.', 'error');
      return;
    }

    setSaving(true);

    let uploadedLogo = logoUrl;

    if (logoFile) {
      const fileName = `${merchantId || Date.now()}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage.from('store-assets').upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        console.error('Logo yüklenemedi:', uploadError);
        toast(`Logo yüklenemedi: ${uploadError.message}`, 'error');
        setSaving(false);
        return;
      }

      uploadedLogo = supabase.storage.from('store-assets').getPublicUrl(fileName).data.publicUrl;
    }

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: t },
      body: JSON.stringify({
        store_name: storeName,
        notification_email: notificationEmail,
        support_email: supportEmail,
        logo_url: uploadedLogo,
        primary_color: primaryColor,
        return_address: returnAddress,
        contact_phone: contactPhone,
        return_instructions: returnInstructions,
        return_deadline_days: returnDeadlineDays ? Number(returnDeadlineDays) : null,
        return_policy: returnPolicy,
        operation_mode: operationMode,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      toast('Ayarlar kaydedilemedi', 'error');
      return;
    }

    toast('Ayarlar kaydedildi', 'success');
  };

  return (
    <DashboardShell storeName={storeName || undefined} logoUrl={logoUrl || undefined}>
      <div className="p-6 md:p-8 max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Mağaza bilgileri ve iade politikasını buradan yönetin.</p>

        {loading ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-8">
            {/* Mağaza Bilgileri */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-4">Mağaza Bilgileri</h2>
              <div className="space-y-3">
                <div>
                  <label htmlFor="storeName" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Mağaza Adı
                  </label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Mağazanızın adını girin"
                  />
                </div>
                <div>
                  <label htmlFor="notificationEmail" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Bildirim E-postası
                  </label>
                  <Input
                    id="notificationEmail"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="Bildirimler bu adrese gönderilecek"
                    type="email"
                  />
                </div>
                <div>
                  <label htmlFor="supportEmail" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Destek E-postası
                  </label>
                  <Input
                    id="supportEmail"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="Müşterilere gösterilecek destek adresi"
                    type="email"
                  />
                </div>
              </div>
            </section>

            {/* Görünüm */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-4">Görünüm</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Mağaza Logosu</label>
                  <div className="flex items-center gap-4">
                    {(logoFile || logoUrl) && (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : logoUrl}
                        alt="Logo"
                        className="h-14 w-14 rounded-xl border border-border object-contain bg-white"
                      />
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      Logo Yükle
                      <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label htmlFor="primaryColor" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Ana Tema Rengi
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="primaryColor"
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-16 cursor-pointer rounded-lg border border-border"
                    />
                    <span className="font-mono text-xs text-muted-foreground">{primaryColor}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* İade Ayarları */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-4">İade Ayarları</h2>
              <div className="space-y-3">
                <div>
                  <label htmlFor="returnAddress" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    İade Adresi
                  </label>
                  <Textarea
                    id="returnAddress"
                    value={returnAddress}
                    onChange={(e) => setReturnAddress(e.target.value)}
                    placeholder="Müşterilerin ürünleri gönderecekleri adres"
                    rows={3}
                  />
                </div>
                <div>
                  <label htmlFor="contactPhone" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Müşteri İletişim Telefonu
                  </label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+90 212 000 00 00"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Onay e-postasında gösterilecek iletişim numarası</p>
                </div>
                <div>
                  <label htmlFor="returnInstructions" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    İade Adımları
                  </label>
                  <Textarea
                    id="returnInstructions"
                    value={returnInstructions}
                    onChange={(e) => setReturnInstructions(e.target.value)}
                    placeholder={`1. Ürünü orijinal ambalajında paketleyin\n2. Referans numaranızı paketin üzerine yazın\n3. Belirtilen adrese kargolayın`}
                    rows={5}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Onay e-postasına eklenecek adım adım talimatlar</p>
                </div>
                <div>
                  <label htmlFor="returnDeadlineDays" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    İade Süresi (Gün)
                  </label>
                  <div className="flex items-center gap-3">
                    <Input
                      id="returnDeadlineDays"
                      type="number"
                      min="1"
                      max="90"
                      value={returnDeadlineDays}
                      onChange={(e) => setReturnDeadlineDays(e.target.value)}
                      placeholder="14"
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">gün içinde kargoya verilmeli</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Boş bırakılırsa son tarih gösterilmez</p>
                </div>
                <div>
                  <label htmlFor="returnPolicy" className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    İade Politikası
                  </label>
                  <Textarea
                    id="returnPolicy"
                    value={returnPolicy}
                    onChange={(e) => setReturnPolicy(e.target.value)}
                    placeholder="İade koşulları ve politikanızı buraya yazın"
                    rows={6}
                  />
                </div>
              </div>
            </section>

            {/* Çalışma Modu */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-4">Çalışma Modu</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Mağazanızın hangi tür talepleri kabul edeceğini seçin. Müşteri portalı bu ayara göre uyum sağlar.
              </p>
              <div className="space-y-2">
                {([
                  {
                    value: 'both',
                    title: 'İade ve Değişim (Varsayılan)',
                    description: 'Müşteriler hem iade hem de değişim talebi oluşturabilir.',
                  },
                  {
                    value: 'return_only',
                    title: 'Sadece İade',
                    description: 'Yalnızca iade talebi kabul edilir. Portalda değişim seçeneği görünmez.',
                  },
                  {
                    value: 'exchange_only',
                    title: 'Sadece Değişim',
                    description: 'Yalnızca değişim talebi kabul edilir. Portalda iade seçeneği görünmez.',
                  },
                ] as const).map((opt) => {
                  const isSelected = operationMode === opt.value;
                  return (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'
                      }`}
                    >
                      <input
                        type="radio"
                        name="operationMode"
                        value={opt.value}
                        checked={isSelected}
                        onChange={() => setOperationMode(opt.value)}
                        className="mt-1 shrink-0"
                        style={{ accentColor: '#6f55ff' }}
                      />
                      <div>
                        <p className="text-sm font-semibold">{opt.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </section>

            <Button onClick={saveSettings} disabled={saving} className="w-full">
              {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
