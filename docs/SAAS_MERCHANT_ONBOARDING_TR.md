# ReturnFlow — SaaS Merchant Onboarding Rehberi (Türkçe)

**Bu belge:** ikas App Store üzerinden ReturnFlow'u satın alan yeni bir merchant'ın onboarding sürecini açıklar.
**Hedef okuyucu:** Uygulama sahibi (sen), merchant'lara ne olduğunu anlamak istiyorsun.

---

## Temel Mimari

ReturnFlow bir **multi-tenant SaaS** uygulamasıdır:

| Kaynak | Paylaşım Modeli |
|--------|----------------|
| Vercel deployment | Tüm merchant'lar aynı deployment'ı kullanır |
| Supabase projesi | Tek bir proje, her satır `merchant_id` ile izole edilir |
| Resend hesabı | Tek hesap, e-postalar her merchant adına gönderilir |
| Uygulama kodu | Tek bir codebase |
| Dashboard URL | Tek bir URL, her merchant kendi JWT ile giriş yapar |
| Public portal URL | Her merchant'ın **benzersiz** URL'si vardır: `/returns/{store_key}` |

Yeni bir merchant için Vercel, Supabase veya Resend'de hiçbir şey oluşturman gerekmez. **Sıfır manuel kurulum.**

---

## Senaryo A: Normal ikas App Store Kurulumu

### Adım 1 — Merchant ikas App Store'dan ReturnFlow'u bulur ve "Yükle" butonuna tıklar

Merchant kendi ikas admin panelinde (örn: `modabutik.myikas.com/admin`) App Store'a gider, ReturnFlow'u bulur ve yükler.

### Adım 2 — ikas, merchant'ı OAuth yetkilendirme ekranına yönlendirir

ikas sistemi şu URL'yi açar:
```
https://returnflow.pelyx.co/api/oauth/authorize/ikas?storeName=modabutik&...
```

Merchant "İzin Ver" butonuna tıklar.

### Adım 3 — OAuth callback tetiklenir

`/api/oauth/callback/ikas` endpoint'i çalışır ve sırayla şunları yapar:

#### 3a. ikas'tan token alınır
ikas yetkilendirme kodunu gerçek bir `access_token` + `refresh_token` ile değiştirir.

#### 3b. Merchant kimliği doğrulanır
ikas API'ye iki sorgu atılır:
- `getMerchant()` → `merchantId` (UUID, örn: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)
- `getAuthorizedApp()` → `authorizedAppId`

#### 3c. `auth_tokens` tablosuna satır eklenir
```sql
-- Otomatik oluşturulan satır:
INSERT INTO auth_tokens (
  merchant_id,          -- merchant'ın ikas UUID'si
  authorized_app_id,    -- uygulama yetki ID'si
  access_token,         -- ikas API token (otomatik yenilenir)
  refresh_token,        -- yenileme token'ı
  expire_date,          -- token sona erme tarihi
  deleted               -- false
)
```
Bu token, merchant'ın ikas siparişlerini sorgularken kullanılır.

#### 3d. `merchant_billing` tablosuna satır eklenir (14 günlük deneme)
```sql
INSERT INTO merchant_billing (
  merchant_id,
  plan,          -- 'trial'
  status,        -- 'active'
  trial_ends_at  -- şu andan 14 gün sonra
)
```
Eş zamanlı `billing_events` kaydı da oluşur (`trial_started`).

#### 3e. `store_settings` tablosuna satır eklenir + `store_key` oluşturulur
```sql
INSERT INTO store_settings (
  merchant_id,
  store_key      -- örn: 'modabutik-ef1234567890'
)
ON CONFLICT (merchant_id) DO NOTHING
```

`store_key` formatı: `{ikas_store_adı_slug}-{merchant_id_son_10_karakter}`

Örnek: ikas store adı `modabutik`, merchantId `...ef1234567890` → `store_key = modabutik-ef1234567890`

#### 3f. Session ve JWT oluşturulur
Merchant'ın tarayıcısına bir oturum cookie'si ve JWT token atanır.

#### 3g. Merchant, ikas admin paneline yönlendirilir
Merchant'ın tarayıcısı otomatik olarak kendi ikas admin panelindeki ReturnFlow iframe'ine açılır.

---

### Adım 4 — Merchant Dashboard'u açar

Merchant, ikas admin panelinde ReturnFlow iframe'ini görür. Bu, tek bir Vercel deployment'ıdır. Merchant'ın JWT token'ı içinde `merchant_id` gömülüdür.

Dashboard'daki her API isteği şu şekilde çalışır:
1. Frontend, `Authorization: JWT <token>` header'ı ekler
2. Backend, JWT'yi doğrular ve `merchant_id` + `authorizedAppId` çıkarır
3. Tüm DB sorguları `.eq('merchant_id', user.merchantId)` filtresi içerir
4. Merchant sadece kendi verilerini görür

**Diğer merchant'ların verileri erişilemez.** İzolasyon JWT + DB filtresi kombinasyonuyla sağlanır.

---

### Adım 5 — Merchant ayarlarını yapılandırır

Merchant, ReturnFlow Dashboard → **Ayarlar** bölümüne gider ve şunları doldurur:

| Alan | Amacı |
|------|-------|
| Mağaza Adı | Müşteri portalında görünür |
| Logo | Müşteri portalı + e-postalarda görünür |
| Ana Renk | Portal tema rengi |
| Bildirim E-postası | Yeni talepler bu adrese bildirilir |
| Destek E-postası | Müşterilere gönderilir |
| İade Adresi | Onay e-postasına eklenir |
| İade Politikası | Portalda müşteriye gösterilir |
| İade Adımları | Onay e-postasına eklenir |
| İade Süresi | Son gönderi tarihi hesabı için |
| Çalışma Modu | İade / değişim / her ikisi |

Ayarlar kaydedildiğinde `store_settings` tablosundaki mevcut satır güncellenir. `store_key` değişmez.

---

### Adım 6 — Merchant, benzersiz portal URL'sini alır

Dashboard → **Ayarlar** sayfasının altındaki **"Portal Bağlantıları"** bölümünde iki bağlantı görünür:

```
İade Portalı:  https://returnflow.pelyx.co/returns/modabutik-ef1234567890
Talep Takibi:  https://returnflow.pelyx.co/track/modabutik-ef1234567890
```

Merchant bu bağlantıları kopyala butonuyla alır.

---

### Adım 7 — Merchant, kendi e-ticaret sitesine "İade / Değişim" butonu ekler

Merchant, kendi ikas teması veya özel HTML editörüne şu butonu ekler:

```html
<a href="https://returnflow.pelyx.co/returns/modabutik-ef1234567890"
   target="_blank"
   style="display:inline-block;padding:12px 24px;background:#6f55ff;color:white;border-radius:8px;text-decoration:none;font-weight:bold;">
  İade / Değişim Talebi Oluştur
</a>
```

Ayrıca sipariş onay e-postasına, teşekkür sayfasına veya müşteri hesabı sayfasına ekleyebilir.

---

### Adım 8 — Müşteri iade talebi oluşturur

Müşteri, merchant'ın özel portal URL'sine gider (`/returns/modabutik-ef1234567890`):

1. Sipariş numarası + e-posta ile siparişini bulur
2. İade edilecek ürünleri seçer
3. Talep türü seçer (iade / değişim)
4. Sebep + fotoğraf ekler
5. "Talep Oluştur" butonuna tıklar

#### Arkada ne olur?

`POST /api/returns` endpoint'i çalışır:
1. `store_key` parametresinden merchant'ı tanımlar (`resolveStoreKey()`)
2. `return_requests` tablosuna `merchant_id` ile satır ekler
3. Merchant'a bildirim gönderir (notification + e-posta)
4. Müşteriye "Talebiniz Alındı" e-postası gönderir
5. Automation kuralları değerlendirilir

Bu noktada müşterinin talebi **yalnızca doğru merchant'ın** dashboardında görünür.

---

### Adım 9 — Merchant talebi yönetir

Merchant, ReturnFlow Dashboard → **İade Yönetimi** bölümünde talebi görür.

Durumu değiştirdikçe:
- Müşteriye otomatik e-posta gönderilir (her durum için ayrı şablon)
- Audit log kaydedilir
- Webhook tetiklenir (yapılandırıldıysa)

---

## Sen (Uygulama Sahibi) Ne Yaparsın?

### Manuel müdahale gerektiren durumlar:

| Durum | Sen ne yaparsın? |
|-------|-----------------|
| Merchant kurulum yaptı ama `store_key` oluşmadı | Supabase'de `SELECT * FROM store_settings WHERE merchant_id = '...'` sorgula, store_key NULL ise `supabase_store_key_migration.sql` dosyasını çalıştır |
| Merchant trial bitiminden sonra ödeme yapmak istiyor | Merchant ikas App Store'dan aboneliği başlatır, sistem otomatik günceller |
| Merchant uygulamayı kaldırmak istiyor | ikas webhook'u gelir (eğer yapılandırıldıysa), `auth_tokens.deleted = true` olur |
| Resend e-posta limiti aşıldı | Resend planını yükselt |
| Merchant desteğe ulaşıyor | eypsrkc@gmail.com adresi |

### **Hiçbir merchant için ayrı altyapı oluşturman gerekmez.**

---

## Otomatik vs Manuel Özet

| İşlem | Kim yapar? | Otomatik mi? |
|-------|-----------|-------------|
| auth_tokens kaydı | OAuth callback | ✅ Otomatik |
| merchant_billing (trial) | OAuth callback | ✅ Otomatik |
| store_settings + store_key | OAuth callback | ✅ Otomatik |
| Dashboard erişimi | merchant, JWT ile | ✅ Otomatik |
| Ayarları doldurma | Merchant | ❌ Merchant yapar |
| Portal URL'yi sitesine ekleme | Merchant | ❌ Merchant yapar |
| E-posta şablonlarını özelleştirme | Merchant (isteğe bağlı) | Varsayılan şablonlar mevcuttur |
| Webhook kurulumu | Merchant (isteğe bağlı) | ❌ Merchant yapar |
| Otomasyon kuralları | Merchant (isteğe bağlı) | ❌ Merchant yapar |
| Pro'ya geçiş | ikas ödeme → otomatik senkronizasyon | ✅ Otomatik |
