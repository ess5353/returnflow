# ReturnFlow — Kaynak Kod Alıcısı İçin Kurulum Rehberi (Türkçe)

**Bu belge:** ReturnFlow'un kaynak kodunu satın alan veya kendi altyapısında kurmak isteyen bir şirket için
sıfırdan tam kurulum adımlarını açıklar.

---

## Genel Bakış

ReturnFlow şu bağımlılıklara sahiptir:

| Servis | Ne için? | Zorunlu mu? |
|--------|----------|-------------|
| GitHub | Kaynak kod | Evet |
| Vercel | Hosting + deployment | Evet (ya da Node.js server) |
| Supabase | Veritabanı + dosya depolama | Evet |
| Resend | Müşteri e-postaları | Evet (e-posta için) |
| ikas Partner Panel | OAuth app credentials | Evet |
| OpenAI | Yapay zeka içgörüleri | Hayır (opsiyonel) |

---

## Adım 1 — GitHub Repository

### 1.1 Repoyu al
```bash
# Eğer kaynak kod ZIP olarak verilmişse:
cd /proje/klasoru
git init
git add .
git commit -m "initial"

# Eğer GitHub reposu olarak verilmişse:
git clone https://github.com/kullanici/returnflow.git
cd returnflow
```

### 1.2 Vercel için bağla
Vercel'e deploy edeceksen GitHub'a push et ve Vercel'i GitHub'a bağla.

---

## Adım 2 — Supabase Projesi Oluştur

