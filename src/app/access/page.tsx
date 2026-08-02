'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { STAFF_TOKEN_KEY } from '@/hooks/use-auth';
import { ROLE_LABELS, type Role } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeftRight, CheckCircle2, Loader2 } from 'lucide-react';

function AccessForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [memberInfo, setMemberInfo] = useState<{ name: string; role: string; email: string } | null>(null);

  async function handleAccept() {
    if (!name.trim()) return;
    setLoading(true);
    setError('');

    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name: name.trim() }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Davet kabul edilemedi.');
      setLoading(false);
      return;
    }

    localStorage.setItem(STAFF_TOKEN_KEY, json.data.token);
    setMemberInfo({ name: json.data.name, role: json.data.role, email: json.data.email });
    setDone(true);
    setLoading(false);

    setTimeout(() => { window.location.href = '/dashboard'; }, 2000);
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-muted-foreground text-sm">Geçersiz davet bağlantısı.</p>
      </div>
    );
  }

  if (done && memberInfo) {
    return (
      <div className="text-center space-y-3">
        <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
        <p className="text-lg font-semibold">Hoş geldiniz, {memberInfo.name}!</p>
        <p className="text-sm text-muted-foreground">
          Rol: <span className="font-medium">{ROLE_LABELS[memberInfo.role as Role] ?? memberInfo.role}</span>
        </p>
        <p className="text-xs text-muted-foreground">Dashboard&apos;a yönlendiriliyorsunuz...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <label className="text-sm font-medium">Adınız</label>
        <Input
          placeholder="Adınızı girin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAccept()}
          autoFocus
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}

      <Button
        className="w-full"
        onClick={handleAccept}
        disabled={loading || !name.trim()}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        {loading ? 'Giriş yapılıyor...' : 'Daveti Kabul Et'}
      </Button>
    </div>
  );
}

export default function AccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ArrowLeftRight className="h-6 w-6 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">ReturnFlow</h1>
            <p className="text-sm text-muted-foreground mt-1">Takım daveti — hesabınızı oluşturun</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <Suspense fallback={<div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
            <AccessForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
