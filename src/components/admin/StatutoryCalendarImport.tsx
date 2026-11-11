'use client';

import { useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FilterSelect } from '@/components/ui/native-select';
import { useStatutoryCalendarImport } from '@/hooks/use-statutory-calendar';
import { fyBounds } from '@/lib/statutory-calendar/fy';
import type { StatutoryCalendarImportResponse } from '@/lib/statutory-calendar/types';
import { toastSuccess } from '@/lib/toast-errors';

const TEMPLATE_URL = '/api/statutory-calendar/template';
const ERRORS_SHOWN = 40;

const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The admin's two calendar actions: download the Excel template, and import a filled one for a
 * financial year. Importing is two steps. "Check file" reads the sheet and lists every problem by
 * Excel row; "Publish" is enabled only for a clean file and replaces that year's calendar.
 */
export function StatutoryCalendarImport({
  importableYears,
  defaultYear,
  sourceYear,
  onPublished,
}: {
  /** The years the server accepts, oldest first. */
  importableYears: readonly string[];
  /** The year the dialog opens on. */
  defaultYear: string;
  /** A year with a calendar, offered as a filled template to start from. */
  sourceYear: string | null;
  onPublished: (fy: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fy, setFy] = useState(defaultYear);
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [result, setResult] = useState<StatutoryCalendarImportResponse | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const importFile = useStatutoryCalendarImport();

  const reset = () => {
    setFile(null);
    setResult(null);
    setFailure(null);
    setInputKey((k) => k + 1);
  };

  const openDialog = () => {
    setFy(importableYears.includes(defaultYear) ? defaultYear : importableYears[0]);
    reset();
    setOpen(true);
  };

  const run = (publish: boolean) => {
    if (!file) return;
    setFailure(null);
    importFile.mutate(
      { file, fy, publish },
      {
        onSuccess: (body) => {
          setResult(body);
          if (body.published) {
            toastSuccess(`${body.fy.label} calendar published`, plural(body.summary.total, 'deadline'));
            setOpen(false);
            onPublished(body.fy.key);
          }
        },
        onError: (err) => setFailure(err instanceof Error ? err.message : 'The file could not be checked. Try again.'),
      },
    );
  };

  const clean = result != null && result.errors.length === 0 && result.fy.key === fy;
  const busy = importFile.isPending;

  return (
    <>
      <Button asChild variant="secondary" size="sm">
        <a href={TEMPLATE_URL} download>
          <Download aria-hidden />
          Download template
        </a>
      </Button>
      <Button variant="strong" size="sm" onClick={openDialog}>
        <Upload aria-hidden />
        Import calendar
      </Button>

      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
        title="Import statutory calendar"
        description="Choose the financial year and the filled-in Excel template, check it, then publish."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            {clean ? (
              <Button variant="strong" onClick={() => run(true)} disabled={busy}>
                {busy ? 'Publishing' : `Publish ${fyBounds(fy).label}`}
              </Button>
            ) : (
              <Button variant="strong" onClick={() => run(false)} disabled={busy || !file}>
                {busy ? 'Checking' : 'Check file'}
              </Button>
            )}
          </>
        }
      >
        <div className="grid gap-4 text-[13.5px] text-ink-2">
          <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
            <div className="grid gap-1.5">
              <Label htmlFor="stat-import-fy">Financial year</Label>
              <FilterSelect
                id="stat-import-fy"
                size="md"
                className="w-full [&>select]:w-full"
                value={fy}
                disabled={busy}
                onChange={(event) => {
                  setFy(event.target.value);
                  setResult(null);
                }}
                options={importableYears.map((key) => ({ value: key, label: fyBounds(key).label }))}
              />
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="stat-import-file">Excel file (.xlsx)</Label>
              <input
                key={inputKey}
                id="stat-import-file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={busy}
                className="min-w-0 text-[13px] text-ink-2 file:mr-2.5 file:h-control-sm file:rounded-md file:border-1.5 file:border-line-strong file:bg-surface-raised file:px-2.5 file:text-[13px] file:font-medium file:text-ink"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setFailure(null);
                }}
              />
            </div>
          </div>

          <p className="text-[12.5px] text-ink-muted">
            Fill in the{' '}
            <a className="font-medium text-brand-text hover:underline" href={TEMPLATE_URL} download>
              blank template
            </a>
            {sourceYear ? (
              <>
                , or start from{' '}
                <a
                  className="font-medium text-brand-text hover:underline"
                  href={`${TEMPLATE_URL}?fy=${encodeURIComponent(sourceYear)}`}
                  download
                >
                  the {fyBounds(sourceYear).label} calendar
                </a>{' '}
                and change its dates
              </>
            ) : null}
            . Publishing replaces the whole calendar for the year you pick.
          </p>

          {failure ? (
            <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-danger">
              {failure}
            </p>
          ) : null}

          {result && result.fy.key === fy ? <ImportResult result={result} /> : null}
        </div>
      </Modal>
    </>
  );
}

