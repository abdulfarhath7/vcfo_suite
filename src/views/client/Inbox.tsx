'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { PageTransition, Stagger, StaggerItem } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { AccentButton, Surface, EmptyStateIllustrated, Eyebrow } from '@/components/noir';
import { GeometricEmpty } from '@/components/illustrations/GeometricEmpty';
import { Upload, FileCheck2, Clock, ArrowRight, AlertCircle, Megaphone } from 'lucide-react';
import { toast } from '@/lib/toast-errors';
import { m } from 'framer-motion';
import { cn } from '@/lib/utils';
import { canClientResubmit, isReviewRejected } from '@/lib/checklist-item-review';
import { checklistItemLabel } from '@/lib/audit-log';
import { useAnnouncements } from '@/lib/use-announcements';
import { AnnouncementCompactList } from '@/components/announcements/AnnouncementList';

function groupBy<T>(arr: T[], fn: (x: T) => string) {
  return arr.reduce<Record<string, T[]>>((acc, x) => {
    const k = fn(x);
    (acc[k] ||= []).push(x);
    return acc;
  }, {});
}

const INBOX_GROUP_ORDER = ['Due today', 'This week', 'Later'];

type ChecklistAction = {
  id: string;
  itemId: string;
  label: string;
  message?: string;
};

function dueStripClass(bucket: string): string {
  if (bucket === 'Due today') return 'bg-primary';
  if (bucket === 'This week') return 'bg-primary/50';
  return 'bg-muted-foreground/35';
}

