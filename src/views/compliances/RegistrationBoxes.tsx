'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Eye, EyeOff, Globe2, KeyRound, Landmark, Lightbulb, Receipt, ShieldCheck, Users, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/projects/engagements-db';
import { AppApiError, toastError, toastSuccess } from '@/lib/toast-errors';
import { WordChip } from '@/views/compliances/spectrum-parts';
import type { RegCategory, RegistrationRow } from '@/views/compliances/registration-rows';

/**
 * REGISTRATION BOXES (owner's sketch, 12 November 2026): one rounded box per registration,
 * GST first, then PF, Income tax (PAN and TAN), the FEMA filings, Labour Registers and the rest
 * in checklist order. Each box shows how many clients have it granted.
 *
 * Opening a box:
 * - GST Registration and LUT Filing keep their own process: each client opens the tracker
 *   built for them (`GstRegistrationTracker`, `LutRegistrationTracker`) on the record page.
 * - Every other registration shows the portal username and password, saved encrypted in the
 *   client credentials workbook.
 * - Labour Registers opens the labour registers page, where the role has one.
 */

/** Registrations that keep their own tracker instead of the username and password form. */
const OWN_PROCESS_STEPS: ReadonlySet<string> = new Set(['reg-4', 'reg-5']);

/** The box order of the sketch: GST, PF, Income tax, then the FEMA filings; the rest follow. */
const FIRST_STEPS = ['reg-4', 'reg-5', 'reg-1', 'reg-2', 'reg-20', 'reg-21', 'reg-22', 'reg-23', 'reg-24'];

/** Short, plain names for the boxes whose checklist titles say less than the client knows them by. */
const BOX_NAME: Record<string, string> = {
  'reg-2': 'Income Tax (PAN and TAN)',
};

const CATEGORY_LOOK: Record<RegCategory, { Icon: LucideIcon; accent: string; soft: string }> = {
  Tax: { Icon: Receipt, accent: 'bg-reg-gst', soft: 'bg-positive-soft text-positive' },
  Labour: { Icon: Users, accent: 'bg-reg-labour', soft: 'bg-info-soft text-info' },
  Business: { Icon: Building2, accent: 'bg-warning-mid', soft: 'bg-warning-soft text-warning' },
  IP: { Icon: Lightbulb, accent: 'bg-identity', soft: 'bg-identity-soft text-identity' },
  FEMA: { Icon: Globe2, accent: 'bg-reg-fema', soft: 'bg-brand-soft text-brand-text' },
};

interface RegBox {
  id: string;
  name: string;
  category: RegCategory;
  authority: string;
  rows: RegistrationRow[];
  granted: number;
  live: number;
}

function boxesOf(rows: RegistrationRow[]): RegBox[] {
  const byStep = new Map<string, RegBox>();
  for (const row of rows) {
    let box = byStep.get(row.item.id);
    if (!box) {
      box = {
        id: row.item.id,
        name: BOX_NAME[row.item.id] ?? row.name,
        category: row.category,
        authority: row.authority,
        rows: [],
        granted: 0,
        live: 0,
      };
      byStep.set(row.item.id, box);
    }
    box.rows.push(row);
    if (row.word !== 'Not needed') box.live += 1;
    if (row.word === 'Done') box.granted += 1;
  }
  const rank = (id: string) => {
    const i = FIRST_STEPS.indexOf(id);
    return i >= 0 ? i : FIRST_STEPS.length + Number(id.replace(/\D/g, '') || 0);
  };
  return [...byStep.values()].sort((a, b) => rank(a.id) - rank(b.id));
}

