'use client';

import { useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { cn } from '@/lib/utils';
import { BookOpen, ChevronRight, Copy, Check } from 'lucide-react';
import { PageHelp } from '@/components/ui/page-help';

// ─── Code Block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="group relative rounded-lg border border-border bg-zinc-950 text-sm">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
        <span className="text-xs text-zinc-500">{lang}</span>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-zinc-200 leading-relaxed text-xs">
        <code>{code.trim()}</code>
      </pre>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="space-y-4 scroll-mt-6">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-border py-3 last:border-0">
      <div className="w-36 shrink-0">
        <code className="text-xs font-semibold text-foreground">{name}</code>
        {required && <span className="ml-1.5 text-xs text-red-500">*</span>}
      </div>
      <div className="w-20 shrink-0 text-xs text-muted-foreground">{type}</div>
      <div className="text-xs text-muted-foreground">{children}</div>
    </div>
  );
}

// ─── Nav sections ─────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: 'authentication', label: 'Kimlik Doğrulama' },
  { id: 'base-url', label: 'Base URL' },
  { id: 'rate-limiting', label: 'Rate Limiting' },
  { id: 'returns', label: 'GET /returns' },
  { id: 'returns-id', label: 'GET /returns/:id' },
  { id: 'analytics', label: 'GET /analytics' },
  { id: 'automation', label: 'GET /automation/rules' },
  { id: 'notifications', label: 'GET /notifications' },
  { id: 'export-jobs', label: 'GET /export-jobs' },
  { id: 'errors', label: 'Hata Kodları' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState('authentication');

  useEffect(() => { AppBridgeHelper.closeLoader(); }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        }
      },
      { threshold: 0.5 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <DashboardShell>
      <div className="flex h-full min-h-screen">
        {/* Sidebar nav */}
        <nav className="sticky top-0 hidden h-screen w-52 shrink-0 overflow-y-auto border-r border-border py-6 lg:block">
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="h-3.5 w-3.5" />
              API Referansı
            </div>
          </div>
          <div className="space-y-0.5 px-3">
            {SECTIONS.map(({ id, label }) => (
              <a
                key={id}
                href={`#${id}`}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-colors',
                  activeSection === id
                    ? 'bg-primary/10 font-medium text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {activeSection === id && <ChevronRight className="h-3 w-3" />}
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-12 p-6 pb-24">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">Pelyx Public API</h1>
                <PageHelp title="API Belgeleri" content={<p>ReturnFlow Public API referansı. Önce API Anahtarları sayfasından bir anahtar oluşturun, sonra isteklerde X-API-Key başlığını kullanın. &quot;Dene&quot; butonu ile endpoint&apos;leri doğrudan test edebilirsiniz.</p>} />
              </div>
              <p className="mt-2 text-muted-foreground">
                İade ve değişim verilerinize programatik erişim için REST API.
              </p>
            </div>

            {/* Authentication */}
            <Section id="authentication" title="Kimlik Doğrulama">
              <p className="text-sm text-muted-foreground">
                Tüm isteklerde <code className="rounded bg-muted px-1">Authorization</code> başlığını Bearer token ile gönderin.
                API anahtarlarını <strong>API Anahtarları</strong> sayfasından oluşturabilirsiniz.
              </p>
              <CodeBlock lang="bash" code={`
curl https://your-app.vercel.app/api/public/returns \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                API anahtarlarınızı asla kaynak koduna veya istemci tarafına eklemeyin. Sunucu ortam değişkenlerinde saklayın.
              </div>
            </Section>

            {/* Base URL */}
            <Section id="base-url" title="Base URL">
              <p className="text-sm text-muted-foreground">
                Tüm endpoint&apos;ler aşağıdaki base URL altındadır:
              </p>
              <CodeBlock lang="text" code="https://your-app.vercel.app/api/public" />
            </Section>

            {/* Rate Limiting */}
            <Section id="rate-limiting" title="Rate Limiting">
              <p className="text-sm text-muted-foreground">
                Her API anahtarı için dakikada maksimum <strong>100 istek</strong> limiti uygulanır.
                Limit aşıldığında HTTP <code className="rounded bg-muted px-1">429</code> döner.
                Her yanıt aşağıdaki başlıkları içerir:
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                <Param name="X-RateLimit-Limit" type="integer">Dakikadaki maksimum istek sayısı (100)</Param>
                <Param name="X-RateLimit-Remaining" type="integer">Mevcut penceredeki kalan istek sayısı</Param>
                <Param name="X-RateLimit-Reset" type="unix timestamp">Pencerenin sıfırlanacağı zaman</Param>
              </div>
            </Section>

            {/* GET /returns */}
            <Section id="returns" title="GET /returns">
              <p className="text-sm text-muted-foreground">
                İade ve değişim taleplerinin listesini döner. Sayfalama ve filtreleme desteklenir.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/returns?status=Onaylandi&limit=10" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />

              <h3 className="text-sm font-semibold">Query Parametreleri</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Param name="status" type="string">Durum filtresi (Yeni Talep, Onaylandı, Reddedildi, Tamamlandı, İncelemede)</Param>
                <Param name="request_type" type="string">return veya exchange</Param>
                <Param name="created_after" type="date">Bu tarihten sonra oluşturulanlar (YYYY-MM-DD)</Param>
                <Param name="created_before" type="date">Bu tarihten önce oluşturulanlar (YYYY-MM-DD)</Param>
                <Param name="page" type="integer">Sayfa numarası (varsayılan: 1)</Param>
                <Param name="limit" type="integer">Sayfa başı kayıt (varsayılan: 20, max: 100)</Param>
              </div>

              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "rf_number": "RF-2026.08.01-0001",
      "order_id": "ORDER-12345",
      "customer_name": "Ahmet Yılmaz",
      "customer_email": "ahmet@example.com",
      "product": "Mavi T-Shirt",
      "reason": "Beden uyumsuzluğu",
      "status": "Onaylandı",
      "request_type": "return",
      "amount": "299.99",
      "created_at": "2026-08-01T10:30:00.000Z",
      "updated_at": "2026-08-01T14:20:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "has_more": true
  }
}
              `} />
            </Section>

            {/* GET /returns/:id */}
            <Section id="returns-id" title="GET /returns/:id">
              <p className="text-sm text-muted-foreground">
                Tek bir iade/değişim talebinin tüm detaylarını döner.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/returns/550e8400-e29b-41d4-a716-446655440000" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "rf_number": "RF-2026.08.01-0001",
    "order_id": "ORDER-12345",
    "customer_name": "Ahmet Yılmaz",
    "customer_email": "ahmet@example.com",
    "product": "Mavi T-Shirt",
    "reason": "Beden uyumsuzluğu",
    "status": "Onaylandı",
    "request_type": "return",
    "amount": "299.99",
    "description": "Aldığım ürün bedenimize uymadı.",
    "media_urls": ["https://..."],
    "admin_note": "Onaylandı, iade işlemi başlatıldı.",
    "created_at": "2026-08-01T10:30:00.000Z",
    "updated_at": "2026-08-01T14:20:00.000Z"
  }
}
              `} />
            </Section>

            {/* GET /analytics */}
            <Section id="analytics" title="GET /analytics">
              <p className="text-sm text-muted-foreground">
                İade ve değişim istatistiklerini döner: durum bazlı sayılar, talep türü dağılımı, toplam tutar.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/analytics" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": {
    "total": 250,
    "by_status": {
      "Yeni Talep": 45,
      "Onaylandı": 150,
      "Reddedildi": 30,
      "Tamamlandı": 25
    },
    "by_request_type": {
      "return": 200,
      "exchange": 50
    },
    "total_amount": "74850.00"
  }
}
              `} />
            </Section>

            {/* GET /automation/rules */}
            <Section id="automation" title="GET /automation/rules">
              <p className="text-sm text-muted-foreground">
                Tanımlanmış otomasyon kurallarını döner.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/automation/rules" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": [
    {
      "id": "rule-uuid",
      "name": "Otomatik Onay - Düşük Tutar",
      "enabled": true,
      "priority": 1,
      "condition_logic": "AND",
      "conditions": [
        { "field": "amount", "operator": "lt", "value": "100" }
      ],
      "action": "auto_approve",
      "created_at": "2026-07-15T08:00:00.000Z"
    }
  ]
}
              `} />
            </Section>

            {/* GET /notifications */}
            <Section id="notifications" title="GET /notifications">
              <p className="text-sm text-muted-foreground">
                Mağazaya ait bildirimleri döner.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/notifications?limit=5" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <h3 className="text-sm font-semibold">Query Parametreleri</h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Param name="page" type="integer">Sayfa numarası (varsayılan: 1)</Param>
                <Param name="limit" type="integer">Sayfa başı kayıt (varsayılan: 20, max: 100)</Param>
              </div>
              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": [
    {
      "id": "notif-uuid",
      "type": "new_return",
      "title": "Yeni İade: RF-2026.08.01-0001",
      "message": "Ahmet Yılmaz · Sipariş ORDER-12345",
      "read": false,
      "related_return_id": "550e8400...",
      "created_at": "2026-08-01T10:30:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "has_more": true }
}
              `} />
            </Section>

            {/* GET /export-jobs */}
            <Section id="export-jobs" title="GET /export-jobs">
              <p className="text-sm text-muted-foreground">
                Export işlem geçmişini döner.
              </p>
              <CodeBlock lang="bash" code={`
curl "https://your-app.vercel.app/api/public/export-jobs" \\
  -H "Authorization: Bearer plx_a1b2c3d4..."
              `} />
              <h3 className="text-sm font-semibold">Örnek Yanıt</h3>
              <CodeBlock lang="json" code={`
{
  "data": [
    {
      "id": "export-uuid",
      "format": "xlsx",
      "filters": { "status": "Onaylandı" },
      "columns": ["rf_number", "customer_name", "amount"],
      "row_count": 85,
      "file_name": "iadeler-2026-08-01.xlsx",
      "created_at": "2026-08-01T12:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 12, "has_more": false }
}
              `} />
            </Section>

            {/* Error Codes */}
            <Section id="errors" title="Hata Kodları">
              <p className="text-sm text-muted-foreground">
                Hata yanıtları her zaman <code className="rounded bg-muted px-1">error</code> ve <code className="rounded bg-muted px-1">code</code> alanlarını içerir.
              </p>
              <CodeBlock lang="json" code={`
{
  "error": "Unauthorized",
  "code": "INVALID_API_KEY"
}
              `} />
              <div className="overflow-hidden rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-medium">HTTP Kodu</th>
                      <th className="px-4 py-2.5 text-left font-medium">code</th>
                      <th className="px-4 py-2.5 text-left font-medium">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {[
                      ['401', 'INVALID_API_KEY', 'API anahtarı geçersiz, süresi dolmuş veya iptal edilmiş'],
                      ['404', 'NOT_FOUND', 'İstenen kayıt bulunamadı'],
                      ['429', 'RATE_LIMIT_EXCEEDED', 'Dakikalık istek limiti aşıldı (100 req/min)'],
                      ['500', 'DB_ERROR', 'Veritabanı sorgusu başarısız'],
                      ['500', 'INTERNAL_ERROR', 'Beklenmeyen sunucu hatası'],
                    ].map(([code, name, desc]) => (
                      <tr key={name} className="hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-mono font-semibold text-foreground">{code}</td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{name}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
