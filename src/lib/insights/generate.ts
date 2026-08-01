import OpenAI from 'openai';
import type { Insight, InsightSection, InsightSeverity, MerchantStats } from './types';

function id(section: InsightSection, suffix: string) {
  return `${section}_${suffix}`;
}

// ─── Deterministic generator ─────────────────────────────────────────────────

export function generateDeterministicInsights(stats: MerchantStats): Insight[] {
  const insights: Insight[] = [];
  const {
    totalRequests, totalReturns, totalExchanges,
    byStatus, weeklyTrend,
    topReturnedProducts, topReturnReasons,
    automationMatchRate, topAutomationRules,
    totalAmount, approvedAmount, rejectedAmount, avgAmount,
    totalUniqueCustomers, repeatCustomers, avgResolutionDays,
  } = stats;

  if (totalRequests === 0) {
    insights.push({
      id: id('executive_summary', 'empty'),
      section: 'executive_summary',
      title: 'Henüz Veri Yok',
      description: 'Analiz için yeterli iade/değişim verisi bulunamadı.',
      severity: 'info',
      confidence: 100,
      recommendation: 'İlk iade/değişim talepleri oluşturulduktan sonra içgörüler otomatik olarak üretilecektir.',
    });
    return insights;
  }

  const approvedCount = byStatus['Onaylandı'] ?? 0;
  const rejectedCount = byStatus['Reddedildi'] ?? 0;
  const completedCount = byStatus['Tamamlandı'] ?? 0;
  const pendingCount = byStatus['Yeni Talep'] ?? 0;
  const resolvedCount = approvedCount + rejectedCount + completedCount;
  const resolutionRate = totalRequests > 0 ? Math.round((resolvedCount / totalRequests) * 100) : 0;
  const approvalRate = resolvedCount > 0 ? Math.round((approvedCount + completedCount) / resolvedCount * 100) : 0;
  const exchangeShare = totalRequests > 0 ? Math.round((totalExchanges / totalRequests) * 100) : 0;
  const repeatRate = totalUniqueCustomers > 0 ? Math.round((repeatCustomers / totalUniqueCustomers) * 100) : 0;

  // ── Weekly trend (compare last 2 vs previous 2 weeks) ────────────────────
  const last2 = weeklyTrend.slice(-2).reduce((a, w) => a + w.returns + w.exchanges, 0);
  const prev2 = weeklyTrend.slice(-4, -2).reduce((a, w) => a + w.returns + w.exchanges, 0);
  const trendDelta = prev2 > 0 ? Math.round(((last2 - prev2) / prev2) * 100) : 0;

  // ─── 1. Executive Summary ──────────────────────────────────────────────────
  const healthScore = Math.round(
    (resolutionRate * 0.3) +
    (approvalRate * 0.2) +
    (automationMatchRate * 0.25) +
    (repeatRate < 20 ? 25 : repeatRate < 40 ? 15 : 5),
  );
  const healthLabel = healthScore >= 70 ? 'Sağlıklı' : healthScore >= 45 ? 'İyileştirme Gerekiyor' : 'Kritik Dikkat';
  const healthSeverity: InsightSeverity = healthScore >= 70 ? 'positive' : healthScore >= 45 ? 'warning' : 'critical';

  insights.push({
    id: id('executive_summary', 'health'),
    section: 'executive_summary',
    title: `Operasyon Sağlığı: ${healthLabel}`,
    description: `${totalRequests} toplam talepte %${resolutionRate} çözüm oranı, %${approvalRate} onay oranı ve %${automationMatchRate} otomasyon eşleşmesi. Ortalama çözüm süresi ${avgResolutionDays} gün.`,
    severity: healthSeverity,
    confidence: 92,
    recommendation: healthScore >= 70
      ? 'Mevcut süreçleri koruyun ve otomasyon kurallarını genişletin.'
      : 'Bekleyen talepleri hızlandırın ve ret oranını düşürmeye odaklanın.',
  });

  if (pendingCount > 0) {
    const pendingPct = Math.round((pendingCount / totalRequests) * 100);
    insights.push({
      id: id('executive_summary', 'pending'),
      section: 'executive_summary',
      title: `${pendingCount} Bekleyen Talep (%${pendingPct})`,
      description: `Toplam taleplerinizin %${pendingPct}'i hâlâ "Yeni Talep" durumunda bekliyor.`,
      severity: pendingPct > 40 ? 'critical' : pendingPct > 20 ? 'warning' : 'info',
      confidence: 99,
      recommendation: 'Otomasyon kuralları ekleyerek veya düzenli inceleme yaparak bekleme süresini kısaltın.',
    });
  }

  // ─── 2. Return Trends ──────────────────────────────────────────────────────
  insights.push({
    id: id('return_trends', 'volume'),
    section: 'return_trends',
    title: trendDelta > 10
      ? `İade Hacminde %${trendDelta} Artış`
      : trendDelta < -10
      ? `İade Hacminde %${Math.abs(trendDelta)} Düşüş`
      : 'İade Hacmi Stabil',
    description: trendDelta > 10
      ? `Son 2 haftada önceki 2 haftaya kıyasla %${trendDelta} daha fazla iade/değişim talebi alındı.`
      : trendDelta < -10
      ? `Son 2 haftada iade hacmi %${Math.abs(trendDelta)} geriledi. Müşteri memnuniyeti artıyor olabilir.`
      : `Son 4 haftada iade hacmi tutarlı seyrediyor (±%10 değişim).`,
    severity: trendDelta > 20 ? 'critical' : trendDelta > 10 ? 'warning' : trendDelta < -10 ? 'positive' : 'info',
    confidence: weeklyTrend.length >= 4 ? 80 : 55,
    recommendation: trendDelta > 10
      ? 'Artışın kaynağını belirlemek için ürün ve sebebi analiz edin. Otomasyon kurallarını güçlendirin.'
      : 'Mevcut müşteri deneyimi uygulamalarını sürdürün.',
  });

  // ─── 3. Exchange Trends ───────────────────────────────────────────────────
  insights.push({
    id: id('exchange_trends', 'rate'),
    section: 'exchange_trends',
    title: exchangeShare >= 30
      ? `Yüksek Değişim Oranı: %${exchangeShare}`
      : exchangeShare >= 10
      ? `Değişim Oranı: %${exchangeShare}`
      : `Düşük Değişim Talebi: %${exchangeShare}`,
    description: `${totalExchanges} değişim talebi toplam taleplerinizin %${exchangeShare}'ini oluşturuyor.`,
    severity: exchangeShare >= 30 ? 'positive' : exchangeShare < 5 && totalRequests > 20 ? 'info' : 'info',
    confidence: totalRequests >= 10 ? 85 : 60,
    recommendation: exchangeShare < 10
      ? 'Değişim seçeneğini müşterilere daha görünür hale getirerek iade yerine değişim tercihini artırabilirsiniz.'
      : 'Değişim sürecini hızlandırmak, müşteri bağlılığını artırır.',
  });

  // ─── 4. Top Returned Products ─────────────────────────────────────────────
  if (topReturnedProducts.length > 0) {
    const top = topReturnedProducts[0];
    insights.push({
      id: id('top_returned_products', 'leader'),
      section: 'top_returned_products',
      title: top.pct >= 30
        ? `Kritik: "${top.label}" İadelerin %${top.pct}'i`
        : `En Çok İade Edilen: "${top.label}" (%${top.pct})`,
      description: `"${top.label}" ${top.count} iade ile en sık iade edilen ürün. Toplam iadelerin %${top.pct}'ini oluşturuyor.`,
      severity: top.pct >= 30 ? 'critical' : top.pct >= 15 ? 'warning' : 'info',
      confidence: totalReturns >= 10 ? 90 : 65,
      recommendation: top.pct >= 20
        ? `"${top.label}" için ürün açıklamasını, beden rehberini veya fotoğrafları gözden geçirin. Kalite sorunlarını tedarikçiyle paylaşın.`
        : 'En çok iade edilen ürünlerin kalite ve açıklama doğruluğunu düzenli olarak kontrol edin.',
    });
  } else {
    insights.push({
      id: id('top_returned_products', 'empty'),
      section: 'top_returned_products',
      title: 'Ürün Verisi Yetersiz',
      description: 'İade taleplerinde yeterli ürün verisi bulunmuyor.',
      severity: 'info',
      confidence: 100,
      recommendation: 'İade formlarına zorunlu ürün alanı ekleyin.',
    });
  }

  // ─── 5. Top Return Reasons ────────────────────────────────────────────────
  if (topReturnReasons.length > 0) {
    const topReason = topReturnReasons[0];
    const reasonRecommendations: Record<string, string> = {
      'beden': 'Ürün sayfalarına kapsamlı bir beden rehberi ekleyin ve müşterilere beden danışmanlığı sunun.',
      'renk': 'Ürün fotoğraflarını gerçek renkleri yansıtacak şekilde güncelleyin, renk örnekleri ekleyin.',
      'kalite': 'Tedarikçi kalite kontrol süreçlerini güçlendirin ve müşteri geri bildirimlerini ürün geliştirmeye aktarın.',
      'hatalı': 'Sipariş hazırlama sürecini kontrol edin. Çift kontrol sistemi uygulayın.',
      'yanlış': 'Ambalajlama ve sipariş doğrulama adımlarını gözden geçirin.',
      'vazgeçtim': 'Ürün sayfasında müşteri yorumları ve "satın alanlar ne düşündü?" gibi sosyal kanıtı artırın.',
    };
    const matchedRec = Object.entries(reasonRecommendations).find(([key]) =>
      topReason.label.toLowerCase().includes(key),
    );
    insights.push({
      id: id('top_return_reasons', 'leader'),
      section: 'top_return_reasons',
      title: `En Sık İade Sebebi: "${topReason.label}"`,
      description: `"${topReason.label}" sebebi ${topReason.count} taleple tüm taleplerin %${topReason.pct}'ini oluşturuyor.`,
      severity: topReason.pct >= 40 ? 'critical' : topReason.pct >= 25 ? 'warning' : 'info',
      confidence: totalRequests >= 10 ? 88 : 60,
      recommendation: matchedRec
        ? matchedRec[1]
        : `"${topReason.label}" sebebini azaltmak için müşteri geri bildirimlerini inceleyip kök sebebi giderin.`,
    });
  }

  // ─── 6. Automation Performance ────────────────────────────────────────────
  const autoSeverity: InsightSeverity = automationMatchRate >= 60 ? 'positive' : automationMatchRate >= 30 ? 'info' : 'warning';
  insights.push({
    id: id('automation_performance', 'rate'),
    section: 'automation_performance',
    title: `Otomasyon Eşleşme Oranı: %${automationMatchRate}`,
    description: `${stats.totalAutomated} talep otomasyon kurallarıyla işlendi. ${
      topAutomationRules[0] ? `En aktif kural: "${topAutomationRules[0].ruleName}" (${topAutomationRules[0].count} eşleşme).` : ''
    }`,
    severity: autoSeverity,
    confidence: totalRequests >= 5 ? 90 : 55,
    recommendation: automationMatchRate < 30
      ? 'Otomasyon kurallarınızı genişletin. En yaygın senaryo ve ürün kategorileri için kural tanımlayın.'
      : automationMatchRate >= 70
      ? 'Otomasyon performansı mükemmel. Mevcut kuralları takip edin ve seyrek kullanılanları devre dışı bırakın.'
      : 'Orta düzey otomasyon oranı. Eşleşmeyen taleplerin ortak özelliklerini inceleyip yeni kurallar ekleyin.',
  });

  // ─── 7. Financial Impact ──────────────────────────────────────────────────
  const rejectionSavingsRate = totalAmount > 0 ? Math.round((rejectedAmount / totalAmount) * 100) : 0;
  insights.push({
    id: id('financial_impact', 'exposure'),
    section: 'financial_impact',
    title: `Toplam İade Tutarı: ₺${totalAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`,
    description: `Onaylanan iadeler ₺${approvedAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}, reddedilen iadeler ₺${rejectedAmount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} tutarında. Ortalama talep tutarı ₺${avgAmount.toFixed(0)}.`,
    severity: totalAmount > 50000 ? 'warning' : 'info',
    confidence: 99,
    recommendation: rejectionSavingsRate > 30
      ? 'Yüksek tutarlı retlerin gerekçelerini gözden geçirin. Haksız redler müşteri güvenini zedeleyebilir.'
      : 'Finansal maruziyeti azaltmak için yüksek tutarlı iadeler için ek doğrulama adımı ekleyin.',
  });

  // ─── 8. Customer Behaviour ────────────────────────────────────────────────
  insights.push({
    id: id('customer_behaviour', 'repeat'),
    section: 'customer_behaviour',
    title: repeatRate >= 25
      ? `Yüksek Tekrarlayan Müşteri Oranı: %${repeatRate}`
      : `Tekrarlayan Müşteri Oranı: %${repeatRate}`,
    description: `${totalUniqueCustomers} benzersiz müşteriden ${repeatCustomers}'i birden fazla iade/değişim talebi oluşturdu (%${repeatRate}). Ortalama çözüm süresi ${avgResolutionDays} gün.`,
    severity: repeatRate >= 30 ? 'warning' : repeatRate >= 15 ? 'info' : 'positive',
    confidence: totalUniqueCustomers >= 10 ? 85 : 55,
    recommendation: repeatRate >= 25
      ? 'Sık iade eden müşterileri izleyin. Ürün kalite sorununu mu, yoksa iade politikası kullanımını mı yansıttığını analiz edin.'
      : `Çözüm sürenizi ${avgResolutionDays > 3 ? 'kısaltmak' : 'korumak'} müşteri memnuniyetini ${avgResolutionDays > 3 ? 'artıracak' : 'sürdürecek'}.`,
  });

  // ─── 9. Actionable Recommendations ───────────────────────────────────────
  const recs: { title: string; description: string; recommendation: string; severity: InsightSeverity }[] = [];

  if (automationMatchRate < 40) {
    recs.push({
      title: 'Otomasyon Kapsamını Artırın',
      description: `Taleplerinizin yalnızca %${automationMatchRate}'i otomatik işleniyor. Manuel iş yükü yüksek.`,
      recommendation: 'En yaygın iade sebepleri ve tutarları için otomatik onay/ret kuralları tanımlayın.',
      severity: 'warning',
    });
  }
  if (pendingCount > 5) {
    recs.push({
      title: 'Bekleyen Talepler Acil',
      description: `${pendingCount} talep işlem bekliyor. Müşteri deneyimini olumsuz etkiliyor.`,
      recommendation: 'Günlük inceleme rutini oluşturun veya beklemedeki talepler için otomasyon ekleyin.',
      severity: pendingCount > 20 ? 'critical' : 'warning',
    });
  }
  if (topReturnedProducts[0]?.pct >= 25) {
    recs.push({
      title: 'Ürün Kalitesini Gözden Geçirin',
      description: `"${topReturnedProducts[0].label}" tüm iadelerin %${topReturnedProducts[0].pct}'ini oluşturuyor.`,
      recommendation: 'Ürün açıklaması, fotoğraflar ve tedarikçi kalite kontrolünü acilen inceleyin.',
      severity: 'critical',
    });
  }
  if (exchangeShare < 8 && totalRequests >= 20) {
    recs.push({
      title: 'Değişim Seçeneğini Öne Çıkarın',
      description: 'Değişim oranı düşük. Müşteriler iade yerine değişimi tercih ettiğinde gelir korunur.',
      recommendation: 'İade formunda değişim seçeneğini daha belirgin gösterin ve değişim avantajlarını vurgulayın.',
      severity: 'info',
    });
  }
  if (avgResolutionDays > 5) {
    recs.push({
      title: 'Çözüm Süresini Kısaltın',
      description: `Ortalama çözüm süresi ${avgResolutionDays} gün. Müşteri beklentisi genellikle 2-3 gündür.`,
      recommendation: 'Otomasyonu artırın ve bekleyen talepleri günlük gözden geçirin.',
      severity: 'warning',
    });
  }

  // Fallback recommendation if nothing specific
  if (recs.length === 0) {
    recs.push({
      title: 'Süreçleri Düzenli Takip Edin',
      description: 'Genel operasyon sağlıklı görünüyor. Trendleri takip etmeye devam edin.',
      recommendation: 'Haftalık iade raporunu gözden geçirin ve otomasyon kurallarını periyodik olarak güncelleyin.',
      severity: 'positive',
    });
  }

  for (let i = 0; i < Math.min(recs.length, 5); i++) {
    insights.push({
      id: id('actionable_recommendations', String(i)),
      section: 'actionable_recommendations',
      ...recs[i],
      confidence: 82,
    });
  }

  return insights;
}

