"use client";

import { useParams, useRouter, redirect } from 'next/navigation';
import { RedirectTo } from '@/components/routing/RedirectTo';
import { useEffect, useMemo, useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { PhaseTimeline, Phase } from '@/components/admin/PhaseTimeline';
import { AccentKpi } from '@/components/admin/AccentKpi';
import { SEO } from '@/components/SEO';
import { checklist, BUCKET_LABEL, Bucket, STATUS_LABEL, StatusCode } from '@/data/checklist';
import { COMPANY_TYPE_LABEL } from '@/data/engagements';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Surface, GoldButton, Eyebrow, Mono, StatusDot, GoldDivider } from '@/components/noir';
import { ChevronLeft, ListChecks, AlertTriangle, FolderCheck, FileText, Upload, CheckCircle2, Users, Activity, ChevronRight, Mail, Loader2, Building2, MapPin } from 'lucide-react';
import { HexgridLoader } from '@/components/common/HexgridLoader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toastError, toastEmailDispatch } from '@/lib/toast-errors';
import { requestResendWelcomeEmail } from '@/lib/email/request-resend-welcome-email';
import { cn } from '@/lib/utils';
import { fadeUp, staggerKids } from '@/lib/motion';
import { MilestoneResponseRowSummary } from '@/views/incorporation/MilestoneResponseRowSummary';
import { extractItemResponses } from '@/lib/checklist-responses';
import { shouldShowStatutoryFormLabels } from '@/lib/checklist-field-access';
import { adminProjectPath, adminProjectStepPath } from '@/lib/project-step-path';
import { ProjectDetailView } from '@/views/admin/ProjectDetailSections';
import { resolveEngagementFromRouteParam } from '@/lib/slug';
import { isAdminOrManager } from '@/lib/auth';
import { useStaffBasePath } from '@/hooks/use-staff-base-path';

const BUCKETS: Bucket[] = ['pre-inc', 'post-inc', 'fema', 'statutory'];

const STATUS_TONE: Record<StatusCode, { dot: 'gold' | 'success' | 'warning' | 'danger' | 'info' | 'muted'; cls: string }> = {
  'not-started':     { dot: 'muted',   cls: 'text-paper-subtle' },
  'in-progress':     { dot: 'info',    cls: 'text-info' },
  'awaiting-client': { dot: 'warning', cls: 'text-warning' },
  completed:         { dot: 'success', cls: 'text-success' },
  overdue:           { dot: 'danger',  cls: 'text-danger' },
  'not-applicable':  { dot: 'muted',   cls: 'text-paper-subtle' },
};