function ImportResult({ result }: { result: StatutoryCalendarImportResponse }) {
  const { summary, errors, warnings, replaces, fy } = result;
  if (errors.length) {
    return (
      <section className="grid gap-2" aria-live="polite">
        <p className="font-semibold text-danger">
          {plural(errors.length, 'problem')} to fix in {result.fileName}. Nothing was saved.
        </p>
        <div className="max-h-72 overflow-auto rounded-md border border-line">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-surface-sunken text-[12px] font-semibold text-ink-2">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Column</th>
                <th className="px-3 py-2">Problem</th>
              </tr>
            </thead>
            <tbody>
              {errors.slice(0, ERRORS_SHOWN).map((e, i) => (
                <tr key={`${e.row}-${e.column ?? ''}-${i}`} className="border-t border-line-soft align-top">
                  <td className="px-3 py-1.5 tabular-nums">{e.row || '-'}</td>
                  <td className="whitespace-nowrap px-3 py-1.5">{e.column ?? '-'}</td>
                  <td className="px-3 py-1.5">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {errors.length > ERRORS_SHOWN ? (
          <p className="text-[12.5px] text-ink-muted">The first {ERRORS_SHOWN} are shown. Fix these and check the file again.</p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="grid gap-3" aria-live="polite">
      <p>
        <span className="font-semibold text-ink">{plural(summary.total, 'deadline')}</span> for {fy.label} in{' '}
        {result.fileName}. The file is ready to publish.
      </p>
      {replaces ? (
        <p className="rounded-md bg-warning-soft px-3 py-2 text-warning">
          {fy.label} already has a calendar of {plural(replaces.rowCount, 'deadline')}
          {replaces.source === 'built-in'
            ? ' built into the app'
            : replaces.importedAt
              ? `, imported on ${dateLabel(replaces.importedAt)}${replaces.importedByName ? ` by ${replaces.importedByName}` : ''}`
              : ''}
          . Publishing replaces it.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <CountList title="By month" rows={summary.months.map((m) => ({ label: monthLabel(m.month), count: m.count }))} />
        <CountList title="By act" rows={summary.acts} />
      </div>
      {warnings.length ? (
        <div className="grid gap-1 text-[12.5px] text-ink-muted">
          {warnings.slice(0, 10).map((w, i) => (
            <p key={`${w.row}-${i}`}>
              Row {w.row}: {w.message}
            </p>
          ))}
          {warnings.length > 10 ? <p>And {plural(warnings.length - 10, 'more repeated row')}.</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function CountList({ title, rows }: { title: string; rows: readonly { label: string; count: number }[] }) {
  return (
    <div className="rounded-md border border-line">
      <p className="border-b border-line-soft bg-surface-sunken px-3 py-1.5 text-[12px] font-semibold text-ink-2">{title}</p>
      <ul className="max-h-56 overflow-auto">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between gap-3 border-b border-line-soft px-3 py-1.5 last:border-b-0">
            <span>{row.label}</span>
            <span className="tabular-nums text-ink">{row.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