// ─── OpenAI generator ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Sen bir e-ticaret iade yönetimi uzmanısın. Sana verilecek istatistiksel verileri analiz ederek JSON formatında içgörüler üret.

Her içgörü şu alanları içermeli:
- id: benzersiz string (section_suffix formatında)
- section: "executive_summary" | "return_trends" | "exchange_trends" | "top_returned_products" | "top_return_reasons" | "automation_performance" | "financial_impact" | "customer_behaviour" | "actionable_recommendations"
- title: kısa başlık (max 60 karakter)
- description: detaylı açıklama (2-3 cümle, verileri kullan)
- severity: "info" | "positive" | "warning" | "critical"
- confidence: 0-100 arası güven puanı (verinin kalitesine göre)
- recommendation: somut, uygulanabilir öneri

Her section için en az 1 içgörü üret. Yanıtını yalnızca JSON array olarak ver, başka hiçbir şey ekleme.`;

export async function generateAIInsights(stats: MerchantStats): Promise<Insight[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  const prompt = `Aşağıdaki istatistikleri analiz et ve içgörüler üret:

${JSON.stringify(stats, null, 2)}

JSON array olarak içgörüleri döndür:`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    });

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw);
    const arr: Insight[] = Array.isArray(parsed) ? parsed : (parsed.insights ?? []);

    if (!Array.isArray(arr) || arr.length === 0) return null;

    // Validate and sanitize each insight
    const valid = arr.filter(
      (item) =>
        item.id && item.section && item.title && item.description &&
        item.severity && typeof item.confidence === 'number' && item.recommendation,
    );

    return valid.length > 0 ? valid : null;
  } catch (err) {
    console.error('OpenAI insight generation failed:', err);
    return null;
  }
}
