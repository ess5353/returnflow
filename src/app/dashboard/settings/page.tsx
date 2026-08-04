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
import { PageHelp } from '@/components/ui/page-help';

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{children}</p>;
}

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
  const [primaryColor, setPrimaryColor] = useState('#6f55ff');
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
        setPrimaryColor(d.primary_color || '#6f55ff');
        setReturnAddress(d.return_address || '');
        setContactPhone(d.contact_phone || '');
        setReturnInstructions(d.return_instructions || '');
        setReturnDeadlineDays(d.return_deadline_days != null ? String(d.return_deadline_days) : '');
        setReturnPolicy(d.return_policy || '');
        const mode = d.operation_mode;
        setOperationMode(mode === 'return_only' || mode === 'exchange_only' ? mode : 'both');
      }
    } catch {
      toast('Ayarlar yüklenemedi. Sayfayı yenileyin.', 'error');
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

    let uploadedLogo: string | null = logoUrl || null;

    if (logoFile) {
      const fileName = `${merchantId || Date.now()}-${Date.now()}`;
      const { error: uploadError } = await supabase.storage
        .from('store-assets')
        .upload(fileName, logoFile, { upsert: true });

      if (uploadError) {
        toast(`Logo yüklenemedi: ${uploadError.message}`, 'error');
        setSaving(false);
        return;
      }

      uploadedLogo = supabase.storage.from('store-assets').getPublicUrl(fileName).data.publicUrl;
    }

    // Convert empty strings to null so Zod validation passes
    const body = {
      store_name: storeName.trim() || null,
      notification_email: notificationEmail.trim() || null,
      support_email: supportEmail.trim() || null,
      logo_url: uploadedLogo || null,
      primary_color: primaryColor || null,
      return_address: returnAddress.trim() || null,
      contact_phone: contactPhone.trim() || null,
      return_instructions: returnInstructions.trim() || null,
      return_deadline_days: returnDeadlineDays ? Number(returnDeadlineDays) : null,
      return_policy: returnPolicy.trim() || null,
      operation_mode: operationMode,
    };

    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: t },
      body: JSON.stringify(body),
    });

    setSaving(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      const detail = (json.error as string | undefined) ?? 'Bilinmeyen hata';
      toast(`Ayarlar kaydedilemedi: ${detail}`, 'error');
      return;
    }

    // Sync local logo state so subsequent saves work without re-uploading
    if (uploadedLogo) setLogoUrl(uploadedLogo);
    setLogoFile(null);

    toast('Ayarlar başarıyla kaydedildi ✓', 'success');
  };

  return (
    <DashboardShell storeName={storeName || undefined} logoUrl={logoUrl || undefined}>
      <div className="p-6 md:p-8 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">Ayarlar</h1>
          <PageHelp
            title="Ayarlar"
            content={
              <p>
                Mağaza adı, logo, renk teması ve iade politikası müşteri portalında görünür.
                Çalışma Modu ile portalda iade ve/veya değişim seçeneğini kontrol edin.
                Değişiklikleri kaydetmek için &quot;Ayarları Kaydet&quot; butonuna tıklayın.
              </p>
            }
          />
        </div>
        <p className="text-sm text-muted-foreground">Mağaza bilgileri ve iade politikasını buradan yönetin.</p>

        {loading ? (
          <div className="mt-8 space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="mt-8 space-y-10">

            {/* ── Mağaza Bilgileri ──────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-5">Mağaza Bilgileri</h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="storeName" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Mağaza Adı
                  </label>
                  <Input
                    id="storeName"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="Örn: Moda Butik"
                  />
                  <FieldHint>Müşteri portalının başlığında, e-postalarda ve bildirim alanında görünür.</FieldHint>
                </div>

                <div>
                  <label htmlFor="notificationEmail" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Bildirim E-postası
                  </label>
                  <Input
                    id="notificationEmail"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="siz@magazaniz.com"
                    type="email"
                  />
                  <FieldHint>
                    Yeni iade talepleri, durum değişiklikleri ve sistem bildirimleri bu adrese gönderilir.
                    Boş bırakılırsa e-posta bildirimi devre dışı kalır.
                  </FieldHint>
                </div>

                <div>
                  <label htmlFor="supportEmail" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Destek E-postası
                  </label>
                  <Input
                    id="supportEmail"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="destek@magazaniz.com"
                    type="email"
                  />
                  <FieldHint>
                    Müşterilere gönderilen e-postalarda ve iade portalının alt kısmında gösterilen
                    destek iletişim adresi. Müşteriler bu adrese soru gönderebilir.
                  </FieldHint>
                </div>
              </div>
            </section>

            {/* ── Görünüm ───────────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-5">Görünüm</h2>
              <div className="space-y-5">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-foreground">Mağaza Logosu</label>
                  <div className="flex items-center gap-4 flex-wrap">
                    {(logoFile || logoUrl) && (
                      <img
                        src={logoFile ? URL.createObjectURL(logoFile) : logoUrl}
                        alt="Logo önizleme"
                        className="h-14 w-14 rounded-xl border border-border object-contain bg-white"
                      />
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-xs text-muted-foreground hover:bg-muted transition-colors">
                      <Upload className="h-4 w-4" />
                      {logoFile ? logoFile.name : 'Logo Seç'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) {
                            toast('Logo dosyası 5 MB sınırını aşıyor', 'error');
                            e.target.value = '';
                            return;
                          }
                          setLogoFile(file);
                        }}
                      />
                    </label>
                    {logoUrl && !logoFile && (
                      <button
                        type="button"
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        onClick={() => setLogoUrl('')}
                      >
                        Logoyu Kaldır
                      </button>
                    )}
                  </div>
                  <FieldHint>PNG, JPG veya SVG. En fazla 5 MB. Müşteri portalında ve e-postalarda görünür.</FieldHint>
                </div>

                <div>
                  <label htmlFor="primaryColor" className="mb-1.5 block text-xs font-semibold text-foreground">
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
                  <FieldHint>
                    Müşteri iade portalındaki buton, bağlantı ve vurgu renklerini belirler.
                    Mağazanızın marka rengini kullanmanız önerilir.
                  </FieldHint>
                </div>
              </div>
            </section>

            {/* ── İade Ayarları ─────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-5">İade Ayarları</h2>
              <div className="space-y-5">
                <div>
                  <label htmlFor="returnPolicy" className="mb-1.5 block text-xs font-semibold text-foreground">
                    İade Politikası
                  </label>
                  <Textarea
                    id="returnPolicy"
                    value={returnPolicy}
                    onChange={(e) => setReturnPolicy(e.target.value)}
                    placeholder="İade koşulları ve politikanızı buraya yazın. Örn: Satın alım tarihinden itibaren 30 gün içinde iade kabul edilir..."
                    rows={5}
                  />
                  <FieldHint>
                    Müşteriler iade talebini göndermeden önce bu metni okur ve kabul eder.
                    Kapsamlı bir politika, gereksiz talep sayısını azaltır.
                  </FieldHint>
                </div>

                <div>
                  <label htmlFor="returnAddress" className="mb-1.5 block text-xs font-semibold text-foreground">
                    İade Adresi
                  </label>
                  <Textarea
                    id="returnAddress"
                    value={returnAddress}
                    onChange={(e) => setReturnAddress(e.target.value)}
                    placeholder={`Örn:\nModa Butik Depo\nÖrnek Mah. Ticaret Cad. No:15\nKadıköy / İstanbul 34710`}
                    rows={4}
                  />
                  <FieldHint>
                    Müşterilerin ürünleri gönderecekleri adres. Onay e-postasına otomatik olarak eklenir.
                  </FieldHint>
                </div>

                <div>
                  <label htmlFor="returnInstructions" className="mb-1.5 block text-xs font-semibold text-foreground">
                    İade Adımları
                  </label>
                  <Textarea
                    id="returnInstructions"
                    value={returnInstructions}
                    onChange={(e) => setReturnInstructions(e.target.value)}
                    placeholder={`1. Ürünü orijinal ambalajında paketleyin\n2. Referans numaranızı paketin üzerine yazın\n3. Belirtilen adrese kargolayın\n4. Kargo takip numaranızı tarafımıza bildirin`}
                    rows={5}
                  />
                  <FieldHint>
                    Onay e-postasında müşteriye adım adım gösterilir. Net talimatlar kargo sürecini hızlandırır.
                  </FieldHint>
                </div>

                <div>
                  <label htmlFor="contactPhone" className="mb-1.5 block text-xs font-semibold text-foreground">
                    Destek Telefonu
                  </label>
                  <Input
                    id="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+90 212 000 00 00"
                  />
                  <FieldHint>
                    Müşteriye gönderilen e-postalarda ve iade portalında gösterilen iletişim numarası.
                    Müşteriler soru sormak için bu numarayı kullanabilir.
                  </FieldHint>
                </div>

                <div>
                  <label htmlFor="returnDeadlineDays" className="mb-1.5 block text-xs font-semibold text-foreground">
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
                      placeholder="30"
                      className="w-28"
                    />
                    <span className="text-sm text-muted-foreground">gün içinde kargoya verilmeli</span>
                  </div>
                  <FieldHint>
                    Onay e-postasına son gönderim tarihi olarak eklenir. Boş bırakılırsa son tarih gösterilmez.
                  </FieldHint>
                </div>
              </div>
            </section>

            {/* ── Çalışma Modu ──────────────────────────────────────────── */}
            <section>
              <h2 className="text-sm font-semibold border-b border-border pb-2 mb-4">Çalışma Modu</h2>
              <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
                Mağazanızın hangi tür talepleri kabul edeceğini seçin.
                Müşteri portalı bu ayara göre otomatik uyum sağlar — seçili olmayan talep türleri müşteriye gösterilmez.
              </p>
              <div className="space-y-2.5">
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
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-muted-foreground/40'
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

            <Button onClick={saveSettings} disabled={saving} className="w-full" size="lg">
              {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </Button>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
