# ReturnFlow — Yeni Merchant Kontrol Listesi

**Amaç:** Yeni bir merchant ReturnFlow'u kurduğunda tüm kayıtların doğru oluştuğunu doğrulamak için kullanılır.

Merchant'ın `merchant_id`'sini Supabase → `auth_tokens` tablosundan bulabilirsin.

---

## 1. Otomatik Oluşan Kayıtları Doğrula

Supabase SQL Editor'de şu sorguyu çalıştır (merchant_id'yi merchant'ınkiyle değiştir):

```sql
-- Merchant ID'sini öğren (ikas store adı ile ara)
SELECT merchant_id, authorized_app_id, deleted, expire_date
FROM auth_tokens
ORDER BY created_at DESC
LIMIT 10;
```

Sonra o merchant_id ile tüm kayıtları kontrol et:

```sql
-- Tüm kayıtları tek sorguda kontrol et
SELECT
  (SELECT COUNT(*) FROM auth_tokens WHERE merchant_id = 'MERCHANT_ID_BURAYA' AND deleted = false) AS auth_token_ok,
  (SELECT COUNT(*) FROM merchant_billing WHERE merchant_id = 'MERCHANT_ID_BURAYA') AS billing_ok,
  (SELECT store_key FROM store_settings WHERE merchant_id = 'MERCHANT_ID_BURAYA') AS store_key,
  (SELECT plan FROM merchant_billing WHERE merchant_id = 'MERCHANT_ID_BURAYA') AS plan,
  (SELECT status FROM merchant_billing WHERE merchant_id = 'MERCHANT_ID_BURAYA') AS billing_status,
  (SELECT trial_ends_at FROM merchant_billing WHERE merchant_id = 'MERCHANT_ID_BURAYA') AS trial_ends_at;
```

### Beklenen Sonuçlar

| Sütun | Beklenen Değer | Problem varsa |
|-------|---------------|--------------|
| `auth_token_ok` | `1` | OAuth başarısız olmuş, merchant yeniden kurulum yapmalı |
| `billing_ok` | `1` | `createTrialBillingRecord()` çalışmamış, Supabase'de manuel ekle |
| `store_key` | `modabutik-ef1234567890` formatında | OAuth callback'te store_key oluşmamış, aşağıdaki düzeltmeyi uygula |
| `plan` | `trial` | Normal |
| `billing_status` | `active` | Normal |
| `trial_ends_at` | Bugünden ~14 gün sonra | Normal |

---

## 2. store_key Eksikse Düzelt

Eğer `store_key` NULL çıkarsa (migration çalıştırılmadan önce kurulum yapılan merchant'lar için):

```sql
-- store_key'i manuel oluştur (merchant_id'yi değiştir)
UPDATE store_settings
SET store_key = (
  lower(regexp_replace('MERCHANT_ID_BURAYA', '[^a-zA-Z0-9]', '', 'g'))
) || '-' || (
  lower(right(replace('MERCHANT_ID_BURAYA', '-', ''), 10))
)
WHERE merchant_id = 'MERCHANT_ID_BURAYA' AND store_key IS NULL;
```

Sonra merchant'a portal URL'sini bildir:
```
https://returnflow.pelyx.co/returns/{store_key}
```

---

## 3. Portal URL'sini Test Et

Merchant'ın `store_key`'ini öğrendikten sonra bu URL'yi tarayıcıda aç:

```
https://returnflow.pelyx.co/returns/{store_key}
```

**Beklenen:** Mağaza adı, logo ve renk yüklü iade formu görünür.

Eğer "Store not found" hatası alırsan:
- `store_key` yanlış yazılmış
- `store_settings` tablosunda o `store_key` yok
- Tekrar doğrula

---

## 4. E-posta Yapılandırmasını Test Et

Merchant herhangi bir ayar kaydettiyse `notification_email` doldurulmuş olmalıdır.

```sql
SELECT notification_email, support_email, store_name
FROM store_settings
WHERE merchant_id = 'MERCHANT_ID_BURAYA';
```

Eğer `notification_email` doluysa ve bir iade talebi oluşturulursa merchant bu adrese bildirim alacak.

---

## 5. Billing Durumunu İzle

```sql
-- Trial bitiş tarihi
SELECT
  plan,
  status,
  trial_ends_at,
  EXTRACT(DAY FROM (trial_ends_at - now())) AS gun_kaldi
FROM merchant_billing
WHERE merchant_id = 'MERCHANT_ID_BURAYA';
```

Trial bitmeden önce merchant'a hatırlatma yapılabilir (otomatik hatırlatma sistemi henüz yok).

---

## 6. Hızlı Kontrol Tablosu

```
Merchant: _______________________
Kurulum Tarihi: _________________
merchant_id: ____________________
store_key: ______________________

[ ] auth_tokens satırı mevcut, deleted = false
[ ] merchant_billing satırı mevcut, plan = trial, status = active
[ ] store_settings satırı mevcut, store_key dolu
[ ] Portal URL açılıyor: /returns/{store_key}
[ ] Merchant portal URL'sini dashboard'dan kopyalayabiliyor
[ ] (Opsiyonel) Test iade talebi oluşturuldu, dashboardda görünüyor
[ ] (Opsiyonel) Test e-postası alındı
```

---

## 7. Sık Karşılaşılan Sorunlar

| Sorun | Sebep | Çözüm |
|-------|-------|-------|
| Merchant dashboard açılmıyor | OAuth callback hatalı | Merchant yeniden kurulum yapsın |
| store_key NULL | Migration çalıştırılmadan önce kurulum | Bölüm 2'deki SQL'i çalıştır |
| Portal "Store not found" diyor | store_key DB'de yok | store_key'i doğrula |
| Merchant iade göremez | merchant_id uyuşmuyor | auth_tokens ve return_requests merchant_id karşılaştır |
| E-posta gelmiyor | RESEND_FROM_EMAIL ayarsız veya domain doğrulanmamış | Vercel env variables + Resend domain doğrulama kontrol et |
| Trial bitmeden önce ödeme isteniyor | billing_status yanlış | merchant_billing tablosunu Supabase'de kontrol et |
