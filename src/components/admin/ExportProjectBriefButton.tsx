'use client';

import { useMemo, useState } from 'react';
import type { Engagement } from '@/data/engagements';
import type { ChecklistItemStateSlice } from '@/lib/checklist-state-key';
import { checklist } from '@/data/checklist';
import { deriveStuckReason, STUCK_LABEL } from '@/lib/project-stuck';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { GoldButton } from '@/components/noir';
import { Loader2 } from 'lucide-react';

const PHASE_SHORT = ['Pre-incorp', 'Post', 'Registration', 'Compliance'] as const;

function bucketLabel(bucket: string): string {
  if (bucket === 'pre-inc') return 'Pre-incorp';
  if (bucket === 'post-inc') return 'Post';
  if (bucket === 'statutory') return 'Registration';
  if (bucket === 'fema') return 'Compliance';
  return bucket;
}

type Props = {
  eng: Engagement;
  checklistState: Record<string, ChecklistItemStateSlice>;
  overall: number;
  blockers: number;
  pendingDocs: number;
  internName?: string;
};

export function ExportProjectBriefButton({
  eng,
  checklistState,
  overall,
  blockers,
  pendingDocs,
  internName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'generating' | 'done'>('idle');

  const stuck = deriveStuckReason(eng, checklistState);

  const rows = useMemo(() => {
    return checklist.map((item) => {
      const slice = checklistState[item.id];
      return {
        id: item.id,
        title: item.title,
        phase: bucketLabel(item.bucket),
        status: slice?.status ?? 'not-started',
        review: slice?.reviewStatus ?? '—',
      };
    });
  }, [checklistState]);

  const reset = () => {
    setPhase('idle');
    setOpen(false);
  };

  const downloadCsv = async () => {
    setPhase('generating');
    await new Promise((r) => setTimeout(r, 450));
    const header = ['Milestone', 'Phase', 'Status', 'Review'];
    const lines = [
      `# ${eng.companyName} project brief`,
      `# Progress ${overall}% · Health ${eng.health} · Stuck ${STUCK_LABEL[stuck]}`,
      `# Lead ${internName ?? eng.internId} · Stage ${eng.stage}`,
      `# Blockers ${blockers} · Doc requests ${pendingDocs}`,
      header.join(','),
      ...rows.map((r) =>
        [r.title, r.phase, r.status, r.review]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(','),
      ),
    ];
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(eng.slug ?? eng.companyName).replace(/\s+/g, '-').toLowerCase()}-brief.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setPhase('done');
    await new Promise((r) => setTimeout(r, 800));
    reset();
  };

  const label =
    phase === 'generating'
      ? 'Generating…'
      : phase === 'done'
        ? 'Downloaded'
        : 'Export project brief';

  return (
    <>
      <GoldButton
        variant="ghost"
        size="sm"
        disabled={phase === 'generating'}
        onClick={() => {
          setOpen(true);
          setPhase('confirm');
        }}
      >
        {phase === 'generating' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {label}
      </GoldButton>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!v && phase !== 'generating') reset();
          else setOpen(v);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{eng.companyName} — project brief</DialogTitle>
            <DialogDescription>
              Preview analytics and milestone table. Download a CSV when ready.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {PHASE_SHORT.map((p, i) => (
                <span key={p} className="inline-flex items-center gap-1 text-muted-foreground">
                  {i > 0 && <span aria-hidden>→</span>}
                  <span className="rounded-md border border-border px-2 py-0.5 text-foreground">{p}</span>
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Progress</div>
                <div className="text-lg font-serif tabular-nums">{overall}%</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Health</div>
                <div className="text-lg font-serif">{eng.health}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Status</div>
                <div className="text-lg font-serif">{STUCK_LABEL[stuck]}</div>
              </div>
              <div className="rounded-lg border border-border p-3">
                <div className="text-muted-foreground">Blockers / docs</div>
                <div className="text-lg font-serif tabular-nums">
                  {blockers} / {pendingDocs}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Milestone</th>
                    <th className="px-3 py-2 font-medium">Phase</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.title}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.phase}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.review}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={reset} disabled={phase === 'generating'}>
              Close
            </Button>
            <Button type="button" onClick={() => void downloadCsv()} disabled={phase === 'generating'}>
              {phase === 'generating' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Preparing download…
                </>
              ) : (
                'Download CSV'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Compact phase trail for project header. */
export function ProjectPhaseTrail({ stage }: { stage: Engagement['stage'] }) {
  const active =
    stage === 'Pre-Incorporation'
      ? 0
      : stage === 'Post-Incorporation'
        ? 1
        : stage === 'Operational Readiness'
          ? 3
          : 2;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {PHASE_SHORT.map((p, i) => (
        <span key={p} className="inline-flex items-center gap-1">
          {i > 0 && <span aria-hidden className="text-muted-foreground/60">→</span>}
          <span
            className={
              i === active
                ? 'rounded-md bg-orange-50 px-1.5 py-0.5 font-medium text-orange-800 ring-1 ring-orange-200'
                : 'px-1'
            }
          >
            {p}
          </span>
        </span>
      ))}
    </div>
  );
}
