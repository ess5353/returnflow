import { supabaseAdmin } from '@/lib/supabase-admin';
import type { NextRequest } from 'next/server';

export type AuditAction =
  | 'return.created' | 'return.approved' | 'return.rejected' | 'return.completed'
  | 'exchange.created' | 'exchange.approved' | 'exchange.completed'
  | 'automation_rule.created' | 'automation_rule.updated' | 'automation_rule.deleted'
  | 'webhook.created' | 'webhook.updated' | 'webhook.deleted'
  | 'api_key.created' | 'api_key.revoked'
  | 'email_template.updated'
  | 'settings.updated'
  | 'notification.read'
  | 'export.generated'
  | 'member.invited' | 'member.removed' | 'member.role_changed' | 'member.permissions_updated';

export type AuditEntityType =
  | 'return' | 'exchange'
  | 'automation_rule' | 'webhook' | 'api_key'
  | 'email_template' | 'settings' | 'notification' | 'export' | 'team_member';

export function createAuditLog(params: {
  merchantId: string;
  user: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}): void {
  supabaseAdmin
    .from('audit_logs')
    .insert({
      merchant_id: params.merchantId,
      user_label: params.user,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
      ip_address: params.ipAddress ?? null,
    })
    .then(() => undefined);
}

export function getIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? undefined;
}
