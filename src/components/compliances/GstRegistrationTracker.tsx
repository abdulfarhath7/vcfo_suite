'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Check, CircleAlert, Info, Loader2, ShieldCheck, Upload } from 'lucide-react';
import { REGISTRATION_FACTS_KEY } from '@/hooks/use-registration-facts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SkeletonRows } from '@/components/ui/empty-state';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { toastSaved } from '@/components/ui/toast-saved';
import { errorMessage, toastError } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { useInputsAction, useSubjectInputs } from '@/components/compliances/use-compliance-records';
import { TrackerCard } from '@/components/compliances/tracker-card';
import { useApp } from '@/context/AppContext';
import { checklistStateKeyForEngagement } from '@/lib/checklist/checklist-state-key';
import { uploadMilestoneDocument } from '@/lib/documents/milestone-document-storage';
import {
  GST_FIELD,
  GST_STEP_ID,
  fmtLong,
  gstNotice,
  gstOutcome,
  gstStages,
  type GstSchedule,
  type GstStageKey,
  type GstStageState,
} from '@/lib/registrations/gst-tracker';

/**
 * GST registration tracker (`reg-4`), shown on the registration record in the firm's
 * shells and the client portal. The application is filed on the GST portal; this records
 * its milestones in order: application filed (ARN), Aadhaar authentication, SRN, and the
 * outcome (approved, or resubmission with the reason and the revised date).
 *
 * The project lead and the client record; the manager, the admin and the super admin read
 * (`tracker-access.ts`, enforced in the repository). Milestones save to the registration's
 * SBC fields. On approval the repository also writes the GSTIN and the date of registration
 * to the checklist step, which starts the GST return calendar. Rules and dates:
 * `src/lib/registrations/gst-tracker.ts`.
 *
 * Policy SBC-STD-AI-02: the authorised signatory files on the GST portal in their own
 * session. This page records the outcome a person reads there; it asks for no portal
 * password, OTP or EVC, and nothing here signs in to or reads the portal.
 */

const STAGE_TITLE: Record<GstStageKey, string> = {
  filing: 'Application filed',
  aadhaar: 'Aadhaar authentication',
  srn: 'Service request number (SRN)',
  outcome: 'Outcome',
};

const STATE_WORD: Record<GstStageState, string> = {
  done: 'Completed',
  current: 'In progress',
  upcoming: 'Not started',
  attention: 'Resubmission required',
};

export function GstRegistrationTracker({
  engagementId,
  schedule,
  canEdit,
  audience,
  today,
  certificate,
}: {
  /** The app engagement id; undefined for the client, whose own engagement the API resolves. */
  engagementId?: string;
  schedule: GstSchedule;
  /** The project lead and the client record; the manager and the admins read. */
  canEdit: boolean;
  /** Who reads the notice: the firm gets its instructions, the client the facts. */
  audience: 'firm' | 'client';
  /** ISO date, India time. */
  today: string;
  /** The certificate download, when one is on file. */
  certificate?: ReactNode;
}) {
  const q = useSubjectInputs({ engagementId, kind: 'registration', key: GST_STEP_ID });
  const { save, saving } = useTrackerSave(engagementId, GST_STEP_ID);
  const values: Record<string, string | null> = Object.fromEntries((q.data?.sbc ?? []).map((f) => [f.key, f.value]));
  const stages = gstStages(values);
  const notice = gstNotice(schedule, values, today, audience);

  const stageProps = { values, canEdit, saving, onSave: save };
  const content: Record<GstStageKey, ReactNode> = {
    filing: <FilingStage {...stageProps} />,
    aadhaar: <AadhaarStage {...stageProps} />,
    srn: <SrnStage {...stageProps} />,
    outcome: <OutcomeStage {...stageProps} engagementId={engagementId} certificate={certificate} />,
  };
  const current = Math.max(0, stages.findIndex((st) => st.state === 'current' || st.state === 'attention'));
  const outcome = gstOutcome(values);

  return (
    <TrackerCard
      label="GST registration progress"
      title="GST registration"
      form="Form GST REG-01 · filed on the GST portal"
      facts={[
        { k: 'ARN', v: val(values, GST_FIELD.arn) || null, mono: true },
        { k: 'Aadhaar authentication', v: val(values, GST_FIELD.aadhaar) === 'done' ? 'Completed' : 'Yet to be done' },
        { k: 'SRN', v: val(values, GST_FIELD.srn) || null, mono: true },
        {
          k: outcome === 'resubmission' ? 'Outcome' : 'GSTIN',
          v: outcome === 'resubmission' ? 'Resubmission required' : val(values, GST_FIELD.gstin) || null,
          mono: outcome !== 'resubmission',
        },
      ]}
      notice={notice ? <NoticeBar tone={notice.tone} text={notice.text} /> : null}
      initialTab={stages.every((st) => st.state === 'done') ? 0 : current}
      readOnlyNote={!canEdit && audience === 'firm' ? READ_ONLY_NOTE : undefined}
      loading={q.isLoading}
      error={q.isError ? 'The registration record could not be loaded. Refresh the page to try again.' : null}
      tabs={stages.map((st) => ({
        title: STAGE_TITLE[st.key],
        complete: st.state === 'done',
        attention: st.state === 'attention',
        content: (
          <>
            <p className={cn('mb-3 text-[12.5px] font-medium', STATE_TONE[st.state])}>{STATE_WORD[st.state]}</p>
            {content[st.key]}
          </>
        ),
      }))}
    />
  );
}

