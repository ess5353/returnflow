import { ArrowLeftRight, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Destek | ReturnFlow',
  description: 'ReturnFlow destek ve iletişim bilgileri.',
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f5f6fa] px-4 py-10 md:py-16">
      <div className="mx-auto max-w-2xl">
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
            <h1 className="text-2xl font-bold tracking-tight">Destek</h1>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              ReturnFlow kurulumu, kullanımı veya faturalandırma ile ilgili herhangi bir sorunuz için
              bize aşağıdaki kanallardan ulaşabilirsiniz.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <a
              href="mailto:eypsrkc@gmail.com"
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-5 hover:bg-gray-100 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200">
                <Mail className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">E-posta</p>
                <p className="font-semibold text-sm text-gray-900 truncate">eypsrkc@gmail.com</p>
              </div>
            </a>

            <a
              href="tel:+905465847088"
              className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-5 hover:bg-gray-100 transition-colors"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white border border-gray-200">
                <Phone className="h-4 w-4 text-gray-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-gray-500">Telefon</p>
                <p className="font-semibold text-sm text-gray-900">0546 584 7088</p>
              </div>
            </a>
          </div>

          <div className="rounded-2xl bg-gray-50 border border-gray-100 p-5 space-y-2">
            <p className="text-sm font-semibold text-gray-900">Yanıt süresi</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Destek taleplerine hafta içi genellikle 24 saat içinde yanıt veriyoruz. Kritik erişim
              sorunlarında (uygulama açılmıyor, ödeme sorunu vb.) lütfen e-posta konusuna
              &quot;[Acil]&quot; ibaresi ekleyin.
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-900">Sık sorulan konular</p>
            <ul className="list-disc pl-5 text-sm text-gray-700 leading-relaxed space-y-1">
              <li>Kurulum ve ikas mağazanıza bağlama</li>
              <li>Müşteri iade portalı bağlantısını web sitenize ekleme</li>
              <li>Deneme süresi, Pro plana geçiş ve faturalandırma</li>
              <li>E-posta şablonları ve bildirim ayarları</li>
              <li>Takım üyesi davet etme ve yetkilendirme</li>
            </ul>
          </div>

          <div className="pt-4 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 underline">Gizlilik Politikası</Link>
            <Link href="/terms" className="hover:text-gray-600 underline">Kullanım Koşulları</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
