'use client';

import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { NoirDatePicker } from '@/components/noir/NoirDatePicker';
import { useSubjectInputs } from '@/components/compliances/use-compliance-records';
import { fmtLong, type GstSchedule } from '@/lib/registrations/gst-tracker';
import { LUT_FIELD, LUT_STEP_ID, financialYearOf, lutNotice, lutStages, lutValidTill } from '@/lib/registrations/lut-tracker';
import {
  Field,
  Fields,
  NoticeBar,
  READ_ONLY_NOTE,
  RecordList,
  SaveRow,
  useDraft,
  useTrackerSave,
  val,
} from '@/components/compliances/GstRegistrationTracker';
import { TrackerCard } from '@/components/compliances/tracker-card';

/**
 * LUT tracker (`reg-5`): the Letter of Undertaking, Form GST RFD-11, on the registration
 * record in the firm's shells (edit) and the client portal (read). Two stages: the
 * application filed, then the LUT number the GST portal allots. The financial year and the
 * validity follow from the dates.
 *
 * Policy SBC-STD-AI-02: the authorised signatory files on the GST portal in their own
 * session. This page records what that person reads there. It asks for no GST login,
 * password, OTP or EVC, and nothing here signs in to or reads the portal.
 *
 * The project lead and the client record; the manager, the admin and the super admin read
 * (`tracker-access.ts`, enforced in the repository). Values save to the registration's SBC
 * fields. The repository also writes the filing date and the LUT number to the `reg-5`
 * checklist answers (`lutFilingDate`, `lutArn`), which the registration facts and the
 * credentials workbook already read. Rules: `lut-tracker.ts`.
 */

const STAGE_TITLE = { filing: 'Application filed', allotted: 'LUT allotted' } as const;
const FILING_KEYS = [LUT_FIELD.loginCreatedOn, LUT_FIELD.filedOn] as const;
const ALLOTTED_KEYS = [LUT_FIELD.allottedOn, LUT_FIELD.number] as const;