const STATE_TONE: Record<GstStageState, string> = {
  done: 'text-positive',
  current: 'text-brand-text',
  upcoming: 'text-ink-muted',
  attention: 'text-danger',
};

/* ------------------------------------------------------------------ */
/* frame                                                               */
/* ------------------------------------------------------------------ */

export function NoticeBar({ tone, text }: { tone: 'info' | 'warning' | 'positive' | 'danger'; text: string }) {
  const Icon = tone === 'positive' ? ShieldCheck : tone === 'info' ? Info : tone === 'warning' ? AlertTriangle : CircleAlert;
  return (
    <p
      role="status"
      className={cn(
        'flex items-start gap-2.5 border-t border-line-soft px-5 py-2.5 text-[13.5px]',
        tone === 'info' && 'bg-info-soft text-ink',
        tone === 'warning' && 'bg-warning-soft text-ink',
        tone === 'positive' && 'bg-positive-soft text-ink',
        tone === 'danger' && 'bg-danger-soft text-ink',
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          'mt-0.5 h-4 w-4 flex-none',
          tone === 'info' && 'text-info',
          tone === 'warning' && 'text-warning',
          tone === 'positive' && 'text-positive',
          tone === 'danger' && 'text-danger',
        )}
      />
      <span>{text}</span>
    </p>
  );
}

type StageProps = {
  values: Record<string, string | null>;
  canEdit: boolean;
  saving: boolean;
  onSave: (patch: Record<string, string | null>, message?: string) => Promise<boolean>;
};

export const val = (values: Record<string, string | null>, key: string) => (values[key] ?? '').trim();

/** Shown to the manager and the admins, who see the tracker but do not record it. */
export const READ_ONLY_NOTE = 'View only. The project lead or the client records each stage.';

/**
 * Save a tracker's SBC fields, then refresh what reads them: the record, the registration
 * facts (number, date) and, for staff, the checklist (the repository copies the GSTIN, the
 * date of registration and the LUT values onto the step).
 */
export function useTrackerSave(engagementId: string | undefined, key: string) {
  const act = useInputsAction();
  const qc = useQueryClient();
  const { refreshEngagementChecklist } = useApp();
  const save = (patch: Record<string, string | null>, message = 'Saved') =>
    new Promise<boolean>((resolve) => {
      act.mutate(
        { action: 'save', engagementId: engagementId || undefined, kind: 'registration', key, side: 'sbc', values: patch },
        {
          onSuccess: () => {
            toastSaved(message);
            void qc.invalidateQueries({ queryKey: [REGISTRATION_FACTS_KEY] });
            if (engagementId) void refreshEngagementChecklist(engagementId).catch(() => undefined);
            resolve(true);
          },
          onError: (e) => {
            toastError('Could not save', errorMessage(e));
            resolve(false);
          },
        },
      );
    });
  return { save, saving: act.isPending };
}

/** Local copy of some fields, reset when the saved values change. */
export function useDraft(values: Record<string, string | null>, keys: readonly string[]) {
  const saved = Object.fromEntries(keys.map((k) => [k, val(values, k)]));
  const savedKey = JSON.stringify(saved);
  const [draft, setDraft] = useState<Record<string, string>>(saved);
  useEffect(() => setDraft(JSON.parse(savedKey) as Record<string, string>), [savedKey]);
  const dirty = keys.some((k) => (draft[k] ?? '') !== saved[k]);
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const patch = () => Object.fromEntries(keys.map((k) => [k, (draft[k] ?? '').trim() || null]));
  return { draft, set, dirty, patch };
}

