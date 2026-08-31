'use client';

import { m as motion, AnimatePresence } from 'framer-motion';
import { stageDisplayLabel } from '@/components/admin/create-project-form-utils';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { ProjectActionsMenu } from '@/components/admin/ProjectActionsMenu';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { PhaseTimeline, type Phase } from '@/components/admin/PhaseTimeline';
import { SEO } from '@/components/SEO';
import { STATUS_LABEL, type Bucket, type StatusCode, type ChecklistItem } from '@/data/checklist';
import { ChecklistInlineTimeline } from '@/components/incorporation/ChecklistExpectedTimeline';
import {
  COMPANY_TYPE_LABEL,
  type Engagement,
  type TaskInstance,
  type DocRequest,
  type ActivityEvent,
} from '@/data/engagements';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eyebrow, Mono, GoldDivider, Surface, StatusDot, GoldButton, ProgressRing } from '@/components/noir';
import { adminProjectPath, adminProjectStepPath } from '@/lib/project-step-path';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';
import {
  ExportProjectBriefButton,
  ProjectPhaseTrail,
} from '@/components/admin/ExportProjectBriefButton';
import {
  ListChecks,
  AlertTriangle,
  FolderCheck,
  FileText,
  Upload,
  CheckCircle2,
  ChevronRight,
  Mail,
  Loader2,
  Building2,
  MapPin,
  Lock,
} from 'lucide-react';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import { cn } from '@/lib/utils';
import { fadeUp, staggerKids } from '@/lib/motion';
import { MilestoneResponseRowSummary } from '@/views/incorporation/MilestoneResponseRowSummary';
import { extractItemResponses } from '@/lib/checklist-responses';
import { shouldShowStatutoryFormLabels } from '@/lib/checklist-field-access';
import { ProjectDetailTeamPanel } from '@/views/admin/ProjectDetailTeamPanel';
import { ProjectDetailActivityPanel } from '@/views/admin/ProjectDetailActivityPanel';
import { ProjectDetailNotificationsPanel } from '@/views/admin/ProjectDetailNotificationsPanel';
import { ProjectDetailResendDialog } from '@/views/admin/ProjectDetailResendDialog';
import type { useRouter } from 'next/navigation';
import type { ChecklistItemState } from '@/context/AppContext';
import type { AuthUser } from '@/lib/auth';
import { deriveChecklistDisplayStatus } from '@/lib/checklist-display-status';
import {
  checklistGateViewerFrom,
  gateActiveCatalog,
  gateDisplayStatus,
  getStepGate,
} from '@/lib/checklist-step-gate';
import { notifyChecklistStepLocked } from '@/components/incorporation/ChecklistJourneyRail';

