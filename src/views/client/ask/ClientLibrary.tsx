'use client';

import { BookMarked } from 'lucide-react';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { PageTransition } from '@/components/shell/PageTransition';
import { ReferenceShelf } from '@/components/client/library/ReferenceShelf';

/** Client Library: the reference books shelf. */
export default function ClientLibrary() {
  return (
    <PageTransition>
      <SEO title="Library" description="Reference books for your India entity" path="/app/client/library" />
      <PageHeader title="Library" subtitle="Reference books for your India entity." icon={BookMarked} />
      <ReferenceShelf />
    </PageTransition>
  );
}
