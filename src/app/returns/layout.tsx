import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'İade & Değişim | ReturnFlow',
  description: 'İade veya değişim talebinizi birkaç adımda oluşturun.',
  robots: { index: false, follow: false },
};

export default function ReturnsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
