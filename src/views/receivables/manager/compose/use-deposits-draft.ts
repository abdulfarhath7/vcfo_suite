'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_DEPOSITS_TITLE, DEPOSIT_LIMITS, amountProblem, depositsPayload, emptyDraftRow, type DepositDraftRow, type DepositsSection } from '@/lib/receivables/deposits';

/**
 * The state of the security deposits section in the Send email pop-up (owner, 23 Nov 2026). This
 * browser remembers the last rows of the sheet (localStorage, by sheet id), so next week the person
 * edits them instead of typing them again; `clear` forgets them. Nothing goes to the server until
 * the person sends, and then only `payload`.
 */
type Stored = { title: string; rows: DepositDraftRow[] };
const storageKey = (sheetId: string) => `vcfo:rcv-deposits:${sheetId}`;

function readStored(sheetId: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sheetId));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (!Array.isArray(v.rows)) return null;
    const text = (x: unknown) => (typeof x === 'string' ? x : '');
    const rows = v.rows.slice(0, DEPOSIT_LIMITS.rows).map((r: Partial<DepositDraftRow>) => ({ client: text(r?.client), status: text(r?.status), eta: text(r?.eta), amount: text(r?.amount), due: text(r?.due) }));
    return { title: text(v.title) || DEFAULT_DEPOSITS_TITLE, rows };
  } catch {
    return null;
  }
}

function writeStored(sheetId: string, value: Stored | null) {
  try {
    if (value) window.localStorage.setItem(storageKey(sheetId), JSON.stringify(value));
    else window.localStorage.removeItem(storageKey(sheetId));
  } catch {
    // A private window or blocked storage: the rows are simply not remembered.
  }
}

/** The pop-up's deposits state: rows, title, whether the section is in the email, and its payload. */
export function useDepositsDraft(sheetId: string) {
  const [title, setTitleState] = useState(DEFAULT_DEPOSITS_TITLE);
  const [rows, setRowsState] = useState<DepositDraftRow[]>([emptyDraftRow()]);
  // Off each time the pop-up opens, so last week's rows never go out unseen; any edit turns it on.
  const [include, setInclude] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const stored = readStored(sheetId);
    if (stored) {
      setTitleState(stored.title);
      setRowsState(stored.rows.length ? stored.rows : [emptyDraftRow()]);
    }
    setLoaded(true);
  }, [sheetId]);
  useEffect(() => {
    if (!loaded) return;
    const filled = rows.some((r) => Object.values(r).some((v) => v.trim()));
    writeStored(sheetId, filled ? { title, rows } : null);
  }, [loaded, sheetId, title, rows]);
  const setRows = (next: DepositDraftRow[]) => {
    setRowsState(next.length ? next : [emptyDraftRow()]);
    setInclude(true);
  };
  const setTitle = (t: string) => {
    setTitleState(t);
    setInclude(true);
  };
  const clear = () => {
    setTitleState(DEFAULT_DEPOSITS_TITLE);
    setRowsState([emptyDraftRow()]);
    setInclude(false);
    writeStored(sheetId, null);
  };
  const problems = rows.map((r, i) => ({ row: i + 1, text: r.amount.trim(), bad: amountProblem(r.amount) })).filter((p) => p.bad);
  const payload: DepositsSection | null = useMemo(() => (include ? depositsPayload(title, rows) : null), [include, title, rows]);
  return { title, rows, include, setTitle, setRows, setInclude, clear, problems: include ? problems : [], payload };
}

export type DepositsDraft = ReturnType<typeof useDepositsDraft>;

