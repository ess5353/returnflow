'use client';

import Loading from '@/components/Loading';
import { useBaseHomePage } from './hooks/use-base-home-page';

export default function Home() {
  useBaseHomePage();

  return <Loading />;
}