export default function ProjectDetail() {
  const params = useParams();
  const slugParam = params.slug as string;
  const {
    engagements,
    tasks,
    teamMembers,
    internOptions,
    requests,
    activity,
    user,
    getStateForEngagement,
    refreshEngagementChecklist,
    engagementsLoading,
  } = useApp();
  const owners = internOptions.length ? internOptions : teamMembers;
  const [resendOpen, setResendOpen] = useState(false);
  const [resending, setResending] = useState(false);
  const [checklistRefreshing, setChecklistRefreshing] = useState(false);
  const router = useRouter();
  const staffBase = useStaffBasePath();

  const eng = useMemo(
    () => resolveEngagementFromRouteParam(engagements, slugParam),
    [engagements, slugParam],
  );

  useEffect(() => {
    if (!eng?.id) return;
    let cancelled = false;
    setChecklistRefreshing(true);
    void refreshEngagementChecklist(eng.id).finally(() => {
      if (!cancelled) setChecklistRefreshing(false);
    });
    return () => {
      cancelled = true;
    };
  }, [eng?.id, refreshEngagementChecklist]);

  const eTasks = useMemo(() => tasks.filter((t) => t.engagementId === eng?.id), [tasks, eng?.id]);
  const eRequests = useMemo(() => requests.filter((r) => r.engagementId === eng?.id), [requests, eng?.id]);
  const eActivity = useMemo(() => activity.filter((a) => a.engagementId === eng?.id).slice(0, 8), [activity, eng?.id]);

  const phasesForTab = useMemo(() => {
    if (!eng) return null;
    const result: Array<{
      key: typeof BUCKETS[number];
      bucket: typeof BUCKETS[number];
      label: string;
      percent: number;
      status: Phase['status'];
      total: number;
      done: number;
    }> = [];
    for (const b of BUCKETS) {
      const keysSet = new Set<string>();
      for (const c of checklist) {
        if (c.bucket === b) keysSet.add(c.id);
      }
      let done = 0;
      let total = 0;
      for (const t of eTasks) {
        if (keysSet.has(t.checklistKey)) {
          total += 1;
          if (t.status === 'completed') done += 1;
        }
      }
      const pct = total ? Math.round((done / total) * 100) : 0;
      const status: Phase['status'] = pct === 100 ? 'completed' : pct > 0 ? 'in-progress' : 'not-started';
      result.push({ key: b, bucket: b, label: BUCKET_LABEL[b], percent: pct, status, total, done });
    }
    return result;
  }, [eng, eTasks]);

  const defaultPhase = phasesForTab?.find((p) => p.status === 'in-progress')?.bucket ?? BUCKETS[0];
  const [tab, setTab] = useState<Bucket>(defaultPhase);

  const checklistState = useMemo(
    () => (eng ? getStateForEngagement(eng) : {}),
    [getStateForEngagement, eng],
  );

  const checklistLoading = engagementsLoading || checklistRefreshing;

  if (!eng && engagementsLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <HexgridLoader />
      </div>
    );
  }

  if (eng?.slug && slugParam !== eng.slug) {
    redirect(adminProjectPath(eng, staffBase));
  }

  if (!eng) return <RedirectTo href={`${staffBase}/projects`} />;

  const intern = owners.find((t) => t.id === eng.internId) ?? teamMembers.find((t) => t.id === eng.internId);
  const leadIds =
    eng.leadIds && eng.leadIds.length > 0
      ? eng.leadIds
      : eng.internId?.trim()
        ? [eng.internId]
        : [];
  const leads = leadIds
    .map((id) => {
      const m = owners.find((t) => t.id === id) ?? teamMembers.find((t) => t.id === id);
      return m ? { id: m.id, name: m.name } : null;
    })
    .filter((x): x is { id: string; name: string } => Boolean(x));
  const canResendWelcome =
    isAdminOrManager(user?.role) && Boolean(eng.clientUserId && eng.clientEmail);

  const handleResendWelcome = async () => {
    setResending(true);
    try {
      const result = await requestResendWelcomeEmail(eng.id);
      const to = eng.clientEmail ?? '';
      toastEmailDispatch(
        result.ok
          ? { attempted: 1, sent: [to], skipped: [], failed: [] }
          : result.skipped
            ? { attempted: 1, sent: [], skipped: [to], failed: [] }
            : { attempted: 1, sent: [], skipped: [], failed: [to] },
        {
          engagementId: eng.id,
          companyName: eng.companyName,
          href: '#',
        },
      );
      if (result.ok) setResendOpen(false);
    } catch (err) {
      toastError(
        "Welcome email didn't send",
        err instanceof Error ? err.message : 'Try again in a moment.',
      );
    } finally {
      setResending(false);
    }
  };

  const phases = phasesForTab!;

  const overall = Math.round(phases.reduce((s, p) => s + p.percent, 0) / phases.length);
  const active = phases.find((p) => p.status === 'in-progress')?.label ?? 'All phases complete';
  const blockers = eTasks.filter((t) => t.status === 'awaiting-client').length;
  const pendingDocs = eRequests.filter((r) => r.status === 'pending').length;

  const tasksByBucket = (b: Bucket) => {
    const meta = checklist.filter((c) => c.bucket === b);
    return meta.map((item) => {
      const t = eTasks.find((x) => x.checklistKey === item.id);
      return { item, task: t };
    });
  };

  const viewProps = {
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
  };
  return <ProjectDetailView {...viewProps} />;
}