export function Field({ id, label, children, hint, wide }: { id: string; label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return (
    <div className={cn('grid min-w-0 gap-1.5', wide && 'sm:col-span-2 lg:col-span-3')}>
      <Label htmlFor={id} className="text-[12.5px] font-medium text-ink-2">
        {label}
      </Label>
      {children}
      {hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

export function Fields({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

export function RecordList({ rows }: { rows: Array<{ k: string; v: string | null; mono?: boolean }> }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <dt className="text-[12.5px] text-ink-muted">{r.k}</dt>
          <dd className={cn('mt-0.5 break-words text-[14px] font-medium', r.v ? 'text-ink' : 'font-normal text-ink-faint', r.v && r.mono && 'font-mono text-[13.5px]')}>
            {r.v || 'Not recorded'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SaveRow({ dirty, saving, onClick, label = 'Save' }: { dirty: boolean; saving: boolean; onClick: () => void; label?: string }) {
  return (
    <div className="mt-3 flex justify-end">
      <Button size="sm" onClick={onClick} disabled={!dirty || saving}>
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
        {label}
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* stages                                                              */
/* ------------------------------------------------------------------ */

const FILING_KEYS = [GST_FIELD.filedOn, GST_FIELD.arn, GST_FIELD.arnDate] as const;

function FilingStage({ values, canEdit, saving, onSave }: StageProps) {
  const d = useDraft(values, FILING_KEYS);
  if (!canEdit) {
    return (
      <RecordList
        rows={[
          { k: 'Application filed on', v: fmtLong(val(values, GST_FIELD.filedOn)) || null },
          { k: 'Application reference number (ARN)', v: val(values, GST_FIELD.arn) || null, mono: true },
          { k: 'ARN generated on', v: fmtLong(val(values, GST_FIELD.arnDate)) || null },
        ]}
      />
    );
  }
  return (
    <>
      <p className="mb-3 text-[13px] text-ink-muted">File Form GST REG-01 on the GST portal, then record the filing date and the ARN issued.</p>
      <Fields>
        <Field id="gst-filed-on" label="Application filed on">
          <NoirDatePicker id="gst-filed-on" value={d.draft[GST_FIELD.filedOn] ?? ''} onChange={(v) => d.set(GST_FIELD.filedOn, v)} />
        </Field>
        <Field id="gst-arn" label="Application reference number (ARN)">
          <Input
            id="gst-arn"
            className="font-mono"
            placeholder="e.g. AA2911260123456"
            value={d.draft[GST_FIELD.arn] ?? ''}
            onChange={(e) => d.set(GST_FIELD.arn, e.target.value.toUpperCase())}
          />
        </Field>
        <Field id="gst-arn-date" label="ARN generated on">
          <NoirDatePicker id="gst-arn-date" value={d.draft[GST_FIELD.arnDate] ?? ''} onChange={(v) => d.set(GST_FIELD.arnDate, v)} />
        </Field>
      </Fields>
      <SaveRow dirty={d.dirty} saving={saving} onClick={() => void onSave(d.patch(), 'Application details saved')} />
    </>
  );
}

function AadhaarStage({ values, canEdit, saving, onSave }: StageProps) {
  const doneNow = val(values, GST_FIELD.aadhaar) === 'done';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="inline-flex items-center gap-2.5">
        <Checkbox
          id="gst-aadhaar"
          checked={doneNow}
          disabled={!canEdit || saving}
          onCheckedChange={(c) => void onSave({ [GST_FIELD.aadhaar]: c === true ? 'done' : 'pending' }, c === true ? 'Aadhaar authentication marked complete' : 'Aadhaar authentication marked as yet to be done')}
        />
        <Label htmlFor="gst-aadhaar" className={cn('text-[14px] font-normal text-ink', canEdit ? 'cursor-pointer' : 'cursor-default')}>
          Aadhaar authentication completed
        </Label>
      </div>
      <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-medium', doneNow ? 'bg-positive-soft text-positive' : 'bg-surface-sunken text-ink-muted')}>
        {doneNow ? 'Completed' : 'Yet to be done'}
      </span>
    </div>
  );
}

function SrnStage({ values, canEdit, saving, onSave }: StageProps) {
  const d = useDraft(values, [GST_FIELD.srn]);
  if (!canEdit) return <RecordList rows={[{ k: 'Service request number (SRN)', v: val(values, GST_FIELD.srn) || null, mono: true }]} />;
  return (
    <>
      <Fields>
        <Field id="gst-srn" label="Service request number (SRN)">
          <Input
            id="gst-srn"
            className="font-mono"
            placeholder="Enter the SRN"
            value={d.draft[GST_FIELD.srn] ?? ''}
            onChange={(e) => d.set(GST_FIELD.srn, e.target.value.toUpperCase())}
          />
        </Field>
      </Fields>
      <SaveRow dirty={d.dirty} saving={saving} onClick={() => void onSave(d.patch(), 'SRN saved')} />
    </>
  );
}

const APPROVED_KEYS = [GST_FIELD.gstin, GST_FIELD.registeredOn, GST_FIELD.jurisdiction] as const;
const RESUBMIT_KEYS = [GST_FIELD.rejectionReason, GST_FIELD.revisedDate] as const;
const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function OutcomeStage({
  values,
  canEdit,
  saving,
  onSave,
  engagementId,
  certificate,
}: StageProps & { engagementId?: string; certificate?: ReactNode }) {
  const outcome = gstOutcome(values);
  const [choice, setChoice] = useState<'approved' | 'resubmission' | null>(outcome);
  useEffect(() => setChoice(outcome), [outcome]);
  const approved = useDraft(values, APPROVED_KEYS);
  const resubmit = useDraft(values, RESUBMIT_KEYS);
  const { engagements } = useApp();
  const engagement = engagementId ? engagements.find((e) => e.id === engagementId) : undefined;

  if (!canEdit) {
    if (outcome === 'approved') {
      return (
        <div className="grid gap-3">
          <RecordList
            rows={[
              { k: 'GSTIN', v: val(values, GST_FIELD.gstin) || null, mono: true },
              { k: 'Date of registration', v: fmtLong(val(values, GST_FIELD.registeredOn)) || null },
              { k: 'Jurisdiction', v: val(values, GST_FIELD.jurisdiction) || null },
            ]}
          />
          {certificate}
        </div>
      );
    }
    if (outcome === 'resubmission') {
      return (
        <RecordList
          rows={[
            { k: 'Reason for rejection', v: val(values, GST_FIELD.rejectionReason) || null },
            { k: 'Revised date', v: fmtLong(val(values, GST_FIELD.revisedDate)) || null },
          ]}
        />
      );
    }
    return <p className="text-[13px] text-ink-muted">Awaiting the decision of the GST department.</p>;
  }

  const gstin = (approved.draft[GST_FIELD.gstin] ?? '').trim().toUpperCase();
  const gstinError = gstin && !GSTIN_RE.test(gstin) ? 'Enter a valid 15-character GSTIN.' : null;

  // The repository copies the GSTIN and the date of registration onto the checklist step,
  // which starts the GST return calendar. Both are sent so the copy is complete.
  const saveApproved = async () => {
    if (gstinError) return;
    await onSave({ ...approved.patch(), [GST_FIELD.gstin]: gstin || null, [GST_FIELD.registeredOn]: approved.draft[GST_FIELD.registeredOn] || null, [GST_FIELD.outcome]: 'approved' }, 'Approval recorded');
  };

  return (
    <div className="grid gap-4">
      <div role="radiogroup" aria-label="Outcome" className="inline-flex w-fit flex-wrap gap-1 rounded-md border border-line bg-surface-sunken/60 p-1">
        {(
          [
            ['approved', 'Approved'],
            ['resubmission', 'Resubmission required'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={choice === key}
            onClick={() => setChoice(key)}
            className={cn(
              'cursor-pointer rounded px-3.5 py-1.5 text-[13px] font-medium transition-colors',
              choice === key ? (key === 'approved' ? 'bg-positive text-white' : 'bg-danger text-white') : 'text-ink-2 hover:bg-surface-raised',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {choice === 'approved' ? (
        <>
          <Fields>
            <Field id="gst-gstin" label="GSTIN">
              <Input
                id="gst-gstin"
                className="font-mono"
                placeholder="e.g. 29AABCS1429B1Z1"
                maxLength={15}
                value={approved.draft[GST_FIELD.gstin] ?? ''}
                onChange={(e) => approved.set(GST_FIELD.gstin, e.target.value.toUpperCase())}
                aria-invalid={gstinError ? true : undefined}
              />
              {gstinError ? <p className="text-[12px] font-medium text-danger">{gstinError}</p> : null}
            </Field>
            <Field id="gst-registered-on" label="Date of registration">
              <NoirDatePicker id="gst-registered-on" value={approved.draft[GST_FIELD.registeredOn] ?? ''} onChange={(v) => approved.set(GST_FIELD.registeredOn, v)} />
            </Field>
            <Field id="gst-jurisdiction" label="Jurisdiction (optional)">
              <Input id="gst-jurisdiction" value={approved.draft[GST_FIELD.jurisdiction] ?? ''} onChange={(e) => approved.set(GST_FIELD.jurisdiction, e.target.value)} />
            </Field>
          </Fields>
          <SaveRow dirty={approved.dirty || outcome !== 'approved'} saving={saving} onClick={() => void saveApproved()} label="Save approval" />
          {/* The lead uploads REG-06 to the checklist step; the client sees the download once it is on file. */}
          {engagement ? <CertificateUpload engagementId={engagement.id} scopeId={checklistStateKeyForEngagement(engagement)} certificate={certificate} /> : certificate}
        </>
      ) : choice === 'resubmission' ? (
        <>
          <Fields>
            <Field id="gst-rejection" label="Reason for rejection, as stated in the portal notice" wide>
              <Textarea
                id="gst-rejection"
                rows={4}
                maxLength={2000}
                value={resubmit.draft[GST_FIELD.rejectionReason] ?? ''}
                onChange={(e) => resubmit.set(GST_FIELD.rejectionReason, e.target.value)}
              />
            </Field>
            <Field id="gst-revised-date" label="Revised date">
              <NoirDatePicker id="gst-revised-date" value={resubmit.draft[GST_FIELD.revisedDate] ?? ''} onChange={(v) => resubmit.set(GST_FIELD.revisedDate, v)} />
            </Field>
          </Fields>
          <SaveRow
            dirty={resubmit.dirty || outcome !== 'resubmission'}
            saving={saving}
            onClick={() => void onSave({ ...resubmit.patch(), [GST_FIELD.outcome]: 'resubmission' }, 'Resubmission recorded')}
            label="Save resubmission"
          />
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">Record the decision once the GST department responds.</p>
      )}
    </div>
  );
}

/** Registration certificate (REG-06), stored on the checklist step like every certificate. */
function CertificateUpload({ engagementId, scopeId, certificate }: { engagementId: string; scopeId: string; certificate?: ReactNode }) {
  const { updateItem } = useApp();
  const [busy, setBusy] = useState(false);
  const onPick = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      const path = await uploadMilestoneDocument(engagementId, 'gstCertificateUrl', file, { stepId: GST_STEP_ID });
      await updateItem(scopeId, GST_STEP_ID, { responses: { gstCertificateUrl: path } }, { clientResponsesOnly: true });
      toastSaved('Registration certificate uploaded');
    } catch (e) {
      toastError('Upload failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-[13.5px] font-semibold text-ink">Registration certificate (REG-06)</span>
      {certificate}
      <label className="ml-auto inline-flex cursor-pointer items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-sunken">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
        Upload certificate
        <input type="file" accept=".pdf,image/*" className="sr-only" disabled={busy} onChange={(e) => void onPick(e.target.files?.[0] ?? null)} />
      </label>
    </div>
  );
}

/** The registration day for the record head, from the firm calendar; the LUT is filed the same day. */
export function GstScheduleDates({ schedule }: { schedule: GstSchedule }) {
  const label = schedule.source === 'deadline' ? 'Statutory deadline' : 'GST registration date';
  const caption =
    schedule.source === 'calendar'
      ? 'Application and LUT filed on this day'
      : schedule.source === 'deadline'
        ? 'Not yet scheduled on the firm calendar'
        : null;
  return (
    <div className="flex items-start gap-2.5" aria-label="GST registration date">
      <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 flex-none text-ink-muted" />
      <div className="min-w-0">
        <em className="block text-[12px] not-italic text-ink-muted">{label}</em>
        <b className="block whitespace-nowrap text-[15px] font-semibold text-ink">{schedule.date ? fmtLong(schedule.date) : 'Not scheduled'}</b>
        {caption ? <span className="block text-[11.5px] text-ink-faint">{caption}</span> : null}
      </div>
    </div>
  );
}
