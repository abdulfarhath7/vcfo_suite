'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  REPORT_FORMAT_LABEL,
  REPORT_FORMATS,
  REPORT_SCHEDULE_LABEL,
  REPORT_SCHEDULES,
  monthKeyLabel,
  type ReportFormat,
  type ReportSchedule,
  type SavedReport,
} from '@/lib/reports/partner-report';
import type { SavedReportValues } from '@/views/super/reports/use-saved-reports';

/**
 * Save the partner report (G-21): a name, which month (the one on screen, or always the
 * latest), the format (PDF, or a CSV file Excel opens, P-225), a schedule (none, weekly,
 * monthly) and the recipients. The same dialog changes a
 * saved report's schedule.
 */
const LABEL = 'mb-1 block text-[13px] font-medium text-ink';
const SELECT =
  'h-control-md w-full rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] text-ink focus-visible:border-brand focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitRecipients(raw: string): string[] {
  return [...new Set(raw.split(/[\s,;]+/).map((s) => s.trim().toLowerCase()).filter(Boolean))];
}

export function SaveReportDialog({
  open,
  onOpenChange,
  report,
  monthKey,
  monthLabel,
  defaultRecipient,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null to save the report on screen. */
  report: SavedReport | null;
  /** The month on screen (YYYY-MM) and its label. */
  monthKey: string;
  monthLabel: string;
  defaultRecipient: string;
  saving: boolean;
  onSave: (values: SavedReportValues) => void;
}) {
  const [name, setName] = useState('');
  const [latest, setLatest] = useState(true);
  const [schedule, setSchedule] = useState<ReportSchedule>('none');
  const [format, setFormat] = useState<ReportFormat>('pdf');
  const [recipients, setRecipients] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(report?.name ?? 'Partner report');
    setLatest(report ? report.params.month === 'latest' : true);
    setSchedule(report?.schedule ?? 'monthly');
    setFormat(report?.params.format ?? 'pdf');
    setRecipients((report?.recipients ?? (defaultRecipient ? [defaultRecipient] : [])).join(', '));
  }, [open, report, defaultRecipient]);

  const list = splitRecipients(recipients);
  const bad = list.filter((e) => !EMAIL.test(e));
  const needsRecipient = schedule !== 'none' && list.length === 0;
  const fixedMonth = report && report.params.month !== 'latest' ? report.params.month : monthKey;
  const fixedLabel = report && report.params.month !== 'latest' ? monthKeyLabel(report.params.month) : monthLabel;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (bad.length > 0 || needsRecipient) return;
    onSave({ name: name.trim(), params: { month: latest ? 'latest' : fixedMonth, ...(format === 'csv' ? { format } : {}) }, schedule, recipients: list });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-medium">{report ? 'Schedule report' : 'Save report'}</DialogTitle>
        </DialogHeader>
        <form id="save-report-form" onSubmit={submit} className="grid gap-3.5">
          <div>
            <label htmlFor="sr-name" className={LABEL}>Name</label>
            <Input id="sr-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <fieldset>
            <legend className={LABEL}>Month</legend>
            <div className="grid gap-1.5 text-[13.5px] text-ink">
              <label className="flex items-center gap-2">
                <input type="radio" name="sr-month" checked={latest} onChange={() => setLatest(true)} />
                Always the latest month
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sr-month" checked={!latest} onChange={() => setLatest(false)} />
                {fixedLabel} only
              </label>
            </div>
          </fieldset>
          <div>
            <label htmlFor="sr-format" className={LABEL}>Format</label>
            <select id="sr-format" className={SELECT} value={format} onChange={(e) => setFormat(e.target.value as ReportFormat)}>
              {REPORT_FORMATS.map((f) => (
                <option key={f} value={f}>{REPORT_FORMAT_LABEL[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sr-schedule" className={LABEL}>Repeat</label>
            <select id="sr-schedule" className={SELECT} value={schedule} onChange={(e) => setSchedule(e.target.value as ReportSchedule)}>
              {REPORT_SCHEDULES.map((s) => (
                <option key={s} value={s}>{REPORT_SCHEDULE_LABEL[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="sr-to" className={LABEL}>Send to</label>
            <Textarea
              id="sr-to"
              rows={2}
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              aria-invalid={bad.length > 0 || needsRecipient}
              placeholder="partner@firm.in, admin@firm.in"
            />
            {bad.length > 0 ? (
              <p className="mt-1 text-[12.5px] text-danger">Not an email: {bad.join(', ')}</p>
            ) : needsRecipient ? (
              <p className="mt-1 text-[12.5px] text-danger">Add a recipient for a schedule</p>
            ) : null}
          </div>
        </form>
        <DialogFooter className="gap-2">
          <Button type="button" variant="quiet" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="save-report-form" disabled={saving || !name.trim() || bad.length > 0 || needsRecipient}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
