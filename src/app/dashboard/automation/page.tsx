'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TokenHelpers } from '@/helpers/token-helpers';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { Check, ChevronDown, ChevronUp, Clock, Copy, Plus, Trash2, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type Condition = {
  field: string;
  operator: string;
  value: string;
};

type AutomationRule = {
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  condition_logic: 'AND' | 'OR';
  conditions: Condition[];
  action: 'auto_approve' | 'auto_reject' | 'move_to_review';
  action_note: string | null;
  created_at: string;
};

type RuleStats = Record<string, { count: number; last_triggered: string | null }>;

// ─── Engine config ─────────────────────────────────────────────────────────────

type FieldType = 'number' | 'text' | 'reason_select' | 'presence';

const FIELDS: { value: string; label: string; type: FieldType }[] = [
  { value: 'amount', label: 'İade Tutarı', type: 'number' },
  { value: 'reason', label: 'İade Sebebi', type: 'reason_select' },
  { value: 'customer_name', label: 'Müşteri Adı', type: 'text' },
  { value: 'customer_email', label: 'Müşteri E-postası', type: 'text' },
  { value: 'order_id', label: 'Sipariş No', type: 'text' },
  { value: 'product', label: 'Ürün Adı', type: 'text' },
  { value: 'description', label: 'Müşteri Notu', type: 'text' },
  { value: 'media_urls', label: 'Fotoğraf / Video', type: 'presence' },
];

const OPERATORS: Record<FieldType, { value: string; label: string }[]> = {
  number: [
    { value: 'lt', label: 'küçüktür' },
    { value: 'lte', label: 'küçük veya eşittir' },
    { value: 'gt', label: 'büyüktür' },
    { value: 'gte', label: 'büyük veya eşittir' },
    { value: 'eq', label: 'eşittir' },
  ],
  text: [
    { value: 'contains', label: 'içerir' },
    { value: 'not_contains', label: 'içermez' },
    { value: 'eq', label: 'eşittir' },
    { value: 'ends_with', label: 'ile biter' },
    { value: 'is_empty', label: 'boş' },
    { value: 'is_not_empty', label: 'dolu' },
  ],
  reason_select: [
    { value: 'eq', label: 'eşittir' },
    { value: 'not_eq', label: 'eşit değildir' },
  ],
  presence: [
    { value: 'is_not_empty', label: 'mevcut' },
    { value: 'is_empty', label: 'mevcut değil' },
  ],
};

const REASON_OPTIONS = ['Küçük geldi', 'Büyük geldi', 'Hasarlı geldi', 'Yanlış ürün geldi', 'Diğer'];

function fieldType(field: string): FieldType {
  return FIELDS.find((f) => f.value === field)?.type ?? 'text';
}

function defaultOperator(ft: FieldType): string {
  return OPERATORS[ft][0].value;
}

function needsValueInput(operator: string): boolean {
  return operator !== 'is_empty' && operator !== 'is_not_empty';
}

function conditionSummary(c: Condition): string {
  const fieldLabel = FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
  const ft = fieldType(c.field);
  const opLabel = OPERATORS[ft].find((o) => o.value === c.operator)?.label ?? c.operator;
  if (!needsValueInput(c.operator)) return `${fieldLabel} ${opLabel}`;
  const valueLabel = c.field === 'amount' ? `₺${c.value}` : c.value;
  return `${fieldLabel} ${opLabel} ${valueLabel}`;
}

function emptyCondition(): Condition {
  return { field: 'amount', operator: 'lt', value: '' };
}