export function RegistrationBoxes({
  rows,
  hrefOf,
  labourRegistersHref,
}: {
  rows: RegistrationRow[];
  /** The registration record page (where the GST and LUT trackers live). */
  hrefOf: (row: RegistrationRow) => string;
  /** The role's labour registers page; null when the role has none. */
  labourRegistersHref?: string | null;
}) {
  const boxes = useMemo(() => boxesOf(rows), [rows]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = boxes.find((box) => box.id === openId) ?? null;
  // Labour Registers sits after the FEMA filings, as on the sketch.
  const labourAt = Math.min(boxes.length, FIRST_STEPS.length);

  const tiles = boxes.map((box) => <BoxTile key={box.id} box={box} onOpen={() => setOpenId(box.id)} />);
  if (labourRegistersHref) tiles.splice(labourAt, 0, <LabourRegistersTile key="labour-registers" href={labourRegistersHref} />);

  return (
    <>
      {boxes.length === 0 ? (
        <p className="rounded-2xl border-1.5 border-line bg-surface-raised px-5 py-8 text-center text-[13.5px] text-ink-muted">
          No registrations in view. A client appears here once it is incorporated.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">{tiles}</div>
      )}

      <Dialog open={open !== null} onOpenChange={(next) => (!next ? setOpenId(null) : undefined)}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          {open ? (
            <>
              <DialogHeader>
                <DialogTitle>{open.name}</DialogTitle>
                <DialogDescription>
                  {open.authority} · {open.category}
                  {OWN_PROCESS_STEPS.has(open.id) ? ' · open a client to follow its application step by step.' : ''}
                </DialogDescription>
              </DialogHeader>
              {OWN_PROCESS_STEPS.has(open.id) ? (
                <OwnProcessList box={open} hrefOf={hrefOf} />
              ) : (
                <PortalLogin box={open} hrefOf={hrefOf} />
              )}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoxTile({ box, onOpen }: { box: RegBox; onOpen: () => void }) {
  const look = CATEGORY_LOOK[box.category];
  const pct = box.live > 0 ? Math.round((box.granted / box.live) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group relative flex min-h-[148px] flex-col gap-3 overflow-hidden rounded-2xl border-1.5 border-line bg-surface-raised p-5 text-left',
        'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-line hover:shadow-[0_8px_24px_rgba(10,37,64,0.08)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', look.accent)} />
      <span className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 flex-none place-items-center rounded-xl', look.soft)}>
          <look.Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] font-semibold leading-snug text-ink">{box.name}</b>
          <span className="block truncate text-[12.5px] text-ink-muted">{box.authority}</span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 flex-none text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text" aria-hidden />
      </span>
      <span className="mt-auto flex flex-col gap-1.5">
        <span className="flex items-baseline justify-between text-[12.5px] text-ink-muted">
          <span>
            <b className="font-semibold tabular-nums text-ink">{box.granted}</b> of {box.live} {box.live === 1 ? 'client' : 'clients'} granted
          </span>
          <span className="tabular-nums">{pct}%</span>
        </span>
        <span className="relative block h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
          {pct > 0 ? <i className="absolute inset-y-0 left-0 rounded-full bg-positive-mid" style={{ width: `${pct}%` }} /> : null}
        </span>
      </span>
    </button>
  );
}

function LabourRegistersTile({ href }: { href: string }) {
  const look = CATEGORY_LOOK.Labour;
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex min-h-[148px] flex-col gap-3 overflow-hidden rounded-2xl border-1.5 border-line bg-surface-raised p-5',
        'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-brand-line hover:shadow-[0_8px_24px_rgba(10,37,64,0.08)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
    >
      <span aria-hidden className={cn('absolute inset-x-0 top-0 h-1', look.accent)} />
      <span className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 flex-none place-items-center rounded-xl', look.soft)}>
          <Landmark className="h-5 w-5" strokeWidth={1.7} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[16px] font-semibold leading-snug text-ink">Labour Registers</b>
          <span className="block truncate text-[12.5px] text-ink-muted">Statutory registers under the labour codes</span>
        </span>
        <ChevronRight className="mt-1 h-4 w-4 flex-none text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text" aria-hidden />
      </span>
      <span className="mt-auto text-[12.5px] text-ink-muted">Open the registers for each client</span>
    </Link>
  );
}

/** GST and LUT: the clients, each opening its own tracker. */
function OwnProcessList({ box, hrefOf }: { box: RegBox; hrefOf: (row: RegistrationRow) => string }) {
  return (
    <ul className="-mx-1 grid gap-1">
      {box.rows.map((row) => (
        <li key={row.key}>
          <Link
            href={hrefOf(row)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">{row.engagement.companyName}</span>
            <WordChip word={row.word === 'Not needed' ? 'Not started' : row.word} />
            <ChevronRight className="h-4 w-4 flex-none text-ink-faint" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every other registration: the portal username and password, one client at a time, read from and
 * saved to the encrypted credentials workbook (Login sheet) through
 * `/api/engagements/[id]/registration-login`. Staff only; the client sees the same login in its
 * own workbook behind a manager-approved grant.
 */
function PortalLogin({ box, hrefOf }: { box: RegBox; hrefOf: (row: RegistrationRow) => string }) {
  const [rowKey, setRowKey] = useState(box.rows[0]?.key ?? '');
  const row = box.rows.find((r) => r.key === rowKey) ?? box.rows[0];
  if (!row) return <p className="text-[13.5px] text-ink-muted">No client has this registration yet.</p>;
  const id = (field: string) => `reg-login-${box.id}-${field}`;

  return (
    <div className="grid gap-4">
      {box.rows.length > 1 ? (
        <div className="grid gap-1.5">
          <Label htmlFor={id('client')}>Client</Label>
          <select
            id={id('client')}
            value={row.key}
            onChange={(event) => setRowKey(event.target.value)}
            className="h-control-md rounded-md border-1.5 border-line-strong bg-surface-raised px-3 text-[14px] text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {box.rows.map((r) => (
              <option key={r.key} value={r.key}>
                {r.engagement.companyName}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[14px] font-medium text-ink">{row.engagement.companyName}</p>
      )}
      {/* Keyed by client, so switching clients starts from that client's saved login. */}
      <LoginForm key={row.key} box={box} row={row} hrefOf={hrefOf} id={id} />
    </div>
  );
}

const LOGIN_ERROR: Record<string, string> = {
  forbidden: 'You do not have access to this client.',
  not_found: 'This client could not be found.',
  empty_value: 'Enter a username or a password.',
};

function loginErrorText(error: unknown): string {
  const code = error instanceof AppApiError ? error.code : undefined;
  return (code && LOGIN_ERROR[code]) || (error instanceof Error ? error.message : 'The login could not be saved.');
}

type SavedLogin = { username: string; password: string };

function LoginForm({
  box,
  row,
  hrefOf,
  id,
}: {
  box: RegBox;
  row: RegistrationRow;
  hrefOf: (row: RegistrationRow) => string;
  id: (field: string) => string;
}) {
  const queryClient = useQueryClient();
  const path = `/api/engagements/${encodeURIComponent(row.engagement.id)}/registration-login`;
  const queryKey = ['registration-login', row.engagement.id, box.id] as const;
  const saved = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<{ ok: true; login: SavedLogin }>(`${path}?step=${encodeURIComponent(box.id)}`, {
        fallbackError: 'The saved login could not be loaded.',
        cache: 'no-store',
      }).then((body) => body.login),
    staleTime: 0,
  });
  const [draft, setDraft] = useState<SavedLogin | null>(null);
  const [show, setShow] = useState(false);
  const value: SavedLogin = draft ?? saved.data ?? { username: '', password: '' };
  const dirty =
    draft !== null && (draft.username !== (saved.data?.username ?? '') || draft.password !== (saved.data?.password ?? ''));
  const set = (patch: Partial<SavedLogin>) => setDraft({ ...value, ...patch });

  const save = useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true; login: SavedLogin }>(path, {
        method: 'PUT',
        body: JSON.stringify({ step: box.id, username: value.username, password: value.password }),
        fallbackError: 'The login could not be saved.',
      }).then((body) => body.login),
    onSuccess: (login) => {
      queryClient.setQueryData(queryKey, login);
      setDraft(null);
      setShow(false);
      toastSuccess(`${box.name} login saved for ${row.engagement.companyName}`);
    },
    onError: (error) => toastError('Login not saved', loginErrorText(error)),
  });

  return (
    <>
      <form
        className="grid gap-3 rounded-2xl border-1.5 border-line bg-surface-sunken/60 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !save.isPending) save.mutate();
        }}
      >
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <KeyRound className="h-4 w-4 text-brand-text" aria-hidden />
          {box.name} portal login
          {saved.isLoading ? <span className="font-normal text-ink-muted">· loading…</span> : null}
        </p>
        <div className="grid gap-1.5">
          <Label htmlFor={id('username')}>Username</Label>
          <Input
            id={id('username')}
            autoComplete="off"
            value={value.username}
            onChange={(event) => set({ username: event.target.value })}
            placeholder="Portal username"
            disabled={saved.isLoading}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={id('password')}>Password</Label>
          <div className="relative">
            <Input
              id={id('password')}
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={value.password}
              onChange={(event) => set({ password: event.target.value })}
              placeholder="Portal password"
              className="pr-10"
              disabled={saved.isLoading}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink-muted hover:text-ink"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </div>
        </div>
        {saved.isError ? (
          <p className="text-[12px] text-danger">{loginErrorText(saved.error)}</p>
        ) : (
          <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-positive" aria-hidden />
            Stored encrypted in the client&apos;s credentials workbook. Every change is logged.
          </p>
        )}
      </form>

      <div className="flex items-center justify-between gap-3">
        <Link href={hrefOf(row)} className="text-[13px] font-medium text-brand-text hover:underline">
          Open the full record →
        </Link>
        <Button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending || saved.isLoading}>
          {save.isPending ? 'Saving…' : 'Save login'}
        </Button>
      </div>
    </>
  );
}
