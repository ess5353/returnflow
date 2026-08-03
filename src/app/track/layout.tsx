import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Talep Takibi | ReturnFlow',
  description: 'İade veya değişim talebinizin durumunu takip edin.',
  robots: { index: false, follow: false },
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
