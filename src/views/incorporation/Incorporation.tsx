'use client';

import { Calendar } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { EmptyState } from '@/components/common/EmptyState';
import { PreIncSection } from './sections/PreIncSection';
import { PostIncSection } from './sections/PostIncSection';
import { RegistrationSection } from './sections/RegistrationSection';
import { Building2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function Incorporation() {
  const { selectedClient, role, setSelectedClient, clients } = useApp();

  if (!selectedClient) {
    return (
      <EmptyState
        icon={Building2}
        title="Select a client"
        action={
          role === 'admin' && (
            <div className="flex flex-wrap justify-center gap-2">
              {clients.map((c) => (
                <button type="button"
                  key={c.id}
                  onClick={() => setSelectedClient(c)}
                  className="rounded-md border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  {c.name}
                </button>
              ))}
            </div>
          )
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <SEO title="Incorporation tracker — VCFO Suite" description="Pre- and post-incorporation milestones, statutory deadlines, and FEMA FCGPR filing log." path="/incorporation" />
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Incorporation tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedClient.name} ·{' '}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {selectedClient.incorporationDate
                ? `Incorporated ${selectedClient.incorporationDate}`
                : 'Incorporation date not set'}
            </span>
          </p>
        </div>
      </div>

      <PreIncSection />
      <PostIncSection />
      <RegistrationSection />
    </div>
  );
}