export function LutRegistrationTracker({
  engagementId,
  gstDay,
  canEdit,
  audience,
  today,
}: {
  /** The app engagement id; undefined for the client, whose own engagement the API resolves. */
  engagementId?: string;
  /** The GST registration day; the LUT is filed the same day. */
  gstDay: GstSchedule;
  /** The project lead and the client record; the manager and the admins read. */
  canEdit: boolean;
  /** Who reads the notice: the firm gets its instructions, the client the facts. */
  audience: 'firm' | 'client';
  /** ISO date, India time. */
  today: string;
}) {
  const q = useSubjectInputs({ engagementId, kind: 'registration', key: LUT_STEP_ID });
  const { save, saving } = useTrackerSave(engagementId, LUT_STEP_ID);
  const values: Record<string, string | null> = Object.fromEntries((q.data?.sbc ?? []).map((f) => [f.key, f.value]));
  const stages = lutStages(values);
  const notice = lutNotice(gstDay, values, today, audience);
  const fy = val(values, LUT_FIELD.fy) || financialYearOf(val(values, LUT_FIELD.allottedOn) || val(values, LUT_FIELD.filedOn));
  const till = lutValidTill(fy);

  const filing = useDraft(values, FILING_KEYS);
  const allotted = useDraft(values, ALLOTTED_KEYS);

  const filingTab = canEdit ? (
              <>
                <p className="mb-3 text-[13px] text-ink-muted">
                  The authorised signatory files Form GST RFD-11 on the GST portal. Record the dates the portal shows.
                </p>
                <Fields>
                  <Field id="lut-login-on" label="GST login created on" hint="The date the GST portal login became active.">
                    <NoirDatePicker id="lut-login-on" value={filing.draft[LUT_FIELD.loginCreatedOn] ?? ''} onChange={(v) => filing.set(LUT_FIELD.loginCreatedOn, v)} />
                  </Field>
                  <Field id="lut-filed-on" label="LUT application filed on">
                    <NoirDatePicker id="lut-filed-on" value={filing.draft[LUT_FIELD.filedOn] ?? ''} onChange={(v) => filing.set(LUT_FIELD.filedOn, v)} />
                  </Field>
                  <Field id="lut-fy" label="Financial year">
                    <Input id="lut-fy" readOnly tabIndex={-1} value={financialYearOf(filing.draft[LUT_FIELD.filedOn]) ?? fy ?? ''} placeholder="Follows from the filing date" className="bg-surface-sunken/40" />
                  </Field>
                </Fields>
                <SaveRow
                  dirty={filing.dirty}
                  saving={saving}
                  onClick={() => {
                    const patch = filing.patch();
                    const year = financialYearOf(patch[LUT_FIELD.filedOn]);
                    void save({ ...patch, ...(year ? { [LUT_FIELD.fy]: year } : {}) }, 'LUT filing saved');
                  }}
                />
              </>
            ) : (
              <RecordList
                rows={[
                  { k: 'GST login created on', v: fmtLong(val(values, LUT_FIELD.loginCreatedOn)) || null },
                  { k: 'LUT application filed on', v: fmtLong(val(values, LUT_FIELD.filedOn)) || null },
                  { k: 'Financial year', v: fy },
                ]}
              />
            );
  const allottedTab = canEdit ? (
              <>
                <p className="mb-3 text-[13px] text-ink-muted">Check the acknowledgement on the GST portal, then record the allotment date and the LUT number.</p>
                <Fields>
                  <Field id="lut-allotted-on" label="Date allotted by the GST portal">
                    <NoirDatePicker id="lut-allotted-on" value={allotted.draft[LUT_FIELD.allottedOn] ?? ''} onChange={(v) => allotted.set(LUT_FIELD.allottedOn, v)} />
                  </Field>
                  <Field id="lut-number" label="LUT number (ARN)">
                    <Input
                      id="lut-number"
                      className="font-mono"
                      placeholder="e.g. AD2911260012345"
                      value={allotted.draft[LUT_FIELD.number] ?? ''}
                      onChange={(e) => allotted.set(LUT_FIELD.number, e.target.value.toUpperCase())}
                    />
                  </Field>
                  <Field id="lut-valid-till" label="Valid until">
                    <Input id="lut-valid-till" readOnly tabIndex={-1} value={till ? fmtLong(till) : ''} placeholder="End of the financial year" className="bg-surface-sunken/40" />
                  </Field>
                </Fields>
                <SaveRow dirty={allotted.dirty} saving={saving} onClick={() => void save(allotted.patch(), 'LUT number saved')} />
              </>
            ) : (
              <RecordList
                rows={[
                  { k: 'Date allotted by the GST portal', v: fmtLong(val(values, LUT_FIELD.allottedOn)) || null },
                  { k: 'LUT number (ARN)', v: val(values, LUT_FIELD.number) || null, mono: true },
                  { k: 'Valid until', v: till ? fmtLong(till) : null },
                ]}
              />
            );

  return (
    <TrackerCard
      label="LUT progress"
      title="Letter of Undertaking (LUT)"
      form="Form GST RFD-11 · filed on the GST portal"
      facts={[
        { k: 'Application filed on', v: fmtLong(val(values, LUT_FIELD.filedOn)) || null },
        { k: 'Date allotted', v: fmtLong(val(values, LUT_FIELD.allottedOn)) || null },
        { k: 'LUT number', v: val(values, LUT_FIELD.number) || null, mono: true },
        { k: 'Valid until', v: till ? fmtLong(till) : null },
      ]}
      notice={notice ? <NoticeBar tone={notice.tone} text={notice.text} /> : null}
      initialTab={stages[1]!.state === 'current' ? 1 : 0}
      readOnlyNote={!canEdit && audience === 'firm' ? READ_ONLY_NOTE : undefined}
      loading={q.isLoading}
      error={q.isError ? 'The LUT record could not be loaded. Refresh the page to try again.' : null}
      tabs={[
        { title: STAGE_TITLE.filing, complete: stages[0]!.state === 'done', content: filingTab },
        { title: STAGE_TITLE.allotted, complete: stages[1]!.state === 'done', content: allottedTab },
      ]}
    />
  );
}

/** The LUT day for the record head: the GST registration day from the firm calendar. */
export function LutScheduleDate({ gstDay }: { gstDay: GstSchedule }) {
  const scheduled = gstDay.source === 'calendar' && gstDay.date;
  return (
    <div className="flex items-start gap-2.5" aria-label="LUT filing date">
      <CalendarDays aria-hidden className="mt-0.5 h-4 w-4 flex-none text-ink-muted" />
      <div className="min-w-0">
        <em className="block text-[12px] not-italic text-ink-muted">LUT filing date</em>
        <b className="block whitespace-nowrap text-[15px] font-semibold text-ink">{scheduled ? fmtLong(gstDay.date) : 'Not scheduled'}</b>
        <span className="block text-[11.5px] text-ink-faint">{scheduled ? 'Same day as GST registration' : 'Follows the GST registration day'}</span>
      </div>
    </div>
  );
}