export default function ClientInbox() {
  const router = useRouter();
  const { user, engagements, requests, uploadDoc, getStateForEngagement } = useApp();
  const announcementsQuery = useAnnouncements(3);
  const eng = engagements.find((e) => e.clientId === user?.clientId);

  const checklistActions = useMemo(() => {
    if (!eng) return [] as ChecklistAction[];
    const state = getStateForEngagement(eng);
    const out: ChecklistAction[] = [];
    for (const [itemId, slice] of Object.entries(state)) {
      if (!isReviewRejected(slice) || !canClientResubmit(slice)) continue;
      out.push({
        id: `checklist-${itemId}`,
        itemId,
        label: checklistItemLabel(itemId),
        message: slice.rejectionNote?.trim() || 'Corrections requested — update and resubmit.',
      });
    }
    return out;
  }, [eng, getStateForEngagement]);

  if (!eng) {
    return (
      <EmptyStateIllustrated
        art="empty"
        title="No active engagement"
        description="We could not find an active engagement for your account."
      />
    );
  }

  const myReqs = requests.filter((r) => r.engagementId === eng.id);
  const pending = myReqs.filter((r) => r.status === 'pending');
  const done = myReqs.filter((r) => r.status !== 'pending');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const grouped = groupBy(pending, (r) => {
    if (!r.dueAt) return 'Later';
    const d = new Date(r.dueAt);
    const diff = (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 1) return 'Due today';
    if (diff <= 7) return 'This week';
    return 'Later';
  });
  const order = INBOX_GROUP_ORDER;
  const actionCount = pending.length + checklistActions.length;

  const handleUpload = (id: string, label: string) => {
    uploadDoc(id, `${label.toLowerCase().replace(/\s+/g, '_')}.pdf`);
    toast.success('Uploaded — received by VCFO');
  };

  return (
    <PageTransition>
      <SEO
        title="Inbox — VCFO Suite"
        description="Everything that needs your attention—uploads, signatures, and reviews—in one place."
        path="/app/client/inbox"
      />

      <Surface raised className="mb-6 px-6 py-5">
        <Eyebrow>{eng.stage}</Eyebrow>
        <h1 className="serif mt-1 text-[clamp(1.75rem,3vw,2.25rem)] tracking-tight text-foreground">
          {eng.companyName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{actionCount}</span> awaiting your action
        </p>
      </Surface>

      <Surface className="mb-6 px-5 py-4">
        <div className="mb-2.5 flex items-center gap-2 text-accent-violet">
          <Megaphone className="h-3.5 w-3.5" />
          <Eyebrow className="mb-0 text-accent-violet">Announcements</Eyebrow>
        </div>
        <AnnouncementCompactList
          items={announcementsQuery.data?.announcements ?? []}
          href="/app/client/announcements"
        />
      </Surface>

      {actionCount === 0 ? (
        <Surface className="flex flex-col items-center p-10 text-center">
          <GeometricEmpty variant="success" />
          <div className="serif mt-3 text-xl text-foreground">You are all caught up</div>
          <p className="mt-1 prose-narrow mx-auto text-sm text-muted-foreground">
            Nothing needs your attention right now. We will email you when something new comes in.
          </p>
        </Surface>
      ) : (
        <Stagger>
          <div className="space-y-5">
            {checklistActions.length > 0 && (
              <StaggerItem>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-danger" />
                  Corrections needed
                  <span className="normal-case font-normal">· {checklistActions.length}</span>
                </div>
                <Surface className="overflow-hidden divide-y divide-border">
                  {checklistActions.map((a) => (
                    <div
                      key={a.id}
                      className="relative flex flex-wrap items-center gap-4 py-4 pl-5 pr-4 hover:bg-raised/40"
                    >
                      <span className="absolute inset-y-0 left-0 w-1 bg-danger" aria-hidden />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md role-accent-bg">
                        <AlertCircle className="h-4 w-4 text-role" />
                      </div>
                      <div className="min-w-[180px] flex-1">
                        <div className="text-sm font-medium text-foreground">{a.label}</div>
                        {a.message && (
                          <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {a.message}
                          </div>
                        )}
                      </div>
                      <AccentButton
                        size="sm"
                        onClick={() => router.push('/app/client/incorporation')}
                      >
                        Fix & resubmit <ArrowRight className="h-3 w-3" />
                      </AccentButton>
                    </div>
                  ))}
                </Surface>
              </StaggerItem>
            )}

            {order.map((bucket) => {
              const items = grouped[bucket];
              if (!items?.length) return null;
              return (
                <StaggerItem key={bucket}>
                  <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', dueStripClass(bucket))} />
                    {bucket}
                    <span className="normal-case font-normal">· {items.length}</span>
                  </div>
                  <Surface className="overflow-hidden divide-y divide-border">
                    {items.map((r) => (
                      <m.div
                        key={r.id}
                        layout
                        className="relative flex flex-wrap items-center gap-4 py-4 pl-5 pr-4 hover:bg-raised/40"
                      >
                        <span
                          className={cn('absolute inset-y-0 left-0 w-1', dueStripClass(bucket))}
                          aria-hidden
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md role-accent-bg">
                          <Upload className="h-4 w-4 text-role" />
                        </div>
                        <div className="min-w-[180px] flex-1">
                          <div className="text-sm font-medium text-foreground">{r.label}</div>
                          {r.message && (
                            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {r.message}
                            </div>
                          )}
                          {r.dueAt && (
                            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              Due by {r.dueAt}
                            </div>
                          )}
                        </div>
                        <AccentButton size="sm" onClick={() => handleUpload(r.id, r.label)}>
                          Upload file <ArrowRight className="h-3 w-3" />
                        </AccentButton>
                      </m.div>
                    ))}
                  </Surface>
                </StaggerItem>
              );
            })}

            {done.length > 0 && (
              <StaggerItem>
                <div className="mb-1.5 mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recently submitted
                </div>
                <Surface className="divide-y divide-border">
                  {done.map((r) => (
                    <div key={r.id} className="flex items-center gap-4 px-4 py-3 text-muted-foreground">
                      <FileCheck2 className="h-4 w-4 text-success" />
                      <div className="flex-1 text-sm line-through decoration-muted-foreground/40">
                        {r.label}
                      </div>
                      <span className="text-xs capitalize">{r.status}</span>
                    </div>
                  ))}
                </Surface>
              </StaggerItem>
            )}
          </div>
        </Stagger>
      )}
    </PageTransition>
  );
}
