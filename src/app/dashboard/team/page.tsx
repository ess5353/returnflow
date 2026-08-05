'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppBridgeHelper } from '@ikas/app-helpers';
import { useAuth } from '@/hooks/use-auth';
import { useStoreSettings } from '@/app/hooks/use-store-settings';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { ALL_PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, getEffectivePermissions, type Permission, type Role } from '@/lib/auth/permissions';
import { Check, Copy, Link2, Loader2, MoreVertical, Plus, RefreshCw, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Dialog from '@radix-ui/react-dialog';
import { PageHelp } from '@/components/ui/page-help';

type MemberStatus = 'invited' | 'active' | 'disabled';

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  custom_permissions: string[] | null;
  status: MemberStatus;
  invited_at: string;
  joined_at: string | null;
  created_at: string;
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  invited: 'Davet Bekliyor',
  active: 'Aktif',
  disabled: 'Devre Dışı',
};

const STATUS_COLORS: Record<MemberStatus, string> = {
  invited: 'bg-yellow-100 text-yellow-800',
  active: 'bg-emerald-100 text-emerald-800',
  disabled: 'bg-gray-100 text-gray-600',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  'returns.view': 'İadeleri Görüntüle',
  'returns.approve': 'İade Onayla',
  'returns.reject': 'İade Reddet',
  'returns.complete': 'İade Tamamla',
  'automation.view': 'Otomasyonu Görüntüle',
  'automation.create': 'Otomasyon Oluştur',
  'automation.edit': 'Otomasyonu Düzenle',
  'automation.delete': 'Otomasyonu Sil',
  'analytics.view': 'Analiz Görüntüle',
  'export.generate': 'Dışa Aktar',
  'settings.edit': 'Ayarları Düzenle',
  'email_templates.edit': 'E-posta Şablonu Düzenle',
  'api.manage': 'API Yönet',
  'webhooks.manage': 'Webhook Yönet',
  'billing.manage': 'Faturalamayı Yönet',
  'team.manage': 'Takım Yönet',
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} className="gap-2 text-xs h-8">
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? 'Kopyalandı' : label}
    </Button>
  );
}

