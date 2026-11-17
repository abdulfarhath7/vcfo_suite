'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { standardDownloadName } from '@/lib/files/download-name';
import type { Density } from '@/lib/ui/table-prefs';
import { useRouter, useSearchParams } from 'next/navigation';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { sheetDate } from '@/lib/receivables/dates';
import { isForeign } from '@/lib/receivables/fx';
import { sheetKpis } from '@/lib/receivables/kpis';
import type { InvoicePatch } from '@/lib/receivables/model';
import type { ShareFilters } from '@/lib/receivables/share-filters';
import { monthsOf, receivedThisWeek, sumInr } from '@/lib/receivables/summary';
import type { ManagerInvoiceDto, ManagerSheetDto } from '@/lib/receivables/wire';
import { useBulkInvoiceActions, type BulkResult, type useReceivablesActions } from '@/hooks/use-receivables';
import { useReportsActions } from '@/hooks/use-receivables-reports';
import { fxInput, invoiceName } from './cell-utils';
import { downloadCsv, invoicesCsv } from './export-csv';
import type { RowAction } from './row-menu';
import { filterInvoices, filtersFromParams, isFiltered, paramsWithFilters } from './sheet-filters';

/**
 * The Sheet tab's state (Phase 10, the large-view rule: state here, the JSX in SheetTab.tsx and
 * the render parts beside this file). Filters live in the URL; the selection, the open dialog
 * and the history drawer live here.
 */

type Actions = ReturnType<typeof useReceivablesActions>;

export type SheetDialog =
  | { kind: 'mark' | 'pause' | 'fx' | 'notes' | 'history' | 'dispute' | 'credit' | 'delete' | 'change-amount'; invoice: ManagerInvoiceDto }
  | { kind: 'add' | 'bulk-received' | 'bulk-pause' | 'share-view' }
  | null;

export type RowGroup = { key: string; title: string; rows: ManagerInvoiceDto[]; totalLabel?: string };

const DENSITY_KEY = 'vcfo.receivables.sheet-density';

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Try again.');

