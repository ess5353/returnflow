'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { Loader2, Mail, RotateCcw, Send } from 'lucide-react';
import {
  DEFAULT_TEMPLATES,
  SUPPORTED_VARIABLES,
  SAMPLE_VARS,
  TEMPLATE_META,
  renderTemplate,
  type TemplateType,
} from '@/lib/email/templates';
import { PageHelp } from '@/components/ui/page-help';

const TEMPLATE_TYPES: TemplateType[] = [
  'return_approved',
  'return_rejected',
  'exchange_approved',
  'exchange_rejected',
  'return_completed',
  'exchange_completed',
];

type Templates = Record<TemplateType, { subject: string; html: string }>;

export default function EmailTemplatesPage() {
  const { authHeader } = useAuth();
  const { settings, loadSettings } = useStoreSettings();
  const tokenRef = useRef('');
  const [selected, setSelected] = useState<TemplateType>('return_approved');
  const [templates, setTemplates] = useState<Templates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadTemplates = useCallback(async (token: string) => {
    const res = await fetch('/api/email-templates', {
      headers: { Authorization: token ?? '' },
    });
    if (res.ok) {
      const json = await res.json();
      setTemplates(json.data as Templates);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    if (authHeader) {
      tokenRef.current = authHeader;
      loadTemplates(authHeader);
    }
    loadSettings(authHeader);
  }, [authHeader, loadTemplates, loadSettings]);

  useEffect(() => {
    if (!templates?.[selected]) return;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      setPreviewHtml(renderTemplate(templates[selected].html, SAMPLE_VARS));
    }, 500);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [templates, selected]);

  const updateField = (field: 'subject' | 'html', value: string) => {
    setTemplates((prev) => {
      if (!prev) return prev;
      return { ...prev, [selected]: { ...prev[selected], [field]: value } };
    });
  };

  const save = async () => {
    if (!templates?.[selected]) return;
    setSaving(true);
    const res = await fetch(`/api/email-templates/${selected}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: tokenRef.current },
      body: JSON.stringify(templates[selected]),
    });
    setSaving(false);
    if (res.ok) toast('Şablon kaydedildi', 'success');
    else toast('Kayıt başarısız', 'error');
  };

  const reset = async () => {
    const res = await fetch(`/api/email-templates/${selected}`, {
      method: 'DELETE',
      headers: { Authorization: tokenRef.current },
    });
    if (res.ok) {
      setTemplates((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [selected]: {
            subject: TEMPLATE_META[selected].defaultSubject,
            html: DEFAULT_TEMPLATES[selected],
          },
        };
      });
      toast('Varsayılana döndürüldü', 'success');
    } else {
      toast('İşlem başarısız', 'error');
    }
  };

  const sendTest = async () => {
    setTesting(true);
    const res = await fetch('/api/email-templates/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: tokenRef.current },
      body: JSON.stringify({ template_type: selected }),
    });
    setTesting(false);
    if (res.ok) {
      const j = await res.json();
      toast(`Test e-postası gönderildi → ${j.sent_to}`, 'success');
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j.error ?? 'Gönderilemedi', 'error');
    }
  };

  const insertVariable = (varKey: string) => {
    const ta = document.getElementById('html-editor') as HTMLTextAreaElement | null;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const insert = `{{${varKey}}}`;
    updateField('html', value.slice(0, start) + insert + value.slice(end));
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + insert.length;
      ta.focus();
    }, 10);
  };

  const wrapSelection = (before: string, after: string) => {
    const ta = document.getElementById('html-editor') as HTMLTextAreaElement | null;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    updateField('html', value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end));
    setTimeout(() => {
      ta.selectionStart = start + before.length;
      ta.selectionEnd = end + before.length;
      ta.focus();
    }, 10);
  };

  const current = templates?.[selected];

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="flex flex-col h-full">
        {/* Mobile template selector */}
        <div className="md:hidden border-b border-border px-4 py-3 shrink-0">
          <select
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value as TemplateType)}
          >
            {TEMPLATE_TYPES.map((type) => (
              <option key={type} value={type}>{TEMPLATE_META[type].label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left panel - desktop only */}
          <div className="hidden md:block w-52 shrink-0 border-r border-border overflow-y-auto py-4 px-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Şablonlar
            </p>
            <div className="space-y-0.5">
              {TEMPLATE_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setSelected(type)}
                  className={cn(
                    'w-full text-left rounded-lg px-3 py-2.5 text-sm transition-colors',
                    selected === type
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {TEMPLATE_META[type].label}
                </button>
              ))}
            </div>
          </div>

          {/* Right area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : current ? (
            <div className="max-w-3xl mx-auto space-y-4">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{TEMPLATE_META[selected].label}</h2>
                    <PageHelp title="E-posta Şablonları" content={<p>Müşterilere gönderilen otomatik e-postaların içeriğini düzenleyin. {"{{customer_name}}"}, {"{{order_number}}"} gibi değişkenler kullanabilirsiniz. &quot;Test Et&quot; ile gerçek bir test e-postası gönderin. RESEND_API_KEY ve RESEND_FROM_EMAIL tanımlı olmalıdır.</p>} />
                  </div>
                  <p className="text-sm text-muted-foreground">{TEMPLATE_META[selected].description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={reset}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Varsayılan
                  </Button>
                  <Button variant="outline" size="sm" onClick={sendTest} disabled={testing}>
                    {testing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Test Gönder
                  </Button>
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Mail className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Kaydet
                  </Button>
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label htmlFor="subject" className="text-sm">
                  Konu
                </Label>
                <Input
                  id="subject"
                  value={current.subject}
                  onChange={(e) => updateField('subject', e.target.value)}
                  className="mt-1.5 font-mono text-sm"
                  placeholder="E-posta konusu..."
                />
              </div>

              {/* Edit / Preview toggle */}
              <div className="flex items-center justify-between">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  {(['edit', 'preview'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        'px-4 py-1.5 text-sm font-medium transition-colors',
                        activeTab === tab
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {tab === 'edit' ? 'Düzenle' : 'Önizleme'}
                    </button>
                  ))}
                </div>

                {activeTab === 'edit' && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => wrapSelection('<strong>', '</strong>')}
                      className="px-2 py-1 text-xs font-bold border border-border rounded hover:bg-accent transition-colors"
                      title="Kalın"
                    >
                      B
                    </button>
                    <button
                      onClick={() => wrapSelection('<em>', '</em>')}
                      className="px-2 py-1 text-xs italic border border-border rounded hover:bg-accent transition-colors"
                      title="İtalik"
                    >
                      I
                    </button>
                    <button
                      onClick={() => wrapSelection('<u>', '</u>')}
                      className="px-2 py-1 text-xs underline border border-border rounded hover:bg-accent transition-colors"
                      title="Altı Çizili"
                    >
                      U
                    </button>
                    <div className="w-px h-5 bg-border mx-1" />
                    <select
                      className="text-xs border border-border rounded px-1.5 py-1 bg-background hover:bg-accent transition-colors"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) insertVariable(e.target.value);
                        e.target.value = '';
                      }}
                    >
                      <option value="">Değişken ekle</option>
                      {SUPPORTED_VARIABLES.map(({ key, label }) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {activeTab === 'edit' ? (
                <textarea
                  id="html-editor"
                  value={current.html}
                  onChange={(e) => updateField('html', e.target.value)}
                  className="w-full h-96 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="HTML içerik..."
                  spellCheck={false}
                />
              ) : (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full h-[600px] rounded-md border border-border bg-white"
                  sandbox="allow-same-origin"
                  title="E-posta önizlemesi"
                />
              )}

              {/* Variable chips */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Desteklenen Değişkenler — tıklayarak ekle
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORTED_VARIABLES.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => insertVariable(key)}
                      title={label}
                      className="text-xs font-mono bg-muted hover:bg-accent border border-border rounded px-2 py-1 transition-colors"
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
