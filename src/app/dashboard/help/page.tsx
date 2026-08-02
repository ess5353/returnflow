'use client';

import { useState, useEffect } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { cn } from '@/lib/utils';
import {
  BookOpen, ChevronDown, ExternalLink, HelpCircle, Mail, MessageCircle, Zap,
} from 'lucide-react';

const FAQ: { q: string; a: string }[] = [
  {
    q: 'Müşteri iade portalı linki nedir?',
    a: 'Müşterilerinizin iade veya değişim talebi oluşturabileceği herkese açık bir sayfadır. Bu linki sipariş onay e-postalarınıza veya web sitenize ekleyebilirsiniz. Linkinizi Ayarlar sayfasında bulabilirsiniz.',
  },
  {
    q: 'Müşteri iade talebini nasıl onaylayabilirim?',
    a: 'Sol menüden "İade Yönetimi"ne gidin. Listeden talebi seçin, sağ panelde detayları inceleyin ve "Onayla" veya "Reddet" butonuna tıklayın. Onaylama işlemi müşteriye bildirim olarak iletilir.',
  },
  {
    q: 'Takım üyelerine nasıl farklı yetkiler verebilirim?',
    a: '"Takım" sayfasından üye davet ederken rol seçebilirsiniz. Destek, Depo, Muhasebe ve Salt Okunur rolleri farklı yetki setlerine sahiptir. Roller, sadece Sahip (Owner) tarafından değiştirilebilir.',
  },
  {
    q: 'Otomasyon kuralları nasıl çalışır?',
    a: '"Otomasyon" sayfasından koşullar (sebep, tutar, ürün adı) tanımlayabilirsiniz. Eşleşen yeni iade talebi geldiğinde kural otomatik olarak çalışır ve talebi onaylar, reddeder veya etiketler.',
  },
  {
    q: 'E-posta bildirimleri neden gelmiyor?',
    a: '"Ayarlar" sayfasında Bildirim E-postası alanının dolu olduğundan emin olun. Ayrıca "E-posta Şablonları" > "Test Et" butonuyla e-posta gönderimini test edebilirsiniz. Spam klasörünüzü de kontrol edin.',
  },
  {
    q: 'Webhook nedir ve nasıl kullanılır?',
    a: 'Webhook, iade veya değişim olaylarında harici bir URL\'ye otomatik HTTP POST isteği gönderir. Kendi sisteminiz, Zapier veya Make.com gibi araçlarla entegrasyon için idealdir. "Webhooks" sayfasından yönetilir.',
  },
  {
    q: 'Deneme süresi bittikten sonra verilerim silinir mi?',
    a: 'Hayır. Verileriniz hiçbir zaman silinmez. Deneme süresi bittikten sonra yeni iade kabulü duraklar, mevcut verileriniz ve geçmişiniz korunur. Pro plana geçtiğinizde anında erişim yeniden başlar.',
  },
  {
    q: 'Dışa aktarma (export) özelliği nerede?',
    a: '"Analiz" sayfasının sağ üst köşesindeki "Dışa Aktar" butonu ile tüm iade verilerinizi CSV olarak indirebilirsiniz. Tarih aralığı filtresini kullandıktan sonra da dışa aktarabilirsiniz.',
  },
];

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 py-4 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        <span>{q}</span>
        <ChevronDown className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{a}</p>
      )}
    </div>
  );
}

export default function HelpPage() {
  const { settings, loadSettings } = useStoreSettings();

  useEffect(() => {
    AppBridgeHelper.closeLoader();
    loadSettings();
  }, [loadSettings]);

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="p-6 max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Yardım & Destek</h1>
            <p className="text-sm text-muted-foreground">Sık sorulan sorular ve iletişim bilgileri</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { icon: BookOpen, label: 'Belgeler', desc: 'Kullanım kılavuzu', href: 'mailto:hello@pelyx.co?subject=Belge Talebi' },
            { icon: MessageCircle, label: 'Sohbet Desteği', desc: 'Yanıt süresi < 1 gün', href: 'mailto:hello@pelyx.co' },
            { icon: Zap, label: 'Yeni Özellik İste', desc: 'Geri bildirim gönderin', href: 'mailto:hello@pelyx.co?subject=Özellik Talebi' },
          ].map(({ icon: Icon, label, desc, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 hover:border-primary/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </a>
          ))}
        </div>

        {/* FAQ */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <p className="text-sm font-semibold">Sık Sorulan Sorular</p>
          </div>
          <div className="px-6">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Mail className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">Hâlâ yardıma mı ihtiyacınız var?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              E-posta ile ulaşın — 24 saat içinde yanıt alın.
            </p>
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
