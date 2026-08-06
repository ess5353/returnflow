import { ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Gizlilik Politikası | ReturnFlow',
  description: 'ReturnFlow gizlilik politikası ve kişisel veri işleme esasları.',
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
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
            <h1 className="text-2xl font-bold tracking-tight">Gizlilik Politikası</h1>
            <p className="mt-2 text-sm text-gray-500">Son güncelleme: 6 Ağustos 2026</p>
          </div>

          <section className="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              ReturnFlow (&quot;Uygulama&quot;), Pelyx (&quot;biz&quot;, &quot;bize&quot;) tarafından geliştirilen ve ikas
              App Store üzerinden dağıtılan, mağazaların iade ve değişim süreçlerini yönetmesini sağlayan bir
              uygulamadır. Bu Gizlilik Politikası, uygulamayı kullanan mağaza sahipleri (&quot;Mağaza&quot;) ve
              mağazaların müşterileri (&quot;Müşteri&quot;) için hangi verilerin toplandığını, nasıl kullanıldığını
              ve nasıl korunduğunu açıklar.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">1. Topladığımız Veriler</h2>
            <div className="text-sm text-gray-700 leading-relaxed space-y-2">
              <p><strong className="text-gray-900">Mağaza verileri:</strong> ikas OAuth yetkilendirmesi sırasında mağaza kimliği, yetkili uygulama kimliği ve API erişim/yenileme jetonları; mağaza ayarları (mağaza adı, logo, marka rengi, iletişim bilgileri, iade politikası metni).</p>
              <p><strong className="text-gray-900">Müşteri verileri:</strong> iade/değişim portalı üzerinden bir talep oluşturulduğunda ad soyad, e-posta adresi, sipariş numarası, iade sebebi, açıklama metni ve (varsa) yüklenen fotoğraf/video kanıt dosyaları.</p>
              <p><strong className="text-gray-900">Sipariş verileri:</strong> talebin doğrulanması amacıyla ikas Admin API üzerinden ilgili siparişin numarası, tutarı ve müşteri e-postası salt okunur olarak sorgulanır; uygulama siparişleri değiştirmez.</p>
              <p><strong className="text-gray-900">Kullanım verileri:</strong> güvenlik ve kötüye kullanımın önlenmesi amacıyla istek IP adresi ve zaman damgaları (denetim günlüğü) kaydedilir.</p>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">2. Verilerin Kullanım Amacı</h2>
            <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed space-y-1">
              <li>İade ve değişim taleplerinin oluşturulması, mağaza tarafından incelenmesi ve sonuçlandırılması.</li>
              <li>Müşteriye talep durumu hakkında e-posta ile bilgilendirme yapılması.</li>
              <li>Mağazanın kendi müşterilerine ait talepleri analiz edebilmesi (İstatistikler, AI Insights).</li>
              <li>Abonelik/deneme süresi takibi ve faturalandırma.</li>
              <li>Dolandırıcılık ve kötüye kullanımın tespiti (ör. sipariş doğrulama, hız sınırlama, denetim günlüğü).</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">3. Verilerin Paylaşılması</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Veriler, uygulamanın çalışması için gerekli olan aşağıdaki alt yüklenicilerle paylaşılır; bunların
              dışında hiçbir üçüncü tarafla satılmaz veya pazarlama amacıyla paylaşılmaz.
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed space-y-1">
              <li><strong className="text-gray-900">ikas</strong> — mağaza ve sipariş verilerinin kaynağı (Admin API).</li>
              <li><strong className="text-gray-900">Supabase</strong> — veritabanı ve yüklenen kanıt dosyalarının (fotoğraf/video) depolanması.</li>
              <li><strong className="text-gray-900">Resend</strong> — müşteri ve mağaza bildirim e-postalarının gönderimi.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">4. Veri Saklama</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Veriler, mağaza uygulamayı kullanmaya devam ettiği sürece saklanır. Mağaza uygulamayı kaldırdığında
              (uninstall), mağazanın API erişim yetkisi derhal iptal edilir. Bir mağaza kendi verilerinin
              tamamen silinmesini talep ederse, aşağıdaki iletişim kanalından bize ulaşarak silme talebinde
              bulunabilir.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">5. Haklarınız</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında; verilerinizin işlenip
              işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun
              kullanılıp kullanılmadığını öğrenme, eksik veya yanlış işlenmişse düzeltilmesini isteme ve
              mevzuatta öngörülen şartlarla silinmesini/yok edilmesini isteme haklarına sahipsiniz.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">6. Güvenlik</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Tüm veri trafiği HTTPS üzerinden şifrelenir. API erişim jetonları ve müşteri verileri yalnızca
              sunucu taraflı, kimlik doğrulaması yapılmış uç noktalar üzerinden işlenir; her mağazanın verisi
              mağaza kimliğine göre izole edilir.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold">7. İletişim</h2>
            <p className="text-sm text-gray-700 leading-relaxed">
              Gizlilik ile ilgili sorularınız için:{' '}
              <a href="mailto:eypsrkc@gmail.com" className="font-medium text-gray-900 underline">eypsrkc@gmail.com</a>
              {' '}veya{' '}
              <a href="tel:+905465847088" className="font-medium text-gray-900 underline">0546 584 7088</a>
            </p>
          </section>

          <div className="pt-4 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <Link href="/terms" className="hover:text-gray-600 underline">Kullanım Koşulları</Link>
            <Link href="/support" className="hover:text-gray-600 underline">Destek</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
