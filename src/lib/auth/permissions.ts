export const ALL_PERMISSIONS = [
  'returns.view',
  'returns.approve',
  'returns.reject',
  'returns.complete',
  'automation.view',
  'automation.create',
  'automation.edit',
  'automation.delete',
  'analytics.view',
  'export.generate',
  'settings.edit',
  'email_templates.edit',
  'api.manage',
  'webhooks.manage',
  'billing.manage',
  'team.manage',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLES = ['owner', 'admin', 'support', 'warehouse', 'accounting', 'read_only'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Sahibi',
  admin: 'Yönetici',
  support: 'Destek',
  warehouse: 'Depo',
  accounting: 'Muhasebe',
  read_only: 'Salt Okunur',
};

export const ROLE_PERMISSIONS: Record<Role, Permission[] | ['*']> = {
  owner: ['*'] as ['*'],
  admin: [
    'returns.view', 'returns.approve', 'returns.reject', 'returns.complete',
    'automation.view', 'automation.create', 'automation.edit', 'automation.delete',
    'analytics.view', 'export.generate', 'settings.edit', 'email_templates.edit',
    'api.manage', 'webhooks.manage', 'team.manage',
  ],
  support: ['returns.view', 'returns.approve', 'returns.reject', 'returns.complete', 'analytics.view'],
  warehouse: ['returns.view', 'returns.complete'],
  accounting: ['returns.view', 'analytics.view', 'export.generate'],
  read_only: ['returns.view', 'analytics.view'],
};

export function getEffectivePermissions(role: Role, custom?: string[]): string[] {
  const base = ROLE_PERMISSIONS[role] as string[];
  if (base.includes('*')) return ['*'];
  if (custom && custom.length > 0) return [...new Set([...base, ...custom])];
  return base;
}
