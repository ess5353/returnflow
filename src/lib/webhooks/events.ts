export type WebhookEvent =
  | 'return.created'
  | 'return.approved'
  | 'return.rejected'
  | 'return.completed'
  | 'exchange.created'
  | 'exchange.approved'
  | 'exchange.completed'
  | 'automation.triggered';

export const WEBHOOK_EVENTS: WebhookEvent[] = [
  'return.created',
  'return.approved',
  'return.rejected',
  'return.completed',
  'exchange.created',
  'exchange.approved',
  'exchange.completed',
  'automation.triggered',
];

export const WEBHOOK_EVENT_LABELS: Record<WebhookEvent, string> = {
  'return.created': 'İade Oluşturuldu',
  'return.approved': 'İade Onaylandı',
  'return.rejected': 'İade Reddedildi',
  'return.completed': 'İade Tamamlandı',
  'exchange.created': 'Değişim Oluşturuldu',
  'exchange.approved': 'Değişim Onaylandı',
  'exchange.completed': 'Değişim Tamamlandı',
  'automation.triggered': 'Otomasyon Tetiklendi',
};

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export const SAMPLE_PAYLOADS: Record<WebhookEvent, WebhookPayload> = {
  'return.created': {
    event: 'return.created',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'RF-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      customer_email: 'ahmet@example.com',
      product: 'Mavi T-Shirt',
      reason: 'Beden uyumsuzluğu',
      status: 'Yeni Talep',
      request_type: 'return',
      amount: '299.99',
    },
  },
  'return.approved': {
    event: 'return.approved',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'RF-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      status: 'Onaylandı',
      request_type: 'return',
      amount: '299.99',
    },
  },
  'return.rejected': {
    event: 'return.rejected',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'RF-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      status: 'Reddedildi',
      request_type: 'return',
      amount: '299.99',
    },
  },
  'return.completed': {
    event: 'return.completed',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'RF-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      status: 'Tamamlandı',
      request_type: 'return',
      amount: '299.99',
    },
  },
  'exchange.created': {
    event: 'exchange.created',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'EX-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      product: 'Mavi T-Shirt',
      status: 'Yeni Talep',
      request_type: 'exchange',
      exchange_type: 'same_product_size',
      amount: '299.99',
    },
  },
  'exchange.approved': {
    event: 'exchange.approved',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'EX-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      status: 'Onaylandı',
      request_type: 'exchange',
      amount: '299.99',
    },
  },
  'exchange.completed': {
    event: 'exchange.completed',
    timestamp: new Date().toISOString(),
    data: {
      id: 'uuid-sample',
      rf_number: 'EX-2026.08.01-0001',
      order_id: 'ORDER-12345',
      customer_name: 'Ahmet Yılmaz',
      status: 'Tamamlandı',
      request_type: 'exchange',
      amount: '299.99',
    },
  },
  'automation.triggered': {
    event: 'automation.triggered',
    timestamp: new Date().toISOString(),
    data: {
      return_request_id: 'uuid-sample',
      rf_number: 'RF-2026.08.01-0001',
      rule_name: 'Otomatik Onay',
      action_taken: 'approve',
      matched: true,
    },
  },
};