const STATUS_TONE: Record<
  StatusCode,
  { dot: 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted'; cls: string }
> = {
  'not-started': { dot: 'muted', cls: 'text-paper-subtle' },
  'in-progress': { dot: 'info', cls: 'text-info' },
  'awaiting-client': { dot: 'warning', cls: 'text-warning' },
  completed: { dot: 'success', cls: 'text-success' },
  overdue: { dot: 'danger', cls: 'text-danger' },
  'not-applicable': { dot: 'muted', cls: 'text-paper-subtle' },
};

type Router = ReturnType<typeof useRouter>;

/** Per-bucket phase summary computed by the ProjectDetail container. */
interface ProjectPhase {
  key: Bucket;
  bucket: Bucket;
  label: string;
  percent: number;
  status: Phase['status'];
  total: number;
  done: number;
}

interface ProjectDetailViewProps {
  eng: Engagement;
  router: Router;
  intern?: { id: string; name: string };
  leads?: Array<{ id: string; name: string }>;
  phases: ProjectPhase[];
  overall: number;
  active: string;
  blockers: number;
  pendingDocs: number;
  tab: Bucket;
  setTab: (value: Bucket) => void;
  checklistState: Record<string, ChecklistItemState>;
  checklistLoading: boolean;
  eTasks: TaskInstance[];
  eRequests: DocRequest[];
  eActivity: ActivityEvent[];
  tasksByBucket: (bucket: Bucket) => Array<{ item: ChecklistItem; task: TaskInstance | undefined }>;
  resendOpen: boolean;
  setResendOpen: (open: boolean) => void;
  resending: boolean;
  handleResendWelcome: () => void | Promise<void>;
  canResendWelcome: boolean;
  user: AuthUser | null;
}

export function ProjectDetailView(props: ProjectDetailViewProps) {
  const {
    eng,
    router,
    intern,
    leads,
    phases,
    overall,
    active,
    blockers,
    pendingDocs,
    tab,
    setTab,
    checklistState,
    checklistLoading,
    eTasks,
    eRequests,
    eActivity,
    tasksByBucket,
    resendOpen,
    setResendOpen,
    resending,
    handleResendWelcome,
    canResendWelcome,
    user,
  } = props;

  const staffBase = useStaffBasePath();
  const gates = gateActiveCatalog(
    checklistState,
    checklistGateViewerFrom('admin', user?.role),
  );

  return (
    <PageTransition>
        <SEO title={`${eng.companyName} — GCC Project`} description="Setup timeline, phase workstreams, documents, and activity for this GCC setup project." path={adminProjectPath(eng, staffBase)} />

      <PageHeader
        accent="primary"
        title={eng.companyName}
        subtitle={
          <span className="block space-y-2">
            <span className="block">
              {COMPANY_TYPE_LABEL[eng.companyType ?? 'domestic']} entity · {intern?.name ?? 'Unassigned'} ·
              Started {eng.createdAt}
            </span>
            <span className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary-light px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                {stageDisplayLabel(eng.stage)}
              </span>
              <ProgressRing value={overall} size={40} stroke={3.5} className="shrink-0" />
              <span className="text-[12px] text-muted-foreground">
                {blockers > 0
                  ? `Waiting on client · ${blockers} open`
                  : pendingDocs > 0
                    ? `Docs outstanding · ${pendingDocs}`
                    : 'No client blockers'}
              </span>
            </span>
            <ProjectPhaseTrail stage={eng.stage} />
          </span>
        }
        actions={
          <>
            {canResendWelcome && (
              <GoldButton
                variant="outline"
                size="sm"
                onClick={() => setResendOpen(true)}
                disabled={resending}
              >
                {resending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Mail className="w-3.5 h-3.5" />
                )}
                Resend welcome email
              </GoldButton>
            )}
            <ExportProjectBriefButton
              eng={eng}
              checklistState={checklistState}
              overall={overall}
              blockers={blockers}
              pendingDocs={pendingDocs}
              internName={intern?.name}
            />
            <ProjectActionsMenu
              engagement={eng}
              onDeleted={() => router.push(`${staffBase}/projects`)}
            />
          </>
        }
      />

      <motion.div
        variants={staggerKids(0.06)}
        initial="hidden"
        animate="show"
        className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={fadeUp} className="col-span-2 sm:col-span-1 lg:col-span-1 min-h-[7.5rem]">
          <Surface raised className="flex h-full min-h-[7.5rem] flex-col justify-center p-4 sm:p-5">
            <Eyebrow>Setup progress</Eyebrow>
            <div className="mt-2 flex items-end gap-2.5">
              <span className="serif text-3xl tabular-nums text-foreground sm:text-4xl">{overall}%</span>
            </div>
          </Surface>
        </motion.div>
        {[
          { tone: 'sky' as const, icon: ListChecks, label: 'Current phase', value: active, hint: `${phases.find((p) => p.status === 'in-progress')?.percent ?? 100}% of phase complete` },
          { tone: 'amber' as const, icon: AlertTriangle, label: 'Waiting on client', value: blockers },
          { tone: 'emerald' as const, icon: FolderCheck, label: 'Docs outstanding', value: pendingDocs },
        ].map((k) => (
          <motion.div key={k.label} variants={fadeUp} className="min-h-[7.5rem]">
            <div className="h-full min-h-[7.5rem]">
              <AccentKpi {...k} />
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — Phase Tabs (phase map moved to header trail) */}
        <div className="lg:col-span-2 space-y-6">
          <Surface className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <Eyebrow>Workstreams</Eyebrow>
                <h2 className="serif text-paper text-[22px] leading-tight mt-1">Milestones by phase</h2>
              </div>
              {checklistLoading && (
                <span className="inline-flex items-center gap-2 text-[11px] text-paper-muted">
                  <HexgridLoader size="sm" />
                  Syncing client answers…
                </span>
              )}
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as Bucket)}>
              <TabsList className="bg-transparent border-b border-hairline rounded-none h-auto p-0 w-full justify-start gap-1">
                {phases.map((p) => (
                  <TabsTrigger
                    key={p.bucket}
                    value={p.bucket}
                    className={cn(
                      'relative rounded-none bg-transparent px-4 py-3 text-[12px] mono uppercase tracking-[0.16em] text-paper-muted',
                      'data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none',
                      'hover:text-paper transition-colors',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <StatusDot tone={p.status === 'completed' ? 'success' : p.status === 'in-progress' ? 'gold' : 'muted'} size={6} pulse={p.status === 'in-progress'} />
                      {p.bucket === 'pre-inc'
                        ? '1. Gather company details'
                        : p.bucket === 'post-inc'
                          ? '2. File post-incorp forms'
                          : p.bucket === 'fema'
                            ? '3. Complete registrations'
                            : '4. Track ongoing compliance'}
                      <span className="text-paper-subtle tabular-nums">{p.done}/{p.total}</span>
                    </span>
                    {tab === p.bucket && (
                      <motion.span
                        layoutId="phase-tab-underline"
                        className="absolute left-2 right-2 -bottom-px h-[2px] bg-gold"
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                      />
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>

              {phases.map((p) => (
                <TabsContent key={p.bucket} value={p.bucket} className="mt-5 focus-visible:ring-0">
                  <AnimatePresence mode="wait">
                    <motion.ul
                      key={p.bucket}
                      variants={staggerKids(0.035)}
                      initial="hidden"
                      animate="show"
                      exit={{ opacity: 0 }}
                      className="divide-y divide-hairline"
                    >
                      {tasksByBucket(p.bucket).map(({ item, task }, i) => {
                        const gate = getStepGate(gates, item.id);
                        const rawStatus = (task?.status ??
                          deriveChecklistDisplayStatus(item.id, item, checklistState[item.id]) ??
                          'not-started') as StatusCode;
                        const status = gateDisplayStatus(rawStatus, gate);
                        const tone = STATUS_TONE[status];
                        const openStep = () => {
                          if (!gate.canOpen) {
                            notifyChecklistStepLocked(gate.message);
                            return;
                          }
                          router.push(adminProjectStepPath(eng, item, staffBase));
                        };
                        const row = (
                          <motion.li
                            key={item.id}
                            variants={fadeUp}
                            onClick={openStep}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openStep();
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={cn(
                              'py-3.5 flex items-center gap-4 group -mx-2 px-2 rounded-sm transition-colors',
                              gate.canOpen
                                ? 'cursor-pointer hover:bg-raised/40'
                                : 'cursor-default opacity-70',
                            )}
                          >
                            <Mono className="text-[10px] text-paper-subtle w-8 tabular-nums">{String(i + 1).padStart(2, '0')}</Mono>
                            {gate.kind === 'locked' ? (
                              <Lock className="h-3.5 w-3.5 text-paper-subtle" aria-hidden />
                            ) : (
                              <StatusDot tone={tone.dot} size={8} pulse={status === 'in-progress' || gate.kind === 'active'} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className={cn('text-[13px] truncate', gate.canOpen ? 'text-paper group-hover:text-blue-600 transition-colors' : 'text-paper-muted')}>{item.title}</div>
                              {gate.kind === 'waiting' && gate.message && (
                                <div className="text-[11px] text-warning mt-0.5">{gate.message}</div>
                              )}
                              <MilestoneResponseRowSummary
                                item={item}
                                responses={extractItemResponses(item, checklistState[item.id])}
                                variant="admin"
                              />
                              {shouldShowStatutoryFormLabels(item, 'admin') && (
                                <div className="flex items-center gap-2 mt-1">
                                  {item.forms.slice(0, 3).map((f) => (
                                    <span key={f} className="text-[9.5px] mono uppercase tracking-[0.16em] px-1.5 py-0.5 border border-hairline rounded-sm text-paper-muted">
                                      {f}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              {gate.kind !== 'locked' && (
                                <span className={cn('text-[10.5px] mono uppercase tracking-[0.16em]', tone.cls)}>
                                  {STATUS_LABEL[status]}
                                </span>
                              )}
                              {gate.kind !== 'locked' && (
                                <ChecklistInlineTimeline item={item} className="text-paper-subtle" />
                              )}
                            </span>
                            {gate.canOpen ? (
                              <ChevronRight className="w-3.5 h-3.5 text-paper-subtle group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                            ) : (
                              <Lock className="w-3.5 h-3.5 text-paper-subtle" aria-hidden />
                            )}
                          </motion.li>
                        );
                        return row;
                      })}
                    </motion.ul>
                  </AnimatePresence>
                </TabsContent>
              ))}
            </Tabs>
          </Surface>
        </div>

        {/* RIGHT — Documents, Team, Activity */}
        <div className="space-y-6">
          {(eng.parentEntityName ||
            eng.parentEntityAddress ||
            eng.parentEntityRegistrationNumber) && (
            <Surface className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-3.5 h-3.5 text-gold" />
                <Eyebrow>Parent entity</Eyebrow>
              </div>
              <GoldDivider className="mb-3" />
              <dl className="space-y-3">
                {eng.parentEntityName && (
                  <div>
                    <dt className="text-[10.5px] mono uppercase tracking-[0.14em] text-paper-subtle">Legal name</dt>
                    <dd className="text-[12.5px] text-paper mt-1 leading-snug">{eng.parentEntityName}</dd>
                  </div>
                )}
                {eng.parentEntityRegistrationNumber && (
                  <div>
                    <dt className="text-[10.5px] mono uppercase tracking-[0.14em] text-paper-subtle">
                      Registration number
                    </dt>
                    <dd className="text-[12.5px] text-paper mt-1 leading-snug font-mono">
                      {eng.parentEntityRegistrationNumber}
                    </dd>
                  </div>
                )}
                {eng.parentEntityAddress && (
                  <div>
                    <dt className="text-[10.5px] mono uppercase tracking-[0.14em] text-paper-subtle flex items-center gap-1">
                      <MapPin className="w-3 h-3" aria-hidden />
                      Registered address
                    </dt>
                    <dd className="text-[12.5px] text-paper-muted mt-1 leading-relaxed whitespace-pre-line">
                      {eng.parentEntityAddress}
                    </dd>
                  </div>
                )}
              </dl>
            </Surface>
          )}

          <Surface className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-gold" />
                <Eyebrow>Documents</Eyebrow>
              </div>
              <Mono className="text-[10px] text-paper-subtle">{eRequests.length}</Mono>
            </div>
            <GoldDivider className="mb-3" />
            {eRequests.length === 0 ? (
              <p className="text-[12px] text-paper-muted">No document requests on this project yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {eRequests.slice(0, 5).map((r) => {
                  const Icon = r.status === 'approved' ? CheckCircle2 : r.status === 'uploaded' ? Upload : FileText;
                  const tone = r.status === 'approved' ? 'text-success' : r.status === 'uploaded' ? 'text-info' : 'text-warning';
                  return (
                    <li key={r.id} className="flex items-start gap-2.5 text-[12px]">
                      <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', tone)} />
                      <div className="min-w-0 flex-1">
                        <div className="text-paper truncate">{r.label}</div>
                        <div className="text-[10.5px] mono uppercase tracking-[0.14em] text-paper-subtle mt-0.5">
                          {r.status} {r.dueAt && `· due ${r.dueAt}`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Surface>

          <ProjectDetailTeamPanel intern={intern} leads={leads} />
          <ProjectDetailNotificationsPanel engagementId={eng.id} />
          <ProjectDetailActivityPanel activity={eActivity} />
        </div>
      </div>

      <ProjectDetailResendDialog
        open={resendOpen}
        onOpenChange={setResendOpen}
        clientEmail={eng.clientEmail}
        resending={resending}
        onConfirm={handleResendWelcome}
      />

    </PageTransition>
  );
}
