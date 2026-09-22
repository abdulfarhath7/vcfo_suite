'use client';

import dynamic from 'next/dynamic';
import { AuthBootScreen } from '@/components/common/AuthBootScreen';

const DocPackView = dynamic(() => import('@/views/engagement/DocPackView'), {
  ssr: false,
  loading: () => <AuthBootScreen label="Loading document pack…" />,
});

/** Client-only entry, like the step page: the view reads route params and the session. */
export default function DocPackViewClient() {
  return <DocPackView />;
}
