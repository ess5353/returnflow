import { ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Kullanım Koşulları | ReturnFlow',
  description: 'ReturnFlow hizmet kullanım koşulları ve abonelik şartları.',
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-10 md:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-900">
            <ArrowLeftRight className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">ReturnFlow</p>
            <p className="text-xs text-gray-500">Pelyx</p>
          </div>
        </div>

        <div className="rounded-3xl bg-white shadow-xl border border-gray-100 p-6 md:p-10 space-y-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kullanım Koşulları</h1>
            <p className="mt-2 text-sm text-gray-500">Son güncelleme: 6 Ağustos 2026</p>
          </div>

          <section className="space-y-2">
            <h2 className="text-base font-bold">1. Hizmet Tanımı</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              ReturnFlow, ikas altyapısını kullanan mağazaların müşteri iade ve değişim taleplerini almasını,
              incelemesini ve yönetmesini sağlayan bir ikas uygulamasıdır. Uygulama, ikas App Store üzerinden
              kurulur ve mağazanın ikas hesabına Admin API üzerinden salt-okunur sipariş erişimi ile bağlanır.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">2. Deneme Süresi ve Ücretlendirme</h2>
            <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed space-y-1">
              <li>Uygulama kurulduğunda mağazaya <strong className="text-gray-900">14 gün ücretsiz deneme süresi</strong> tanınır. Deneme süresi boyunca tüm özellikler sınırsız kullanılabilir.</li>
              <li>Deneme süresi sona erdiğinde, hizmete devam edebilmek için <strong className="text-gray-900">Pro plana (₺12.000/yıl)</strong> geçiş yapılması gerekir. Ödeme, ikas App Store ödeme altyapısı üzerinden tahsil edilir.</li>
              <li>Deneme süresi dolduğunda mağazanın mevcut verileri silinmez; yalnızca müşteri portalı üzerinden yeni talep kabulü durdurulur. Mevcut taleplerin görüntülenmesi ve yönetimi mümkün olmaya devam eder.</li>
              <li>Kampanya/indirim dönemlerinde geçerli fiyatlandırma, ikas App Store uygulama listeleme sayfasında ayrıca belirtilir.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">3. İptal ve Kaldırma (Uninstall)</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Abonelik, ikas mağaza panelinden dilediğiniz zaman iptal edilebilir; iptal, mevcut ödeme döneminin
              sonunda geçerli olur. Uygulama ikas App Store üzerinden kaldırıldığında (uninstall), mağazanın API
              erişim yetkisi derhal iptal edilir ve hizmet o an itibarıyla durur.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">4. Mağazanın Sorumlulukları</h2>
            <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed space-y-1">
              <li>Müşteri portalında paylaşılan iade politikası ve iletişim bilgilerinin doğru ve güncel tutulması.</li>
              <li>Uygulama üzerinden gönderilen otomatik e-postaların (durum bildirimleri) mağaza adına gönderildiğinin kabul edilmesi.</li>
              <li>Takım üyelerine verilen erişim yetkilerinin (rol bazlı) uygunluğundan mağazanın sorumlu olması.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">5. Sorumluluğun Sınırlandırılması</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              ReturnFlow, mevcut haliyle (&quot;olduğu gibi&quot;) sunulur. Hizmetin kesintisiz veya hatasız
              çalışacağına dair garanti verilmez. Pelyx, uygulamanın kullanımından doğabilecek dolaylı zararlardan
              sorumlu tutulamaz. Mağaza ile müşterileri arasındaki iade/değişim/ürün anlaşmazlıklarının tarafı
              değiliz; uygulama yalnızca bir yönetim aracıdır.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">6. Değişiklikler</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Bu koşullar zaman zaman güncellenebilir. Önemli değişiklikler mağaza panelinde veya bildirim
              e-postası ile duyurulur.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">7. İletişim</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Sorularınız için:{' '}
              <a href="mailto:eypsrkc@gmail.com" className="font-medium text-gray-900 underline">eypsrkc@gmail.com</a>
              {' '}veya{' '}
              <a href="tel:+905465847088" className="font-medium text-gray-900 underline">0546 584 7088</a>
            </p>
          </section>

          <div className="pt-4 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 underline">Gizlilik Politikası</Link>
            <Link href="/support" className="hover:text-gray-600 underline">Destek</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
