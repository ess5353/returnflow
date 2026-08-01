export type ExportFormat = 'xlsx' | 'csv' | 'pdf';

export interface ExportColumnDef {
  key: string;
  label: string;
  defaultOn: boolean;
}

export const EXPORT_COLUMNS: ExportColumnDef[] = [
  { key: 'rf_number', label: 'Referans No', defaultOn: true },
  { key: 'order_id', label: 'Sipariş No', defaultOn: true },
  { key: 'customer_name', label: 'Müşteri', defaultOn: true },
  { key: 'customer_email', label: 'E-posta', defaultOn: false },
  { key: 'product', label: 'Ürün', defaultOn: true },
  { key: 'reason', label: 'İade Sebebi', defaultOn: false },
  { key: 'status', label: 'Durum', defaultOn: true },
  { key: 'request_type', label: 'Talep Türü', defaultOn: true },
  { key: 'amount', label: 'Tutar (₺)', defaultOn: true },
  { key: 'created_at', label: 'Oluşturulma', defaultOn: true },
  { key: 'updated_at', label: 'Son Güncelleme', defaultOn: false },
  { key: 'admin_note', label: 'Mağaza Notu', defaultOn: false },
  { key: 'automation_result', label: 'Otomasyon Sonucu', defaultOn: false },
];

export const DEFAULT_COLUMNS = EXPORT_COLUMNS.filter((c) => c.defaultOn).map((c) => c.key);

export interface ExportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  requestType?: string;
  automation?: string;
  customer?: string;
  product?: string;
}

export interface ExportJob {
  id: string;
  format: ExportFormat;
  filters: ExportFilters;
  columns: string[];
  row_count: number;
  file_name: string;
  created_at: string;
}

export type ExportDataRow = {
  rf_number: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  product: string;
  reason: string;
  status: string;
  request_type: string;
  amount: string;
  created_at: string;
  updated_at: string;
  admin_note: string;
  automation_result: string;
};

export function formatRow(raw: Record<string, unknown>, columns: string[]): Record<string, string> {
  const labelMap: Record<string, string> = {};
  for (const col of EXPORT_COLUMNS) labelMap[col.key] = col.label;

  const result: Record<string, string> = {};
  for (const key of columns) {
    const label = labelMap[key] ?? key;
    const raw_val = (raw as Record<string, unknown>)[key];
    let val = '';

    if (raw_val === null || raw_val === undefined) {
      val = '';
    } else if (key === 'request_type') {
      val = raw_val === 'exchange' ? 'Değişim' : 'İade';
    } else if (key === 'created_at' || key === 'updated_at') {
      val = raw_val ? new Date(raw_val as string).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    } else {
      val = String(raw_val);
    }

    result[label] = val;
  }
  return result;
}
