export type CarrierId = 'yurtici' | 'mng' | 'aras' | 'surat' | 'ptt' | 'manual';
export type ShippingStatus = 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed';

export interface CarrierConfig {
  id: CarrierId;
  label: string;
  trackingUrl?: (trackingNumber: string) => string;
}

export const CARRIERS: Record<CarrierId, CarrierConfig> = {
  yurtici: {
    id: 'yurtici',
    label: 'Yurtiçi Kargo',
    trackingUrl: (n) => `https://www.yurticikargo.com/tr/online-islemler/gonderi-sorgula?code=${encodeURIComponent(n)}`,
  },
  mng: {
    id: 'mng',
    label: 'MNG Kargo',
    trackingUrl: (n) => `https://www.mngkargo.com.tr/gonderi-sorgulama?barcode=${encodeURIComponent(n)}`,
  },
  aras: {
    id: 'aras',
    label: 'Aras Kargo',
    trackingUrl: (n) => `https://kargotakip.araskargo.com.tr/${encodeURIComponent(n)}`,
  },
  surat: {
    id: 'surat',
    label: 'Sürat Kargo',
    trackingUrl: (n) => `https://www.suratkargo.com.tr/KargoSorgulama/index?BarkodNo=${encodeURIComponent(n)}`,
  },
  ptt: {
    id: 'ptt',
    label: 'PTT Kargo',
    trackingUrl: (n) => `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${encodeURIComponent(n)}`,
  },
  manual: {
    id: 'manual',
    label: 'Manuel Kargo',
  },
};

export const CARRIER_LIST = Object.values(CARRIERS);

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  pending: 'Gönderim Bekleniyor',
  in_transit: 'Kargoda',
  out_for_delivery: 'Dağıtımda',
  delivered: 'Teslim Edildi',
  failed: 'Teslim Edilemedi',
};

export const SHIPPING_STATUS_LIST: { value: ShippingStatus; label: string }[] = [
  { value: 'pending', label: 'Gönderim Bekleniyor' },
  { value: 'in_transit', label: 'Kargoda' },
  { value: 'out_for_delivery', label: 'Dağıtımda' },
  { value: 'delivered', label: 'Teslim Edildi' },
  { value: 'failed', label: 'Teslim Edilemedi' },
];

export function getCarrierLabel(carrierId: string): string {
  return CARRIERS[carrierId as CarrierId]?.label ?? carrierId;
}

export function getTrackingUrl(carrierId: string, trackingNumber: string): string | null {
  const carrier = CARRIERS[carrierId as CarrierId];
  if (!carrier?.trackingUrl || !trackingNumber.trim()) return null;
  return carrier.trackingUrl(trackingNumber.trim());
}

export function getShippingStatusLabel(status: string): string {
  return SHIPPING_STATUS_LABELS[status as ShippingStatus] ?? status;
}