export function useSheetTab(data: ManagerSheetDto, actions: Actions, today: string) {
  const router = useRouter();
  const params = useSearchParams();
  const sheetId = data.sheet.id;
  const report = useReportsActions(sheetId);
  const bulk = useBulkInvoiceActions(sheetId);

  /* Filters, kept in the query string. */
  const paramText = params.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(paramText)), [paramText]);
  const setFilters = useCallback(
    (next: ShareFilters) => {
      const q = paramsWithFilters(window.location.search.replace(/^\?/, ''), next);
      router.replace(`/receivables/manager${q ? `?${q}` : ''}`, { scroll: false });
    },
    [router],
  );
  const patchFilters = (patch: Partial<ShareFilters>) => setFilters({ ...filters, ...patch });

  // The search box types into local state and reaches the URL after a short pause.
  const [search, setSearch] = useState(filters.search ?? '');
  useEffect(() => setSearch(filters.search ?? ''), [filters.search]);
  useEffect(() => {
    if ((filters.search ?? '') === search.trim()) return;
    const t = setTimeout(() => setFilters({ ...filters, search: search.trim() || undefined }), 250);
    return () => clearTimeout(t);
  }, [search, filters, setFilters]);

  /*
   * v2: "Fix in Tally" (`fix=1` in the URL) keeps only invoices whose approved staff amount change
   * is not in the Tally books yet. It is the sheet's own filter, not part of a shared view.
   */
  const fixInTally = params.get('fix') === '1';
  const setFixInTally = (on: boolean) => {
    const q = new URLSearchParams(window.location.search.replace(/^\?/, ''));
    if (on) q.set('fix', '1');
    else q.delete('fix');
    router.replace(`/receivables/manager${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };
  const tallyMismatches = data.invoices.filter((i) => i.tallyMismatch).length;
  /** Clear filters: the shared ones and "Fix in Tally". */
  const clearFilters = () => {
    const q = new URLSearchParams(paramsWithFilters(window.location.search.replace(/^\?/, ''), {}));
    q.delete('fix');
    router.replace(`/receivables/manager${q.toString() ? `?${q}` : ''}`, { scroll: false });
  };

  /* Rows. */
  const rows = useMemo(() => {
    const kept = filterInvoices(data.invoices, data.partners, filters, today);
    return fixInTally ? kept.filter((i) => i.tallyMismatch) : kept;
  }, [data.invoices, data.partners, filters, today, fixInTally]);
  const status = filters.status ?? 'open';
  const months = monthsOf(data.invoices);
  const groups: RowGroup[] = useMemo(() => {
    const ms = monthsOf(rows);
    return ms.map((m) => ({ key: m, title: m, rows: rows.filter((r) => r.invoiceMonth === m).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.clientName.localeCompare(b.clientName)) }));
  }, [rows]);
  const receivedWeek = useMemo(
    () => (status === 'open' ? filterInvoices(data.invoices.filter((i) => receivedThisWeek(i, today)), data.partners, { ...filters, status: 'received' }, today) : []),
    [data.invoices, data.partners, filters, status, today],
  );
  const kpis = useMemo(() => sheetKpis(data.invoices, today), [data.invoices, today]);
  // A received row counts what arrived; an open row its open balance.
  const total = sumInr(rows.map((r) => ({ amountInr: r.status === 'received' ? (r.paidAmount ?? r.amountInr) : r.amountInr })));
  const clients = useMemo(() => [...new Set(data.invoices.map((i) => i.clientName))].sort((a, b) => a.localeCompare(b)), [data.invoices]);
  const currencies = useMemo(() => [...new Set(data.invoices.map((i) => (i.currency ?? 'INR').toUpperCase()))].sort(), [data.invoices]);
  const hasForeign = rows.some((i) => isForeign(fxInput(i))) || receivedWeek.some((i) => isForeign(fxInput(i)));
  const partnerNames = useMemo(() => Object.fromEntries(data.partners.map((p) => [p.slug, p.name])), [data.partners]);

  /* Compact layout: row density (kept in the browser) and folded month blocks (this visit only). */
  // Compact unless this person chose Comfortable on this sheet before.
  const [density, setDensityState] = useState<Density>('compact');
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DENSITY_KEY) === 'comfortable') setDensityState('comfortable');
    } catch {
      /* No storage: compact for this visit. */
    }
  }, []);
  const setDensity = (d: Density) => {
    setDensityState(d);
    try {
      window.localStorage.setItem(DENSITY_KEY, d);
    } catch {
      /* No storage: the choice lasts for this visit. */
    }
  };
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const toggleFold = (key: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /* Selection: only rows on screen stay picked. */
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const visibleIds = useMemo(() => new Set([...rows, ...receivedWeek].map((r) => r.id)), [rows, receivedWeek]);
  useEffect(() => {
    setPicked((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleMany = (ids: string[], on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  const clearPicked = () => setPicked(new Set());
  const pickedRows = data.invoices.filter((i) => picked.has(i.id));

  /* Dialogs. */
  const [dialog, setDialog] = useState<SheetDialog>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const close = () => {
    setDialog(null);
    setDialogError(null);
  };
  const savedToDraft = () => (close(), toastSuccess('Saved in the draft', 'Click Update to show it on the client page.'));

  const edit = (inv: ManagerInvoiceDto, patch: InvoicePatch) => actions.updateInvoice.mutate({ id: inv.id, patch }, { onError: (e) => toastError('Not saved', errorText(e)) });

  const runRow = (a: RowAction, inv: ManagerInvoiceDto) => {
    setDialogError(null);
    if (a === 'resume')
      return actions.pause.mutate({ id: inv.id, until: null, reason: null }, { onSuccess: () => toastSuccess('Reminders resumed'), onError: (e) => toastError('Not saved', errorText(e)) });
    if (a === 'reopen') return actions.reopen.mutate(inv.id, { onSuccess: () => toastSuccess('Set back to open', 'Click Update to show it on the client page.'), onError: (e) => toastError('Not saved', errorText(e)) });
    if (a === 'resolve')
      return report.resolveDispute.mutate(inv.id, { onSuccess: () => toastSuccess('Dispute resolved', 'Reminders resume if the dispute paused them.'), onError: (e) => toastError('Not saved', errorText(e)) });
    setDialog({ kind: a, invoice: inv });
  };

  const bulkDone = (what: string, r: BulkResult, skipped = 0) => {
    clearPicked();
    close();
    const extra = [r.failed.length ? `${r.failed.length} failed: ${r.failed[0]!.error}` : '', skipped ? `${skipped} skipped` : ''].filter(Boolean).join(' · ');
    if (r.failed.length && !r.done) toastError(`${what}: nothing saved`, extra);
    else toastSuccess(`${what}: ${r.done} invoice${r.done === 1 ? '' : 's'}`, extra || undefined);
  };

  /** Bulk Mark received settles INR invoices in full; a foreign invoice needs its INR credited, so it is skipped. */
  const bulkReceivable = pickedRows.filter((r) => r.status === 'open' && !isForeign(fxInput(r)));
  /** Invoices just saved as received: the "Payment received — send an email?" pop-up offers them. */
  const [receivedPopup, setReceivedPopup] = useState<string[] | null>(null);
  const bulkReceive = (paidOn: string) => {
    const skipped = pickedRows.length - bulkReceivable.length;
    const ids = bulkReceivable.map((r) => r.id);
    bulk.markReceived.mutate(
      { items: bulkReceivable.map((r) => ({ id: r.id, amount: r.amountInr })), paidOn },
      {
        onSuccess: (r) => {
          bulkDone(`Marked received on ${sheetDate(paidOn)}`, r, skipped);
          const failed = new Set(r.failed.map((f) => f.id));
          const done = ids.filter((id) => !failed.has(id));
          if (done.length) setReceivedPopup(done);
        },
        onError: (e) => setDialogError(errorText(e)),
      },
    );
  };
  const bulkPause = (until: string | null, reason: string | null) => {
    const ids = pickedRows.filter((r) => r.status === 'open').map((r) => r.id);
    bulk.pause.mutate({ ids, until, reason }, { onSuccess: (r) => bulkDone(until ? `Reminders paused to ${sheetDate(until)}` : 'Reminders resumed', r, pickedRows.length - ids.length), onError: (e) => setDialogError(errorText(e)) });
  };
  const bulkAssign = (partnerId: string | null, name: string) =>
    bulk.assignPartner.mutate({ ids: pickedRows.map((r) => r.id), partnerId }, { onSuccess: (r) => bulkDone(`Assigned to ${name}`, r), onError: (e) => toastError('Not saved', errorText(e)) });
  const exportPicked = () => {
    downloadCsv(standardDownloadName('Receivables', data.sheet.clientOrgName, 'csv'), invoicesCsv(pickedRows, data.partners, today));
    toastSuccess(`Exported ${pickedRows.length} invoice${pickedRows.length === 1 ? '' : 's'}`);
  };

  return {
    sheetId,
    filters,
    setFilters,
    patchFilters,
    filtered: isFiltered(filters) || fixInTally,
    fixInTally,
    setFixInTally,
    clearFilters,
    density,
    setDensity,
    folded,
    toggleFold,
    tallyMismatches,
    search,
    setSearch,
    status,
    rows,
    groups,
    receivedWeek,
    kpis,
    total,
    months,
    clients,
    currencies,
    hasForeign,
    partnerNames,
    picked,
    pickedRows,
    toggle,
    toggleMany,
    clearPicked,
    dialog,
    setDialog,
    dialogError,
    setDialogError,
    close,
    savedToDraft,
    edit,
    runRow,
    report,
    bulk,
    bulkReceivable,
    bulkReceive,
    receivedPopup,
    setReceivedPopup,
    bulkPause,
    bulkAssign,
    exportPicked,
    invoiceName,
    errorText,
  };
}

export type SheetTabState = ReturnType<typeof useSheetTab>;