### 2.1 Proje oluştur
1. [supabase.com](https://supabase.com) → "New Project"
2. Proje adı: `returnflow-prod` (ya da tercihine göre)
3. Bölge: Frankfurt (EU) ya da en yakın bölge
4. Şifre: güçlü bir şifre belirle (ileride gerekecek)
5. "Create new project" tıkla → birkaç dakika bekle

### 2.2 SQL Migration'ı çalıştır
Supabase dashboard → SQL Editor → "New query":

```sql
-- supabase_full_migration.sql dosyasının tüm içeriğini buraya yapıştır ve çalıştır
```

`supabase_full_migration.sql` dosyasını aç, tüm içeriği kopyala, SQL Editor'e yapıştır ve "Run" butonuna tıkla.

**Beklenen sonuç:** 19 tablo oluşturulmuş olmalı. Sayfanın sonundaki verification query ile kontrol et.

### 2.3 Storage Bucket'larını doğrula
Migration sonrası SQL Editor'de şunu çalıştır:
```sql
SELECT id, name, public FROM storage.buckets WHERE id IN ('return-files', 'store-assets');
```

Her iki bucket da görünmelidir. Görunmüyorsa:
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('return-files', 'return-files', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('store-assets', 'store-assets', true);
```

### 2.4 Supabase credentials'ları al
Supabase → Project Settings → API:

| Değer | Nerede bulunur? |
|-------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (örn: `https://xyzabc.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project API Keys → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Project API Keys → service_role (gizli tut!) |

---

## Adım 3 — Resend Hesabı

### 3.1 Hesap oluştur
[resend.com](https://resend.com) → Sign up → ücretsiz plan yeterlidir (100 e-posta/gün)

### 3.2 Domain doğrula
1. Resend → Domains → "Add Domain"
2. Kendi domain'ini ekle (örn: `returnflow.sirketismi.com` veya `sirketismi.com`)
3. DNS kayıtlarını (DKIM, SPF, DMARC) domain sağlayıcında ekle
4. "Verify" butonuna tıkla → yeşil onay bekle (birkaç dakika ila birkaç saat)

> **Önemli:** Vercel preview URL'si (`*.vercel.app`) üzerinden e-posta gönderilemez. Gerçek domain zorunludur.

### 3.3 API Key oluştur
Resend → API Keys → "Create API Key" → `re_xxxxx` formatında key kopyala

### 3.4 Gönderici adresi belirle
Gönderici adresi doğruladığın domain'den olmalıdır. Örnek:
```
noreply@sirketismi.com
```

---

## Adım 4 — ikas Partner Paneli — Uygulama Oluştur

### 4.1 Partner hesabı
[partners.myikas.com](https://partners.myikas.com) → Partner hesabına giriş yap

### 4.2 Yeni uygulama oluştur
1. "Uygulamalar" → "Yeni Uygulama"
2. Uygulama adı, açıklama, logo yükle
3. **Redirect/Callback URL:** (Bu çok önemli)
   ```
   https://returnflow.sirketismi.com/api/oauth/callback/ikas
   ```
   > Not: Vercel'de deploy ediyorsan önce domain'i bağla, sonra bu URL'yi gir.
4. Gerekli izinler (Scope):
   - `read_orders`
   - `write_orders` (gerekiyorsa)
   - `read_products`
   - `read_inventories`

5. Kaydet → **Client ID** ve **Client Secret** kopyala

> **Client Secret'i gizli tut.** Bir daha gösterilmeyebilir.

---

## Adım 5 — Vercel Projesi

### 5.1 Vercel hesabı
[vercel.com](https://vercel.com) → Sign up (ücretsiz ya da Pro plan)

### 5.2 Proje oluştur
1. Vercel → "Add New Project"
2. GitHub reposunu import et
3. Framework: Next.js (otomatik algılanır)
4. "Deploy" tıkla → ilk deployment başarısız olabilir çünkü env variables henüz eklenmedi

### 5.3 Environment Variables ekle
Vercel → Project → Settings → Environment Variables:

```
# ikas OAuth
NEXT_PUBLIC_CLIENT_ID          = your_ikas_client_id
CLIENT_SECRET                  = your_ikas_client_secret

# Uygulama URL
NEXT_PUBLIC_DEPLOY_URL         = https://returnflow.sirketismi.com

# ikas API endpoints (değiştirme)
NEXT_PUBLIC_GRAPH_API_URL      = https://api.myikas.com/api/v2/admin/graphql
NEXT_PUBLIC_ADMIN_URL          = https://{storeName}.myikas.com/admin

# Session
SECRET_COOKIE_PASSWORD         = en_az_32_karakter_rastgele_bir_sifre_buraya

# Supabase
NEXT_PUBLIC_SUPABASE_URL       = https://xyzabc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY      = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resend
RESEND_API_KEY                 = re_xxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL              = noreply@sirketismi.com

# Billing
IKAS_PRO_SUBSCRIPTION_KEY      = ikas_partner_panelindeki_subscription_key

# Cron güvenlik
CRON_SECRET                    = en_az_32_karakter_rastgele_cron_sifresi

# İç güvenlik
INTERNAL_SECRET                = en_az_32_karakter_rastgele_internal_siresi

# Opsiyonel — AI insights için
OPENAI_API_KEY                 = sk-xxxxxxxxxxxxxxx
```

> **Önemli:** `NODE_ENV=production` Vercel tarafından otomatik eklenir, ekleme.

### 5.4 Re-deploy
Vercel → Deployments → "Redeploy" → bu sefer başarıyla tamamlanmalı.

---

## Adım 6 — Domain Yapılandırma

### 6.1 Özel domain bağla
Vercel → Project → Settings → Domains → domain ekle:
```
returnflow.sirketismi.com
```

DNS sağlayıcında:
```
CNAME  returnflow  cname.vercel-dns.com
```
ya da root domain için:
```
A      @           76.76.19.19   (Vercel IP)
```

### 6.2 SSL
Vercel otomatik SSL sağlar (Let's Encrypt). Birkaç dakika bekle.

---

## Adım 7 — ikas OAuth Callback URL'ini Güncelle

ikas Partner Panel → Uygulamanın ayarları:
- Callback URL'yi kesin deployment URL'inle güncelle:
  ```
  https://returnflow.sirketismi.com/api/oauth/callback/ikas
  ```

> Bu URL'nin son `/` olmadığına dikkat et.

---

## Adım 8 — Billing Plan Yapılandırması

### 8.1 ikas Subscription Key
ikas Partner Panel → Uygulamanın abonelik planı → `storeAppListingSubscriptionKey` değerini kopyala.

Bu değer `IKAS_PRO_SUBSCRIPTION_KEY` env variable'ına girilir. Sistem bu key ile hangi merchant'ın aktif aboneliği olduğunu doğrular.

### 8.2 Trial süresi
Varsayılan: 14 gün. Değiştirmek istersen `src/lib/billing/sync.ts` dosyasındaki:
```typescript
const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
```
satırını düzenle.

---

## Adım 9 — İlk Merchant Kurulumu (Test)

### 9.1 Kendi ikas mağazandan test et
1. Kendi ikas test mağazanda App Store'a git
2. ReturnFlow uygulamasını bul (önce "Geliştirici Modu" olarak yayınlanmış olmalı)
3. "Yükle" tıkla → OAuth yetkilendirmesini tamamla
4. ReturnFlow Dashboard açılmalı

### 9.2 Veritabanını doğrula
Supabase → Table Editor:

```sql
-- 1. Auth token oluştu mu?
SELECT * FROM auth_tokens WHERE merchant_id = 'test_merchant_id';

-- 2. Billing kaydı oluştu mu?
SELECT * FROM merchant_billing WHERE merchant_id = 'test_merchant_id';

-- 3. store_settings + store_key oluştu mu?
SELECT merchant_id, store_key FROM store_settings WHERE merchant_id = 'test_merchant_id';
```

Tüm kayıtlar mevcutsa kurulum başarılıdır.

### 9.3 Portal URL testi
Dashboard → Ayarlar → "Portal Bağlantıları" bölümündeki URL'yi kopyala ve tarayıcıda aç.
İade formu açılmalı ve mağaza bilgileri görünmeli.

---

## Adım 10 — Production Doğrulama Kontrol Listesi

```
[ ] Supabase: 19 tablo oluşturuldu (verification query temiz)
[ ] Supabase: return-files ve store-assets bucket'ları mevcut
[ ] Vercel: deployment başarılı, build hatası yok
[ ] Vercel: tüm env variables eklendi
[ ] Domain: HTTPS çalışıyor, SSL sertifikası aktif
[ ] ikas: Callback URL doğru ayarlandı
[ ] Test merchant kurulumu: OAuth tamamlandı
[ ] Test merchant: auth_tokens satırı mevcut
[ ] Test merchant: merchant_billing (trial) mevcut
[ ] Test merchant: store_settings + store_key mevcut
[ ] Test: Müşteri portalı açılıyor (/returns/{store_key})
[ ] Test: İade formu doldurulabilir, talep kaydediliyor
[ ] Test: Merchant dashboard'da talep görünüyor
[ ] Test: E-posta gönderiliyor (RESEND_FROM_EMAIL ayarlıysa)
[ ] Resend: Domain doğrulandı (yeşil onay)
```

---

## Sık Sorulan Sorular

**Q: Yeni bir merchant kurulum yaptığında ben ne yapmam gerekiyor?**
A: Hiçbir şey. Her şey otomatik. Sadece başarılı olup olmadığını `NEW_MERCHANT_CHECKLIST_TR.md` ile doğrula.

**Q: Migration'ı her güncellemede tekrar çalıştırmam gerekiyor mu?**
A: `supabase_full_migration.sql` idempotent'tir — istediğin kadar çalıştırabilirsin, veri kaybolmaz. Ancak gereksiz. Yeni migration dosyaları olduğunda sadece onları çalıştır.

**Q: Müşteri dosya yüklemeleri nereye gidiyor?**
A: Supabase Storage → `return-files` bucket'ı. Otomatik public URL oluşturulur.

**Q: Logo yüklemeleri nereye gidiyor?**
A: Supabase Storage → `store-assets` bucket'ı.

**Q: E-postalar kim adına gönderiliyor?**
A: `RESEND_FROM_EMAIL` adresinden, merchant'ın "Mağaza Adı" display name'i ile. Örn: `Moda Butik <noreply@returnflow.sirketismi.com>`

**Q: Bir merchant uygulamayı kaldırırsa ne olur?**
A: ikas'tan webhook gelir. `auth_tokens.deleted = true` yapılması önerilir. Veriler silinmez (merchant tekrar yükleyebilir).