function InviteModal({
  open, onClose, onInvited, authHeader,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: (member: TeamMember & { invite_url: string }) => void;
  authHeader: string;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('support');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const res = await fetch('/api/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ email: email.trim(), name: name.trim() || undefined, role }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Davet gönderilemedi.'); setLoading(false); return; }
    onInvited(json.data);
    setEmail(''); setName(''); setRole('support');
    setLoading(false);
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-card border border-border rounded-xl shadow-xl z-50 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">Üye Davet Et</Dialog.Title>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <Dialog.Description className="text-xs text-muted-foreground">
            Ekibinize e-posta ile davet gönderin ve rol tabanlı erişim tanımlayın.
          </Dialog.Description>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">E-posta *</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@sirket.com" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Ad (opsiyonel)</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ad Soyad" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Rol</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLES.filter((r) => r !== 'owner').map((r) => (
                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                ))}
              </select>
            </div>

            {/* Permission preview */}
            <div className="rounded-lg bg-muted/40 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bu rol şu izinleri içerir:</p>
              <div className="flex flex-wrap gap-1.5">
                {(ROLE_PERMISSIONS[role] as string[]).includes('*')
                  ? <span className="text-xs bg-primary/10 text-primary rounded px-2 py-0.5">Tüm izinler</span>
                  : (ROLE_PERMISSIONS[role] as Permission[]).map((p) => (
                    <span key={p} className="text-xs bg-muted text-muted-foreground rounded px-2 py-0.5">{PERMISSION_LABELS[p]}</span>
                  ))}
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">İptal</Button>
            <Button size="sm" onClick={handleSubmit} disabled={loading || !email.trim()} className="flex-1 gap-2">
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Davet Gönder
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PermissionsModal({
  open, onClose, member, authHeader, onUpdated,
}: {
  open: boolean;
  onClose: () => void;
  member: TeamMember;
  authHeader: string;
  onUpdated: (id: string, updates: Partial<TeamMember>) => void;
}) {
  const basePerms = getEffectivePermissions(member.role, []);
  const [customPerms, setCustomPerms] = useState<string[]>(member.custom_permissions ?? []);
  const [saving, setSaving] = useState(false);

  const effective = getEffectivePermissions(member.role, customPerms);

  function togglePerm(p: Permission) {
    setCustomPerms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  }

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ custom_permissions: customPerms }),
    });
    setSaving(false);
    if (res.ok) {
      onUpdated(member.id, { custom_permissions: customPerms });
      toast('İzinler güncellendi', 'success');
      onClose();
    } else {
      toast('Güncelleme başarısız', 'error');
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card border border-border rounded-xl shadow-xl z-50 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold">
              İzinler — {member.email}
            </Dialog.Title>
            <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>

          <Dialog.Description className="text-xs text-muted-foreground">
            Rol: <span className="font-medium">{ROLE_LABELS[member.role]}</span>. Ek izinler seçerek genişletebilirsiniz.
          </Dialog.Description>

          <div className="space-y-1">
            {ALL_PERMISSIONS.map((p) => {
              const inBase = basePerms.includes('*') || basePerms.includes(p);
              const inCustom = customPerms.includes(p);
              const hasIt = effective.includes('*') || effective.includes(p);
              return (
                <label key={p} className={cn('flex items-center gap-3 rounded-lg px-3 py-2 cursor-pointer hover:bg-muted/40', hasIt && 'bg-muted/20')}>
                  <input
                    type="checkbox"
                    checked={hasIt}
                    disabled={inBase && !inCustom}
                    onChange={() => togglePerm(p)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="text-sm flex-1">{PERMISSION_LABELS[p]}</span>
                  {inBase && <span className="text-[10px] text-muted-foreground">Rolden</span>}
                  {!inBase && inCustom && <span className="text-[10px] text-primary">Özel</span>}
                </label>
              );
            })}
          </div>

          <div className="flex gap-2 pt-1 border-t border-border">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">İptal</Button>
            <Button size="sm" onClick={save} disabled={saving} className="flex-1 gap-2">
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function MemberRow({
  member, authHeader, onRemove, onUpdate,
}: {
  member: TeamMember;
  authHeader: string;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<TeamMember>) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [permOpen, setPermOpen] = useState(false);

  async function changeRole(newRole: Role) {
    const res = await fetch(`/api/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ role: newRole }),
    });
    if (res.ok) { onUpdate(member.id, { role: newRole }); toast('Rol güncellendi', 'success'); }
    else toast('Güncelleme başarısız', 'error');
    setMenuOpen(false);
  }

  async function toggleStatus() {
    const newStatus = member.status === 'disabled' ? 'active' : 'disabled';
    const res = await fetch(`/api/team/${member.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { onUpdate(member.id, { status: newStatus as MemberStatus }); toast('Durum güncellendi', 'success'); }
    else toast('Güncelleme başarısız', 'error');
    setMenuOpen(false);
  }

  async function resendInvite() {
    const res = await fetch(`/api/team/${member.id}/resend`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    });
    const json = await res.json();
    if (res.ok) { setInviteUrl(json.data.invite_url); toast('Davet yenilendi', 'success'); }
    else toast('Davet yenilenemedi', 'error');
    setMenuOpen(false);
  }

  async function removeMember() {
    const res = await fetch(`/api/team/${member.id}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader },
    });
    if (res.ok) { onRemove(member.id); toast('Üye kaldırıldı', 'success'); }
    else toast('Üye kaldırılamadı', 'error');
    setMenuOpen(false);
  }

  return (
    <>
      <tr className="hover:bg-muted/20 transition-colors">
        <td className="px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">{member.name ?? member.email}</p>
            {member.name && <p className="text-xs text-muted-foreground">{member.email}</p>}
          </div>
        </td>
        <td className="px-4 py-3">
          <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS_COLORS[member.status])}>
            {STATUS_LABELS[member.status]}
          </span>
        </td>
        <td className="px-4 py-3">
          <select
            value={member.role}
            onChange={(e) => changeRole(e.target.value as Role)}
            className="h-7 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROLES.filter((r) => r !== 'owner').map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground hidden sm:table-cell">{new Date(member.created_at).toLocaleDateString('tr-TR')}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 justify-end">
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setPermOpen(true)}>
              İzinler
            </Button>
            <div className="relative">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setMenuOpen(!menuOpen)}>
                <MoreVertical className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-50 w-48 rounded-lg border border-border bg-card shadow-lg py-1">
                  {member.status === 'invited' && (
                    <button onClick={resendInvite} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                      <RefreshCw className="h-3.5 w-3.5" />Daveti Yenile
                    </button>
                  )}
                  <button onClick={toggleStatus} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted">
                    {member.status === 'disabled' ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                    {member.status === 'disabled' ? 'Aktifleştir' : 'Devre Dışı Bırak'}
                  </button>
                  <hr className="my-1 border-border" />
                  <button onClick={removeMember} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                    <Trash2 className="h-3.5 w-3.5" />Üyeyi Kaldır
                  </button>
                </div>
              )}
            </div>
          </div>
        </td>
      </tr>
      {inviteUrl && (
        <tr>
          <td colSpan={5} className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted/40 border border-border px-3 py-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate flex-1">{inviteUrl}</span>
              <CopyButton text={inviteUrl} label="Kopyala" />
              <button onClick={() => setInviteUrl('')} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </td>
        </tr>
      )}
      {permOpen && (
        <PermissionsModal
          open={permOpen}
          onClose={() => setPermOpen(false)}
          member={member}
          authHeader={authHeader}
          onUpdated={onUpdate}
        />
      )}
    </>
  );
}

export default function TeamPage() {
  const { authHeader, can, ready } = useAuth();
  const { settings, loadSettings } = useStoreSettings();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState('');

  const fetchMembers = useCallback(async (h: string) => {
    setLoading(true);
    const res = await fetch('/api/team', { headers: { Authorization: h } });
    if (res.ok) {
      const json = await res.json();
      setMembers(json.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { AppBridgeHelper.closeLoader(); }, []);

  useEffect(() => {
    if (authHeader) {
      fetchMembers(authHeader);
      loadSettings(authHeader);
    }
  }, [authHeader, fetchMembers, loadSettings]);

  function handleInvited(member: TeamMember & { invite_url: string }) {
    setMembers((prev) => {
      const exists = prev.find((m) => m.id === member.id);
      return exists
        ? prev.map((m) => (m.id === member.id ? { ...m, ...member } : m))
        : [member, ...prev];
    });
    setNewInviteUrl(member.invite_url);
    setInviteOpen(false);
    toast('Davet bağlantısı oluşturuldu', 'success');
  }

  function handleRemove(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function handleUpdate(id: string, updates: Partial<TeamMember>) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
  }

  if (!ready) return null;

  return (
    <DashboardShell storeName={settings?.store_name} logoUrl={settings?.logo_url}>
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold">Takım Yönetimi</h1>
            <PageHelp title="Takım Yönetimi" content={<p>Ekip üyelerinizi e-posta ile davet edin ve her birine rol atayın. Roller: Sahip (tam yetki), Yönetici, Destek, Depo, Salt Okunur. Davet bağlantısı 14 gün geçerlidir.</p>} />
          </div>
          {can('team.manage') && (
            <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Üye Davet Et
            </Button>
          )}
        </div>

        {/* Invite URL banner */}
        {newInviteUrl && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <Link2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-900 mb-0.5">Davet bağlantısı hazır — paylaşın:</p>
              <p className="text-xs text-emerald-700 truncate">{newInviteUrl}</p>
            </div>
            <CopyButton text={newInviteUrl} label="Kopyala" />
            <button onClick={() => setNewInviteUrl('')} className="text-emerald-600 hover:text-emerald-800">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {!can('team.manage') ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            Bu sayfaya erişim izniniz yok.
          </div>
        ) : loading ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />Yükleniyor...
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {members.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                Henüz takım üyesi yok. Üye davet edin.
              </div>
            ) : (
              <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Üye</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Durum</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Rol</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden sm:table-cell">Eklenme</th>
                    <th className="px-4 py-2.5 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m) => (
                    <MemberRow
                      key={m.id}
                      member={m}
                      authHeader={authHeader!}
                      onRemove={handleRemove}
                      onUpdate={handleUpdate}
                    />
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {inviteOpen && authHeader && (
          <InviteModal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            onInvited={handleInvited}
            authHeader={authHeader}
          />
        )}
      </div>
    </DashboardShell>
  );
}
