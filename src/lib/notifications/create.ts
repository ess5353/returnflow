import { supabaseAdmin } from '@/lib/supabase-admin';

export type NotificationType =
  | 'new_return'
  | 'new_exchange'
  | 'return_approved'
  | 'return_rejected'
  | 'exchange_approved'
  | 'exchange_completed'
  | 'automation_triggered'
  | 'refund_completed';

interface CreateNotificationParams {
  merchantId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedReturnId?: string | null;
}

export function createNotification(p: CreateNotificationParams): void {
  supabaseAdmin
    .from('notifications')
    .insert({
      merchant_id: p.merchantId,
      type: p.type,
      title: p.title,
      message: p.message,
      related_return_id: p.relatedReturnId ?? null,
      read: false,
    })
    .then(({ error }) => {
      if (error) console.error('createNotification error:', error);
    });
}
