import {
  ArrowLeftRight,
  Check,
  CheckCircle,
  MessageSquare,
  PackageCheck,
  RotateCcw,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationType } from './create';

export interface NotificationConfig {
  label: string;
  icon: LucideIcon;
  bgClass: string;
  iconClass: string;
}

export const NOTIFICATION_CONFIG: Record<NotificationType, NotificationConfig> = {
  new_return: {
    label: 'Yeni İade',
    icon: RotateCcw,
    bgClass: 'bg-blue-100',
    iconClass: 'text-blue-600',
  },
  new_exchange: {
    label: 'Yeni Değişim',
    icon: ArrowLeftRight,
    bgClass: 'bg-purple-100',
    iconClass: 'text-purple-600',
  },
  return_approved: {
    label: 'İade Onaylandı',
    icon: CheckCircle,
    bgClass: 'bg-emerald-100',
    iconClass: 'text-emerald-600',
  },
  return_rejected: {
    label: 'İade Reddedildi',
    icon: X,
    bgClass: 'bg-red-100',
    iconClass: 'text-red-600',
  },
  exchange_approved: {
    label: 'Değişim Onaylandı',
    icon: CheckCircle,
    bgClass: 'bg-emerald-100',
    iconClass: 'text-emerald-600',
  },
  exchange_completed: {
    label: 'Değişim Tamamlandı',
    icon: PackageCheck,
    bgClass: 'bg-emerald-100',
    iconClass: 'text-emerald-600',
  },
  automation_triggered: {
    label: 'Otomasyon Tetiklendi',
    icon: Zap,
    bgClass: 'bg-amber-100',
    iconClass: 'text-amber-600',
  },
  refund_completed: {
    label: 'İade Tamamlandı',
    icon: Check,
    bgClass: 'bg-emerald-100',
    iconClass: 'text-emerald-600',
  },
  note_added: {
    label: 'Dahili Not',
    icon: MessageSquare,
    bgClass: 'bg-slate-100',
    iconClass: 'text-slate-600',
  },
};

export const NOTIFICATION_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tümü' },
  { value: 'new_return', label: 'Yeni İade' },
  { value: 'new_exchange', label: 'Yeni Değişim' },
  { value: 'return_approved', label: 'İade Onaylandı' },
  { value: 'return_rejected', label: 'İade Reddedildi' },
  { value: 'exchange_approved', label: 'Değişim Onaylandı' },
  { value: 'exchange_completed', label: 'Değişim Tamamlandı' },
  { value: 'automation_triggered', label: 'Otomasyon' },
  { value: 'refund_completed', label: 'İade Tamamlandı' },
  { value: 'note_added', label: 'Dahili Not' },
];

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}sn önce`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}sa önce`;
  return `${Math.floor(hours / 24)}g önce`;
}
