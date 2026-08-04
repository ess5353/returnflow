'use client';

import { useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { cn } from '@/lib/utils';
import {
  BarChart2, BookOpen, ChevronDown, ChevronRight, ExternalLink,
  FileText, HelpCircle, Key, Mail, MessageCircle, Package,
  RotateCcw, Settings, ShieldCheck, Sparkles, Users, Webhook,
  Zap, Bell, ClipboardList, CreditCard,
} from 'lucide-react';

// ─── Module definitions ───────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'overview',
    icon: Package,
    label: 'Genel Bakış',
    short: 'Tüm iade/değişim taleplerinin özeti',
    content: (
      <div className="space-y-4">
        <p>
          Genel Bakış sayfası, mağazanızdaki iade ve değişim süreçlerini tek ekranda görmenizi sağlar. Yeni talepleri buradan hızlıca onaylayabilir veya reddedebilirsiniz.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Sol listeden bir talep seçin; sağda detaylar açılır.</li>
          <li><strong>Onayla</strong> veya <strong>Reddet</strong> butonuyla talebi sonuçlandırın.</li>
          <li>Onaylanan ve reddedilen talepler müşteriye otomatik e-posta gönderir (e-posta yapılandırıldıysa).</li>
          <li>Durum filtresini kullanarak sadece &quot;Yeni Talep&quot; veya &quot;Onaylandı&quot; gibi belirli durumdaki talepleri görüntüleyin.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>İpucu:</strong> &quot;Demo Veriler Yükle&quot; butonu ile gerçek veriye benzer örnek talepler ekleyebilirsiniz. Uygulamayı test etmek için kullanışlıdır.
        </div>
      </div>
    ),
  },
  {
    id: 'returns',
    icon: RotateCcw,
    label: 'İade Yönetimi',
    short: 'Talepleri filtreleyin, arayın, not ekleyin',
    content: (
      <div className="space-y-4">
        <p>
          İade Yönetimi sayfası, tüm iade ve değişim taleplerini tam kontrol ile yönetmenizi sağlar.
        </p>
        <h3 className="font-semibold text-sm">Temel işlemler</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Tablodaki bir satıra tıklayarak talep detaylarını sağ panelde açın.</li>
          <li>Durum güncellemesi yapın: <em>Yeni Talep → İncelemede → Onaylandı / Reddedildi</em></li>
          <li>Değişim talepleri için ek durumlar mevcuttur: <em>Kargoya Verildi, Tamamlandı</em></li>
          <li>Dahili not ekleyin; notlar müşteriye gösterilmez, sadece takım tarafından görülür.</li>
          <li>Müşterinin yüklediği fotoğrafları detay panelinde görüntüleyin.</li>
        </ul>
        <h3 className="font-semibold text-sm">Arama ve filtreleme</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Müşteri adı, sipariş numarası veya RF numarasıyla arama yapın.</li>
          <li>Tarih aralığı filtresi ile belirli dönemlere ait talepleri görüntüleyin.</li>
          <li>Tutar ve tarih sıralamasını değiştirin.</li>
          <li>CSV dışa aktarımı için sağ üstteki <strong>Dışa Aktar</strong> butonunu kullanın.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Not:</strong> Silinen talepler geri alınamaz. Silmeden önce dışa aktarmanız önerilir.
        </div>
      </div>
    ),
  },
  {
    id: 'analytics',
    icon: BarChart2,
    label: 'Analiz',
    short: 'İade oranı, sebepler, trend grafikleri',
    content: (
      <div className="space-y-4">
        <p>
          Analiz sayfası, mağazanızdaki iade verilerini grafikler ve tablolar halinde sunar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>İade Oranı:</strong> Toplam siparişe oranla kaç iade geldiğini gösterir.</li>
          <li><strong>Sebep Dağılımı:</strong> Hangi iade sebebinin en sık kullanıldığını anlayın.</li>
          <li><strong>Trend:</strong> Haftalık / aylık iade sayısının zaman içindeki değişimini inceleyin.</li>
          <li><strong>Durum Dağılımı:</strong> Kaç talep onaylandı, kaçı reddedildi, kaçı beklemede.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>İpucu:</strong> Tarih filtresi kullandıktan sonra sağ üstteki <strong>Dışa Aktar</strong> butonu ile verileri CSV olarak indirin. Muhasebe ve raporlama için kullanışlıdır.
        </div>
      </div>
    ),
  },
  {
    id: 'insights',
    icon: Sparkles,
    label: 'AI Insights',
    short: 'Yapay zeka destekli iade analizi',
    content: (
      <div className="space-y-4">
        <p>
          AI Insights, iade verilerinizi yapay zeka ile analiz ederek size öneriler ve olası sorunlar hakkında içgörüler sunar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>En sık iade edilen ürünleri ve ortak nedenleri otomatik tespit eder.</li>
          <li>Dönemsel iade artışlarını fark ederek sizi uyarır.</li>
          <li>Müşteri şikayetlerinin arkasındaki örüntüleri açıklar.</li>
        </ul>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Gereksinim:</strong> Bu özellik aktif olmak için <code>OPENAI_API_KEY</code> ortam değişkeninin tanımlanmış olması gerekir. Vercel ortam değişkenlerinizi kontrol edin.
        </div>
      </div>
    ),
  },
  {
    id: 'automation',
    icon: Zap,
    label: 'Otomasyon',
    short: 'Kurallara göre talepleri otomatik yönetin',
    content: (
      <div className="space-y-4">
        <p>
          Otomasyon modülü, belirlediğiniz koşullar eşleştiğinde iade taleplerini otomatik olarak işleme koyar. Manuel iş yükünüzü azaltır.
        </p>
        <h3 className="font-semibold text-sm">Kural nasıl oluşturulur?</h3>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>&quot;Yeni Kural Ekle&quot; butonuna tıklayın.</li>
          <li>Koşul seçin: <em>Sebep içeriyor / Tutar küçüktür / Ürün adı içeriyor</em></li>
          <li>Eylem seçin: <em>Otomatik Onayla / Otomatik Reddet</em></li>
          <li>Kuralı kaydedin ve etkinleştirin.</li>
        </ol>
        <p className="text-muted-foreground">
          Kural aktif durumdayken eşleşen her yeni talep otomatik olarak işlenir. Kural günlüğü, hangi kuralın ne zaman devreye girdiğini gösterir.
        </p>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Örnek:</strong> &quot;Sebep, <em>Yanlış ürün</em> içeriyorsa otomatik onayla&quot; kuralı, bu sebepli talepleri sıra bekletmeden işler.
        </div>
      </div>
    ),
  },
  {
    id: 'notifications',
    icon: Bell,
    label: 'Bildirimler',
    short: 'Hangi olaylarda e-posta alacağınızı ayarlayın',
    content: (
      <div className="space-y-4">
        <p>
          Bildirimler sayfasından, hangi iade olaylarında mağaza e-postanıza bildirim geleceğini seçebilirsiniz.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>Yeni Talep:</strong> Müşteri bir iade/değişim talebi oluşturduğunda bildirim alın.</li>
          <li><strong>Durum Değişikliği:</strong> Talep durumu güncellendiğinde bildirim alın.</li>
          <li>Bildirim e-postası için <strong>Ayarlar → Bildirim E-postası</strong> alanını doldurun.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Sorun giderme:</strong> E-posta gelmiyorsa spam klasörünü kontrol edin. &quot;E-posta Şablonları&quot; sayfasındaki Test Et butonu ile gönderimi doğrulayabilirsiniz.
        </div>
      </div>
    ),
  },
  {
    id: 'email-templates',
    icon: Mail,
    label: 'E-posta Şablonları',
    short: 'Müşteri e-postalarını özelleştirin',
    content: (
      <div className="space-y-4">
        <p>
          E-posta Şablonları, müşterilere gönderilen otomatik bildirimlerin içeriğini düzenlemenizi sağlar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>Talep Alındı:</strong> Müşteri portal üzerinden talep oluşturduğunda gönderilir.</li>
          <li><strong>Talep Onaylandı:</strong> Siz talebi onayladığınızda müşteriye gönderilir.</li>
          <li><strong>Talep Reddedildi:</strong> Siz talebi reddettiğinizde müşteriye gönderilir.</li>
        </ul>
        <p className="text-muted-foreground">
          Şablonlarda <code>{"{{customer_name}}"}</code>, <code>{"{{order_number}}"}</code> gibi değişkenler kullanabilirsiniz. &quot;Test Et&quot; butonu size gerçek bir test e-postası gönderir.
        </p>
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>Gereksinim:</strong> E-posta göndermek için <code>RESEND_API_KEY</code> ve <code>RESEND_FROM_EMAIL</code> ortam değişkenleri tanımlı olmalıdır.
        </div>
      </div>
    ),
  },
  {
    id: 'webhooks',
    icon: Webhook,
    label: 'Webhooks',
    short: 'Dış sistemlere otomatik bildirim gönderin',
    content: (
      <div className="space-y-4">
        <p>
          Webhook, belirli olaylar gerçekleştiğinde sizin belirlediğiniz bir URL&apos;ye otomatik olarak HTTP POST isteği gönderir. Kendi sisteminize veya Zapier, Make.com gibi otomasyon araçlarına bağlanmak için kullanılır.
        </p>
        <h3 className="font-semibold text-sm">Webhook nasıl eklenir?</h3>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>&quot;Yeni Webhook&quot; butonuna tıklayın.</li>
          <li>Hedef URL girin (HTTPS zorunludur).</li>
          <li>Tetikleyici olay seçin: <em>Talep Oluşturuldu / Durum Değişti / vb.</em></li>
          <li>Kaydedin ve &quot;Test Et&quot; butonu ile doğrulayın.</li>
        </ol>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Güvenlik:</strong> Webhook gövdesi imzalıdır. Aldığınız isteğin gerçekten bizden geldiğini doğrulamak için imza başlığını kullanın.
        </div>
      </div>
    ),
  },
  {
    id: 'api-keys',
    icon: Key,
    label: 'API Anahtarları',
    short: 'Programatik erişim için anahtar yönetin',
    content: (
      <div className="space-y-4">
        <p>
          API Anahtarları, kendi kodunuzdan veya araçlardan ReturnFlow verilerine programatik erişim sağlar.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>&quot;Yeni Anahtar Oluştur&quot; ile bir isim verin ve anahtarı oluşturun.</li>
          <li>Anahtar yalnızca oluşturulduğu an görünür; güvenli bir yere kaydedin.</li>
          <li>Kullanılmayan anahtarları silin; bu erişimi hemen iptal eder.</li>
          <li>Her anahtara bir ad verin (örn. &quot;Entegrasyon - Zapier&quot;) — hangi anahtar neye ait bilebilirsiniz.</li>
        </ul>
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <strong>Güvenlik:</strong> API anahtarlarını kaynak koda yazmayın ve herkese açık yerlerde paylaşmayın. Sızan bir anahtarı hemen silin.
        </div>
      </div>
    ),
  },
  {
    id: 'api-docs',
    icon: BookOpen,
    label: 'API Belgeleri',
    short: 'Public API endpoint referansı',
    content: (
      <div className="space-y-4">
        <p>
          API Belgeleri sayfası, ReturnFlow&apos;un herkese açık API&apos;sinin endpoint listesini ve örnek kullanımını içerir.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Her endpoint için HTTP metodu, yol, parametreler ve örnek yanıt bulunur.</li>
          <li>İsteklerde <code>X-API-Key</code> başlığıyla API anahtarınızı gönderin.</li>
          <li>&quot;Dene&quot; butonu ile endpoint&apos;i doğrudan sayfadan test edebilirsiniz.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Başlangıç:</strong> Önce <em>API Anahtarları</em> sayfasından bir anahtar oluşturun, ardından belgelerdeki örnekleri çalıştırın.
        </div>
      </div>
    ),
  },
  {
    id: 'team',
    icon: Users,
    label: 'Takım',
    short: 'Ekip üyelerini davet edin ve rolleri yönetin',
    content: (
      <div className="space-y-4">
        <p>
          Takım modülü ile mağazanıza ek kullanıcı ekleyebilir ve her birine farklı yetki seviyesi tanımlayabilirsiniz.
        </p>
        <h3 className="font-semibold text-sm">Roller ve yetkileri</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-semibold">Rol</th>
                <th className="text-left py-2 font-semibold">Ne yapabilir?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <tr><td className="py-2 pr-4 font-medium">Sahip</td><td className="py-2 text-muted-foreground">Her şey + takım yönetimi + fatura</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Yönetici</td><td className="py-2 text-muted-foreground">Talep yönetimi + ayarlar (fatura hariç)</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Destek</td><td className="py-2 text-muted-foreground">Talepleri görüntüle + not ekle</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Depo</td><td className="py-2 text-muted-foreground">Talepleri görüntüle + durum güncelle</td></tr>
              <tr><td className="py-2 pr-4 font-medium">Salt Okunur</td><td className="py-2 text-muted-foreground">Yalnızca görüntüleme</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Davet:</strong> E-posta ile davet gönderin. Üye daveti kabul ettiğinde hesabına giriş yapabilir. Davet bağlantısı 7 gün geçerlidir.
        </div>
      </div>
    ),
  },
  {
    id: 'audit',
    icon: ClipboardList,
    label: 'Denetim Günlüğü',
    short: 'Kim ne zaman ne yaptı?',
    content: (
      <div className="space-y-4">
        <p>
          Denetim Günlüğü, sistemdeki tüm önemli işlemleri zaman damgalı olarak kaydeder. Kim hangi talebi onayladı, kim hangi ayarı değiştirdi — hepsini görebilirsiniz.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Talep durumu değişiklikleri otomatik kaydedilir.</li>
          <li>Ayar güncelemeleri ve takım değişiklikleri de günlüğe alınır.</li>
          <li>İşlem türüne göre filtreleyebilirsiniz.</li>
          <li>Kayıtlar değiştirilemez; güvenlik denetimi için kullanışlıdır.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'billing',
    icon: CreditCard,
    label: 'Fatura & Plan',
    short: 'Deneme, Pro plan, fatura geçmişi',
    content: (
      <div className="space-y-4">
        <p>
          Fatura & Plan sayfasından mevcut abonelik durumunuzu görebilir ve Pro plana geçiş yapabilirsiniz.
        </p>
        <h3 className="font-semibold text-sm">Planlar</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>Deneme (14 gün):</strong> Tüm özellikler ücretsiz; süre dolduğunda yeni talep kabulü duraklar.</li>
          <li><strong>Pro:</strong> Sınırsız talep, tüm özellikler — ikas App Store üzerinden abone olun.</li>
        </ul>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li>Deneme süresi dolduğunda verileriniz silinmez, yalnızca yeni talep alımı durur.</li>
          <li>Pro abonelik aktif olduğu sürece tüm özellikler tam kullanıma açıktır.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Not:</strong> Abonelik ikas App Store üzerinden yönetilir. Fatura detayları için ikas yönetim panelini ziyaret edin.
        </div>
      </div>
    ),
  },
  {
    id: 'security',
    icon: ShieldCheck,
    label: 'Güvenlik',
    short: 'Ortam değişkenleri, güvenlik skoru',
    content: (
      <div className="space-y-4">
        <p>
          Güvenlik sayfası, uygulamanızın güvenlik durumunu özetler ve eksik yapılandırmaları bildirir.
        </p>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>Güvenlik Skoru:</strong> Kritik ortam değişkenleri, HTTPS kullanımı ve diğer kontrollere göre hesaplanır.</li>
          <li>Eksik değişkenler kırmızı ile işaretlenir; tamamlananlar yeşil gösterilir.</li>
          <li>Skor 100&apos;e yaklaştıkça sistem daha güvenli kabul edilir.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Gerekli değişkenler:</strong> <code>SECRET_COOKIE_PASSWORD</code>, <code>CLIENT_SECRET</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>CRON_SECRET</code> eksikse uygulama güvenli çalışmaz.
        </div>
      </div>
    ),
  },
  {
    id: 'settings',
    icon: Settings,
    label: 'Ayarlar',
    short: 'Mağaza bilgileri, portal, çalışma modu',
    content: (
      <div className="space-y-4">
        <p>
          Ayarlar sayfasından mağazanızın genel yapılandırmasını yönetirsiniz.
        </p>
        <h3 className="font-semibold text-sm">Temel ayarlar</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>Mağaza Adı:</strong> Müşteri portalının başlığında görünür.</li>
          <li><strong>Logo URL:</strong> Portalda mağaza logonuzu gösterir.</li>
          <li><strong>Ana Renk:</strong> Portal ve butonların renk temasını belirler.</li>
          <li><strong>İade Politikası:</strong> Portal sol panelinde müşteriye gösterilir.</li>
          <li><strong>İade Talimatları:</strong> Müşteriye iade sürecini adım adım anlatan metin.</li>
          <li><strong>İade Süresi:</strong> Kaç gün içinde iade kabul ettiğinizi belirtin.</li>
        </ul>
        <h3 className="font-semibold text-sm">Çalışma Modu</h3>
        <ul className="list-disc list-inside space-y-1 text-muted-foreground">
          <li><strong>İade ve Değişim:</strong> Müşteri her ikisini de seçebilir (varsayılan).</li>
          <li><strong>Sadece İade:</strong> Portalda değişim seçeneği görünmez.</li>
          <li><strong>Sadece Değişim:</strong> Portalda iade seçeneği görünmez.</li>
        </ul>
        <div className="rounded-lg bg-muted/60 p-3 text-xs">
          <strong>Müşteri Portalı:</strong> Müşterileriniz <code>/returns</code> adresindeki sayfayı kullanır. Bu adresi sipariş e-postalarınıza veya web sitenize ekleyin.
        </div>
      </div>
    ),
  },
];