function emptyRule(): Omit<AutomationRule, 'id' | 'created_at'> {
  return {
    name: '',
    enabled: true,
    priority: 0,
    condition_logic: 'AND',
    conditions: [emptyCondition()],
    action: 'auto_approve',
    action_note: '',
  };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function validateCondition(c: Condition): boolean {
  if (!needsValueInput(c.operator)) return true;
  const val = c.value.trim();
  if (!val) return false;
  if (fieldType(c.field) === 'number') {
    const n = Number(val);
    return !isNaN(n) && isFinite(n);
  }
  return true;
}

// ─── Condition row ─────────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
  canRemove,
  hasError,
}: {
  condition: Condition;
  onChange: (c: Condition) => void;
  onRemove: () => void;
  canRemove: boolean;
  hasError: boolean;
}) {
  const ft = fieldType(condition.field);

  const handleFieldChange = (field: string) => {
    const newFt = fieldType(field);
    onChange({ field, operator: defaultOperator(newFt), value: '' });
  };

  const handleOperatorChange = (operator: string) => {
    onChange({ ...condition, operator, value: needsValueInput(operator) ? condition.value : '' });
  };

  return (
    <div className={cn(
      'flex items-center gap-2 flex-wrap sm:flex-nowrap rounded-lg p-1',
      hasError && 'ring-1 ring-destructive/50 bg-destructive/5',
    )}>
      <select
        value={condition.field}
        onChange={(e) => handleFieldChange(e.target.value)}
        className="flex-shrink-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {FIELDS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>

      <select
        value={condition.operator}
        onChange={(e) => handleOperatorChange(e.target.value)}
        className="flex-shrink-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {OPERATORS[ft].map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {needsValueInput(condition.operator) && (
        ft === 'reason_select' ? (
          <select
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Sebep seçin...</option>
            {REASON_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : ft === 'number' ? (
          <Input
            type="number"
            min="0"
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Değer..."
            className="flex-1 min-w-0 h-8 text-xs"
          />
        ) : (
          <Input
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
            placeholder="Değer..."
            className="flex-1 min-w-0 h-8 text-xs"
          />
        )
      )}

      <button
        onClick={onRemove}
        disabled={!canRemove}
        className="flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-30 transition-colors"
        aria-label="Koşulu kaldır"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({
  rule,
  isFirst,
  isLast,
  ruleStats,
  onEdit,
  onDeleteRequest,
  onToggle,
  onMoveUp,
  onMoveDown,
  onDuplicate,
}: {
  rule: AutomationRule;
  isFirst: boolean;
  isLast: boolean;
  ruleStats: { count: number; last_triggered: string | null } | undefined;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onToggle: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDuplicate: () => void;
}) {
  const actionBadgeLabel =
    rule.action === 'auto_approve' ? '✓ Otomatik Onayla' :
    rule.action === 'auto_reject' ? '✗ Otomatik Reddet' :
    '→ İncelemeye Gönder';

  const actionBadgeVariant: 'approved' | 'rejected' | 'secondary' =
    rule.action === 'auto_approve' ? 'approved' :
    rule.action === 'auto_reject' ? 'rejected' :
    'secondary';

  const actionColorClass =
    rule.action === 'auto_approve'
      ? 'bg-emerald-100 text-emerald-700'
      : rule.action === 'auto_reject'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700';

  return (
    <div className={cn(
      'rounded-xl border border-border bg-card p-5 shadow-xs transition-opacity',
      !rule.enabled && 'opacity-50',
    )}>
      <div className="flex items-start justify-between gap-3">
        {/* Left: name + summary */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{rule.name}</span>
            <Badge variant={actionBadgeVariant}>{actionBadgeLabel}</Badge>
            {!rule.enabled && <Badge variant="secondary">Pasif</Badge>}
          </div>

          {/* Condition summary — stacked with logic connectors */}
          {rule.conditions.length > 0 && (
            <div className="mt-2.5 space-y-1">
              {rule.conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  {i > 0 ? (
                    <span className="text-[10px] font-bold uppercase text-muted-foreground/50 w-8 text-right shrink-0">
                      {rule.condition_logic === 'AND' ? 'VE' : 'VEYA'}
                    </span>
                  ) : (
                    <span className="w-8 shrink-0" />
                  )}
                  <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {conditionSummary(c)}
                  </span>
                </div>
              ))}
              {/* Action arrow */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-muted-foreground/40 w-8 text-right shrink-0">↓</span>
                <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', actionColorClass)}>
                  {actionBadgeLabel}
                </span>
              </div>
            </div>
          )}

          {rule.action_note && (
            <p className="mt-2 text-[11px] text-muted-foreground italic">Not: {rule.action_note}</p>
          )}

          {/* Stats: last triggered + count */}
          {ruleStats && ruleStats.count > 0 && (
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {ruleStats.count} kez uygulandı
              </span>
              {ruleStats.last_triggered && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(ruleStats.last_triggered)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* Enable toggle */}
          <button
            onClick={onToggle}
            aria-label={rule.enabled ? 'Pasif yap' : 'Aktif yap'}
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none',
              rule.enabled ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span className={cn(
              'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
              rule.enabled ? 'translate-x-4' : 'translate-x-0.5',
            )} />
          </button>

          {/* Priority + action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={onMoveUp}
              disabled={isFirst}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Yukarı taşı"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onMoveDown}
              disabled={isLast}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-30 transition-colors"
              aria-label="Aşağı taşı"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onDuplicate}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Kopyala"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <Button variant="outline" size="sm" onClick={onEdit} className="h-7 px-2.5 text-xs">Düzenle</Button>
            <button
              onClick={onDeleteRequest}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
              aria-label="Sil"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete confirm dialog ─────────────────────────────────────────────────────

function DeleteConfirmDialog({
  ruleName,
  onConfirm,
  onCancel,
}: {
  ruleName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-semibold">Kuralı Sil</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-medium">&ldquo;{ruleName}&rdquo;</span> kuralı kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onCancel}>İptal</Button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors"
          >
            Sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Rule editor drawer ────────────────────────────────────────────────────────

function RuleEditor({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: Omit<AutomationRule, 'id' | 'created_at'>;
  onClose: () => void;
  onSave: (rule: Omit<AutomationRule, 'id' | 'created_at'>) => Promise<void>;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const prevOpenRef = useRef(false);

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setDraft(initial);
      setShowErrors(false);
    }
    prevOpenRef.current = open;
  }, [open, initial]);

  const updateCondition = (i: number, c: Condition) => {
    setDraft((d) => {
      const conds = [...d.conditions];
      conds[i] = c;
      return { ...d, conditions: conds };
    });
  };

  const addCondition = () =>
    setDraft((d) => ({ ...d, conditions: [...d.conditions, emptyCondition()] }));

  const removeCondition = (i: number) =>
    setDraft((d) => ({ ...d, conditions: d.conditions.filter((_, idx) => idx !== i) }));

  const isNameValid = draft.name.trim().length > 0;
  const conditionErrors = draft.conditions.map((c) => !validateCondition(c));
  const isValid = isNameValid && draft.conditions.length > 0 && !!draft.action && conditionErrors.every((e) => !e);

  const handleSaveClick = async () => {
    if (!isValid) {
      setShowErrors(true);
      return;
    }
    await onSave(draft);
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={onClose} />}

      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-[480px] bg-card border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <h2 className="text-sm font-semibold">{initial.name ? 'Kuralı Düzenle' : 'Yeni Kural'}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Kapat"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Kural Adı <span className="text-destructive">*</span>
            </label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Örn: Düşük Tutarlı Otomatik Onay"
              className={cn('text-sm', showErrors && !isNameValid && 'border-destructive focus-visible:ring-destructive')}
            />
            {showErrors && !isNameValid && (
              <p className="mt-1 text-[11px] text-destructive">Kural adı gereklidir.</p>
            )}
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aktif</p>
              <p className="text-xs text-muted-foreground mt-0.5">Kapalıyken kural değerlendirilmez.</p>
            </div>
            <button
              onClick={() => setDraft((d) => ({ ...d, enabled: !d.enabled }))}
              aria-label="Aktif/pasif"
              className={cn(
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                draft.enabled ? 'bg-primary' : 'bg-muted',
              )}
            >
              <span className={cn(
                'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                draft.enabled ? 'translate-x-4' : 'translate-x-0.5',
              )} />
            </button>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Koşullar <span className="text-destructive">*</span>
              </p>
              <div className="flex rounded-lg border border-border overflow-hidden text-xs font-medium">
                {(['AND', 'OR'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setDraft((d) => ({ ...d, condition_logic: l }))}
                    className={cn(
                      'px-3 py-1.5 transition-colors',
                      draft.condition_logic === l ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {l === 'AND' ? 'VE (tümü)' : 'VEYA (biri)'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              {draft.conditions.map((c, i) => (
                <ConditionRow
                  key={i}
                  condition={c}
                  onChange={(updated) => updateCondition(i, updated)}
                  onRemove={() => removeCondition(i)}
                  canRemove={draft.conditions.length > 1}
                  hasError={showErrors && conditionErrors[i]}
                />
              ))}
            </div>
            {showErrors && conditionErrors.some(Boolean) && (
              <p className="mt-1 text-[11px] text-destructive">Tüm koşul değerleri dolu ve geçerli olmalıdır.</p>
            )}

            <button
              onClick={addCondition}
              className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors w-full justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              Koşul Ekle
            </button>
          </div>

          {/* Action */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Eylem <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setDraft((d) => ({ ...d, action: 'auto_approve' }))}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-colors',
                  draft.action === 'auto_approve'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-border text-muted-foreground hover:border-muted-foreground',
                )}
              >
                <Check className="h-4 w-4" />
                Onayla
              </button>
              <button
                onClick={() => setDraft((d) => ({ ...d, action: 'auto_reject' }))}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-colors',
                  draft.action === 'auto_reject'
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-border text-muted-foreground hover:border-muted-foreground',
                )}
              >
                <X className="h-4 w-4" />
                Reddet
              </button>
              <button
                onClick={() => setDraft((d) => ({ ...d, action: 'move_to_review' }))}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 px-3 py-3 text-xs font-semibold transition-colors',
                  draft.action === 'move_to_review'
                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                    : 'border-border text-muted-foreground hover:border-muted-foreground',
                )}
              >
                <Zap className="h-4 w-4" />
                İncelemeye Gönder
              </button>
            </div>
          </div>

          {/* Action note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Otomatik Not <span className="font-normal normal-case text-muted-foreground/60">(opsiyonel)</span>
            </label>
            <Textarea
              value={draft.action_note ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, action_note: e.target.value }))}
              rows={2}
              placeholder="Talebin üzerine eklenecek not..."
              className="text-xs"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-2 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>İptal</Button>
          <Button className="flex-1" onClick={handleSaveClick} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function AutomationPage() {
  const [token, setToken] = useState<string | null>(null);
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [stats, setStats] = useState<RuleStats>({});
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { settings, loadSettings } = useStoreSettings();

  const fetchRules = useCallback(async (t: string) => {
    const res = await fetch('/api/automation/rules', { headers: { Authorization: `JWT ${t}` } });
    if (!res.ok) { toast('Kurallar yüklenemedi', 'error'); setLoading(false); return; }
    const { data } = await res.json();
    setRules(data ?? []);
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async (t: string) => {
    const res = await fetch('/api/automation/stats', { headers: { Authorization: `JWT ${t}` } });
    if (!res.ok) return;
    const { data } = await res.json();
    setStats(data ?? {});
  }, []);

  useEffect(() => {
    AppBridgeHelper.closeLoader();
  }, []);

  useEffect(() => {
    const init = async () => {
      const t = await TokenHelpers.getTokenForIframeApp();
      setToken(t);
      if (t) {
        await Promise.all([fetchRules(t), fetchStats(t)]);
      } else {
        setLoading(false);
      }
      await loadSettings();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditingRule(null);
    setDrawerOpen(true);
  };

  const openEdit = (rule: AutomationRule) => {
    setEditingRule(rule);
    setDrawerOpen(true);
  };

  const closeDrawer = () => setDrawerOpen(false);

  const handleSave = async (draft: Omit<AutomationRule, 'id' | 'created_at'>) => {
    if (!token) return;
    setSaving(true);

    if (editingRule) {
      const res = await fetch(`/api/automation/rules/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
        body: JSON.stringify(draft),
      });
      setSaving(false);
      if (!res.ok) { toast('Kural güncellenemedi', 'error'); return; }
      toast('Kural güncellendi', 'success');
    } else {
      const res = await fetch('/api/automation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
        body: JSON.stringify(draft),
      });
      setSaving(false);
      if (!res.ok) { toast('Kural oluşturulamadı', 'error'); return; }
      toast('Kural oluşturuldu', 'success');
    }

    setDrawerOpen(false);
    await fetchRules(token);
  };

  const handleDeleteRequest = (id: string) => setConfirmDeleteId(id);

  const handleDeleteConfirm = async () => {
    if (!token || !confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    const res = await fetch(`/api/automation/rules/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `JWT ${token}` },
    });
    if (!res.ok) { toast('Kural silinemedi', 'error'); return; }
    toast('Kural silindi', 'success');
    await fetchRules(token);
  };

  const handleToggle = async (rule: AutomationRule) => {
    if (!token) return;
    const res = await fetch(`/api/automation/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    if (!res.ok) { toast('Durum güncellenemedi', 'error'); return; }
    await fetchRules(token);
  };

  const handleMove = async (rule: AutomationRule, direction: 'up' | 'down') => {
    if (!token) return;
    const idx = rules.findIndex((r) => r.id === rule.id);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= rules.length) return;

    // Reorder and assign sequential priorities to prevent duplicates
    const reordered = [...rules];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(newIdx, 0, moved);

    await Promise.all(
      reordered.map((r, i) =>
        fetch(`/api/automation/rules/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
          body: JSON.stringify({ priority: i }),
        })
      )
    );

    await fetchRules(token);
  };

  const handleDuplicate = async (rule: AutomationRule) => {
    if (!token) return;
    const draft = {
      name: `${rule.name} (Kopya)`,
      enabled: false,
      priority: rules.length,
      condition_logic: rule.condition_logic,
      conditions: rule.conditions,
      action: rule.action,
      action_note: rule.action_note,
    };
    const res = await fetch('/api/automation/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
      body: JSON.stringify(draft),
    });
    if (!res.ok) { toast('Kural kopyalanamadı', 'error'); return; }
    toast('Kural kopyalandı (pasif olarak eklendi)', 'success');
    await fetchRules(token);
  };

  const confirmDeleteRule = rules.find((r) => r.id === confirmDeleteId);

  const drawerInitial: Omit<AutomationRule, 'id' | 'created_at'> = editingRule
    ? {
        name: editingRule.name,
        enabled: editingRule.enabled,
        priority: editingRule.priority,
        condition_logic: editingRule.condition_logic,
        conditions: editingRule.conditions.length > 0 ? editingRule.conditions : [emptyCondition()],
        action: editingRule.action,
        action_note: editingRule.action_note,
      }
    : emptyRule();

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="flex h-full overflow-hidden">
        {/* Main content */}
        <div className={cn('flex-1 overflow-y-auto transition-all duration-300', drawerOpen ? 'lg:mr-[480px]' : '')}>
          <div className="p-6 md:p-8 space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Otomasyon Kuralları</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Koşullara göre iadeleri otomatik olarak onayla, reddet veya incelemeye gönder.
                </p>
              </div>
              <Button size="sm" onClick={openNew} className="shrink-0 gap-2">
                <Plus className="h-3.5 w-3.5" />
                Yeni Kural Ekle
              </Button>
            </div>

            {/* How it works */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Zap className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Kurallar nasıl çalışır?</p>
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    Her yeni iade talebi alındığında kurallar <strong>öncelik sırasına</strong> göre değerlendirilir.
                    Koşulları sağlayan <strong>ilk kural</strong> uygulanır ve değerlendirme durur.
                  </p>
                </div>
              </div>
            </div>

            {/* Rules list */}
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-xl border border-border bg-card p-5">
                    <Skeleton className="h-4 w-48 mb-3" />
                    <Skeleton className="h-3 w-72 mb-2" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                ))}
              </div>
            ) : rules.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <Zap className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Henüz otomasyon kuralı yok.</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  İlk kuralını oluşturarak iadeleri otomatik olarak yönetmeye başla.
                </p>
                <div className="mt-5 space-y-2 text-left max-w-sm mx-auto">
                  <p className="text-xs font-medium text-muted-foreground">Örnek kurallar:</p>
                  {[
                    { label: 'Düşük Tutarlı Otomatik Onay', summary: 'Tutar < ₺100 → Onayla' },
                    { label: 'Kanıtsız Talep Reddi', summary: 'Fotoğraf yok VE Not boş → Reddet' },
                    { label: 'Hasar Otomatik İnceleme', summary: 'Sebep = Hasarlı geldi → İncelemeye Gönder' },
                  ].map((ex) => (
                    <div key={ex.label} className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                      <p className="text-xs font-semibold">{ex.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{ex.summary}</p>
                    </div>
                  ))}
                </div>
                <Button size="sm" onClick={openNew} className="mt-6 gap-2">
                  <Plus className="h-3.5 w-3.5" />
                  İlk Kuralı Oluştur
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, idx) => (
                  <RuleCard
                    key={rule.id}
                    rule={rule}
                    isFirst={idx === 0}
                    isLast={idx === rules.length - 1}
                    ruleStats={stats[rule.id]}
                    onEdit={() => openEdit(rule)}
                    onDeleteRequest={() => handleDeleteRequest(rule.id)}
                    onToggle={() => handleToggle(rule)}
                    onMoveUp={() => handleMove(rule, 'up')}
                    onMoveDown={() => handleMove(rule, 'down')}
                    onDuplicate={() => handleDuplicate(rule)}
                  />
                ))}

                <p className="text-xs text-muted-foreground text-center pt-1">
                  {rules.length} kural · Öncelik sırası yukarıdan aşağıya doğrudur.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Rule editor drawer */}
        <RuleEditor
          open={drawerOpen}
          initial={drawerInitial}
          onClose={closeDrawer}
          onSave={handleSave}
          saving={saving}
        />
      </div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && confirmDeleteRule && (
        <DeleteConfirmDialog
          ruleName={confirmDeleteRule.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </DashboardShell>
  );
}
