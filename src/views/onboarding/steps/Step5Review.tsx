import { Sparkles } from 'lucide-react';
import { getIncorporationPhases, getPhaseItems } from '@/data/checklist';
import type { WizardData } from '../OnboardingWizard';

export function Step5Review({ data }: { data: WizardData }) {
  const phases = getIncorporationPhases();
  const items = getPhaseItems(phases);
  const totalTasks = items.length;
  const preCount = getPhaseItems(phases.filter((p) => p.id.startsWith('pre-inc'))).length;
  const postCount = getPhaseItems(phases.filter((p) => p.id.startsWith('post-inc'))).length;
  const regCount = getPhaseItems(phases.filter((p) => p.id.startsWith('registration'))).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Review & confirm</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Confirm the details below. VCFO Suite will generate a tailored compliance checklist when you
          finish.
        </p>
      </div>

      <div className="flex items-center gap-3 rounded-md border border-primary/25 bg-primary-light p-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <div className="text-sm text-primary-dark">
          <strong>{totalTasks} compliance items</strong> will be added across four phases —{' '}
          {preCount} pre-incorporation, {postCount} post-incorporation, and {regCount} registration
          steps.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="Company">
          <Row k="Name" v={data.name} />
          <Row k="Alternate name" v={data.nameAlt || '—'} />
          <Row k="Nature" v={data.nature} />
          <Row k="Share capital" v={`₹ ${data.shareCapital.toLocaleString('en-IN')}`} />
        </Card>
        <Card title="Directors">
          <Row k="Count" v={`${data.directors.length}`} />
          <Row
            k="Indian residents"
            v={`${data.directors.filter((d) => d.resident).length}`}
          />
          <Row
            k="Foreign nationals"
            v={`${data.directors.filter((d) => !d.resident).length}`}
          />
        </Card>
        <Card title="Registered office">
          <Row k="Address" v={data.office.address || '—'} />
          <Row k="NOC" v={data.office.noc ? 'Confirmed' : 'Pending'} />
          <Row
            k="Utility bill"
            v={data.office.utilityBill ? 'Uploaded' : 'Pending'}
          />
        </Card>
        <Card title="Foreign parent">
          {data.foreign.enabled ? (
            <>
              <Row k="Parent" v={data.foreign.parentName} />
              <Row k="Country" v={data.foreign.country} />
              <Row k="Shareholders" v={`${data.foreign.shareholders.length}`} />
            </>
          ) : (
            <div className="text-xs text-muted-foreground">No overseas parent</div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
        {title}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right font-medium text-foreground">{v}</span>
    </div>
  );
}