// ─── Module accordion item ────────────────────────────────────────────────────

function ModuleItem({ mod, isOpen, onToggle }: {
  mod: typeof MODULES[number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = mod.icon;
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 py-4 text-left transition-colors hover:text-primary"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{mod.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{mod.short}</p>
        </div>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>
      {isOpen && (
        <div className="pb-5 text-sm text-foreground leading-relaxed pl-11">
          {mod.content}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const { settings, loadSettings } = useStoreSettings();
  const [openId, setOpenId] = useState<string | null>('overview');

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id));
  }

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Yardım & Destek</h1>
            <p className="text-sm text-muted-foreground">Her modül için kısa açıklamalar ve ipuçları</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: MessageCircle, label: 'Destek E-postası', desc: '< 24 saat yanıt', href: 'mailto:hello@pelyx.co?subject=ReturnFlow Destek' },
            { icon: FileText, label: 'Özellik Talebi', desc: 'Geri bildirim gönderin', href: 'mailto:hello@pelyx.co?subject=Özellik Talebi' },
            { icon: Zap, label: 'Hata Bildirimi', desc: 'Sorun mu var?', href: 'mailto:hello@pelyx.co?subject=Hata Bildirimi' },
          ].map(({ icon: Icon, label, desc, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-auto mt-0.5" />
            </a>
          ))}
        </div>

        {/* Module reference */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold">Modül Rehberi</p>
            <button
              onClick={() => setOpenId(null)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Tümünü kapat
            </button>
          </div>
          <div className="px-4 sm:px-6">
            {MODULES.map((mod) => (
              <ModuleItem
                key={mod.id}
                mod={mod}
                isOpen={openId === mod.id}
                onToggle={() => toggle(mod.id)}
              />
            ))}
          </div>
        </div>

        {/* Quick nav */}
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Hızlı Erişim</p>
          <div className="flex flex-wrap gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <button
                  key={mod.id}
                  onClick={() => { setOpenId(mod.id); document.getElementById(`mod-${mod.id}`)?.scrollIntoView({ behavior: 'smooth' }); }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Icon className="h-3 w-3 text-primary" />
                  {mod.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Mail className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Hâlâ yardıma mı ihtiyacınız var?</p>
            <p className="text-xs text-muted-foreground mt-0.5">E-posta gönderin — 24 saat içinde yanıt alın.</p>
          </div>
          <a
            href="mailto:hello@pelyx.co?subject=ReturnFlow Destek"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            E-posta Gönder
          </a>
        </div>

      </div>
    </DashboardShell>
  );
}
