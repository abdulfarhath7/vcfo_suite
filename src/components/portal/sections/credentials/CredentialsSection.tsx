'use client';

/**
 * Credentials (prototype a6_rest.js renderCredentials / renderSheet, body.txt
 * CREDENTIALS + #otpm): the attention line, portal key cards that open in
 * place, the sheet tabs and the sheet itself. Every value comes from the real
 * workbook (GET /api/client/credentials): the key cards are the Login
 * Credentials rows that hold something, the sheets are the five real sheets
 * (Registrations, Addresses, Directors KYC, Other credentials, All logins)
 * and the identifiers (CIN, PAN, TAN, GSTIN) head the Registrations sheet.
 *
 * Secrets stay masked. Showing or changing anything asks for a 6-digit OTP
 * that goes to the client's Project Manager and opens a 10-minute grant on a
 * scope (whole page, one sheet, one row, or one cell) — enforced by the server
 * (src/db/repositories/credentials.ts). Kept from the previous page: Preview /
 * Edit / Lock per page, sheet and row; Reveal / Hide per cell; inline cell edits
 * (PATCH …/cells) with Undo; status select; Add row / Add director (POST
 * …/rows, Undo = DELETE); certificates open through a signed URL; the Access
 * log (GET …/log). Staff see the clear values without an OTP.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CRED_STATUS,
  KYC_ROWS,
  LABEL_COL,
  cellLabel,
  scopeLabel,
  scopesCovering,
  tabLabel,
  type CredMode,
  type CredSheet,
  type CredentialsLogEntry,
  type CredentialsPayload,
  type WireCell,
  type WireCol,
  type WireGrant,
  type WireIdTile,
  type WireRow,
  type WireSheet,
} from '@/lib/client-portal/credentials';
import { useNavBadge, usePaletteItems, usePortal, type PaletteItem } from '../../runtime';
import { getJson, PK } from '../../data';
import { fmtY, todayIso } from '../../dates';
import { ModalBox } from '../../overlays';
import { Btn, GoArrow, Icon, lawVar, SecError, SecHead, SecLoading, Seg } from '../../ui';
import { attention, canEdit, fmtLeft, KSTAT, liveGrants, MASK, modeOf, portalKeys, previewed, until, type PortalKey } from './model';
import { OtpModal } from './Otp';
import '../../css/95-credentials.css';

const QK = [PK, 'credentials'] as const;
const TABS: Array<[CredSheet, string]> = [
  ['reg', 'Registrations'],
  ['address', 'Addresses'],
  ['kyc', 'Directors KYC'],
  ['other', 'Other credentials'],
  ['login', 'All logins'],
];
const AUTH: Record<WireIdTile['auth'], string> = { mca: 'MCA', it: 'Income Tax Dept.', gst: 'GSTN' };

/* ---------------------------------------------------------------- shared state for the tiles, the sheet and the cells */

interface Ctx {
  data: CredentialsPayload;
  grants: WireGrant[];
  staff: boolean;
  now: number;
  edit: { key: string; v: string } | null;
  startEdit: (key: string, v: string) => void;
  commitEdit: (v: string) => void;
  cancelEdit: () => void;
  save: (key: string, value: string) => Promise<void>;
  askOtp: (mode: CredMode, scope: string) => void;
  lock: (scope: string) => Promise<void>;
  copy: (v: string) => void;
  openCert: (name: string, path: string) => void;
  label: (key: string) => string;
}
const CredCtx = createContext<Ctx | null>(null);
const useCred = (): Ctx => {
  const v = useContext(CredCtx);
  if (!v) throw new Error('CredCtx');
  return v;
};

/* ================================================================ section */

export function CredentialsSection() {
  const { shell, toast, openModal, closeModal, go } = usePortal();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: QK,
    queryFn: async () => (await getJson<{ credentials: CredentialsPayload }>('/api/client/credentials'))?.credentials ?? null,
    staleTime: 15_000,
  });
  const data = q.data ?? null;
  const setData = useCallback((p: CredentialsPayload) => qc.setQueryData(QK, p), [qc]);
  const refetch = useCallback(() => qc.invalidateQueries({ queryKey: QK }), [qc]);

  /* clock for grant countdowns; an expired grant re-masks from the server */
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const grants = useMemo(() => liveGrants(data?.grants, now), [data?.grants, now]);
  const staff = Boolean(data?.staff);
  const expiredSeen = useRef(0);
  useEffect(() => {
    const exp = (data?.grants ?? []).filter((g) => new Date(g.expiresAt).getTime() <= now).length;
    if (exp > expiredSeen.current) void refetch();
    expiredSeen.current = exp;
  }, [now, data?.grants, refetch]);

  const [tab, setTab] = useState<CredSheet>('reg');
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());
  const [edit, setEdit] = useState<{ key: string; v: string } | null>(null);
  const [hl, setHl] = useState<string | null>(null);

  const keys = useMemo(() => portalKeys(data?.sheets.login), [data]);
  const attn = useMemo(() => attention(keys), [keys]);
  useNavBadge('credentials', keys.filter((k) => k.status === 'expired').length || undefined);

  /* ---------- API */
  const api = useCallback(
    async (path: string, method: string, body?: unknown): Promise<{ ok: boolean; rowKey?: string; error?: string }> => {
      try {
        const res = await fetch(`/api/client/credentials${path}`, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
        const out = (await res.json().catch(() => ({}))) as { ok?: boolean; credentials?: CredentialsPayload; rowKey?: string; error?: string };
        if (out.credentials) setData(out.credentials);
        if (!res.ok) return { ok: false, error: out.error ?? String(res.status) };
        return { ok: true, rowKey: out.rowKey };
      } catch {
        return { ok: false, error: 'network' };
      }
    },
    [setData],
  );
  const failToast = useCallback(
    (error?: string) => toast(error === 'edit_grant_required' ? 'Read-only. Choose Edit and enter the code to change values.' : 'Could not save. Try again.'),
    [toast],
  );

  const label = useCallback((key: string) => (data ? cellLabel(data.sheets, data.ids, key) : key), [data]);
  const sLabel = useCallback((scope: string) => (data ? scopeLabel(data.sheets, data.ids, scope) : scope), [data]);

  const askOtp = useCallback(
    (mode: CredMode, scope: string) => {
      openModal(
        <OtpModal
          mode={mode}
          scope={scope}
          caption={sLabel(scope)}
          onGranted={(g) => {
            closeModal();
            void refetch();
            toast(`${g.mode === 'edit' ? 'Edit' : g.mode === 'preview' ? 'Preview' : 'Visible'} for 10 minutes · ${sLabel(g.scope)}`);
          }}
        />,
        { soft: true, label: 'Confirm it is you' },
      );
    },
    [openModal, closeModal, refetch, toast, sLabel],
  );
  const lock = useCallback(
    async (scope: string) => {
      setEdit((e) => (e && !scope.startsWith('cell:') ? null : e));
      await api('/lock', 'POST', { scope });
      await refetch();
    },
    [api, refetch],
  );
  const valueOf = useCallback(
    (key: string): { v: string; cell?: WireCell } => {
      if (!data) return { v: '' };
      const [sh, row, col] = key.split('|');
      const S = data.sheets[sh as CredSheet];
      if (!S) return { v: '' };
      if (row === 'h') return { v: S.cols.find((c) => c.key === col)?.n ?? '' };
      const cell = S.rows.find((r) => r.key === row)?.cells[col ?? ''];
      return { v: cell?.v ?? '', cell };
    },
    [data],
  );
  const save = useCallback(
    async (key: string, value: string) => {
      const { v: prev, cell } = valueOf(key);
      const r = await api('/cells', 'PATCH', { key, value });
      if (!r.ok) {
        failToast(r.error);
        return;
      }
      toast('Saved');
      setUndo({ label: 'Undo change', run: async () => {
        const u = await api('/cells', 'PATCH', { key, value: prev === 'Pending COI' ? '' : prev, restore: { edited: Boolean(cell?.edited) } });
        if (!u.ok) failToast(u.error);
      } });
    },
    [api, valueOf, failToast, toast],
  );
  const startEdit = useCallback((key: string, v: string) => setEdit({ key, v }), []);
  const commitEdit = useCallback(
    (v: string) => {
      const e = edit;
      setEdit(null);
      if (!e) return;
      const t = v.trim();
      if (t === '' || t === valueOf(e.key).v) return;
      void save(e.key, t);
    },
    [edit, valueOf, save],
  );
  const cancelEdit = useCallback(() => setEdit(null), []);
  useEffect(() => {
    if (!edit) return;
    const [sh, row] = edit.key.split("|");
    if (!canEdit(grants, staff, sh as CredSheet, row ?? "")) setEdit(null);
  }, [edit, grants, staff]);

  /* Undo of the last change / added row (the toast has no button; a small Undo appears in the header for 12 s) */
  const [undo, setUndo] = useState<{ label: string; run: () => Promise<void> } | null>(null);
  useEffect(() => {
    if (!undo) return;
    const t = window.setTimeout(() => setUndo(null), 12_000);
    return () => window.clearTimeout(t);
  }, [undo]);

  const addRow = async (sheet: CredSheet) => {
    const r = await api('/rows', 'POST', { sheet });
    if (!r.ok || !r.rowKey) {
      failToast(r.error);
      return;
    }
    const rowKey = r.rowKey;
    setTab(sheet);
    setEdit({ key: sheet === 'kyc' ? `kyc|h|${rowKey}` : `${sheet}|${rowKey}|${LABEL_COL}`, v: '' });
    toast(sheet === 'kyc' ? 'Director column added · type the name' : 'Row added · type its name');
    setUndo({ label: sheet === 'kyc' ? 'Undo add director' : 'Undo add row', run: async () => {
      setEdit((e) => (e && e.key.includes(rowKey) ? null : e));
      const u = await api('/rows', 'DELETE', { sheet, rowKey });
      if (!u.ok) failToast(u.error);
    } });
  };
  const needEdit = (scope: string, then: () => void) => {
    if (staff || until(grants, 'page', ['edit']) || until(grants, scope, ['edit'])) then();
    else askOtp('edit', scope);
  };

  const copy = useCallback(
    (v: string) => {
      const ok = () => toast('Copied');
      const no = () => toast('Select the text to copy it');
      try {
        navigator.clipboard.writeText(v).then(ok, no);
      } catch {
        no();
      }
    },
    [toast],
  );
  const openCert = useCallback(
    (name: string, path: string) => {
      const w = window.open('', '_blank');
      fetch(`/api/milestone-documents/signed-url?path=${encodeURIComponent(path)}`)
        .then(async (res) => {
          const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!res.ok || !body.url) throw new Error(body.error ?? `Could not open ${name}`);
          if (w) w.location.href = body.url;
          else window.open(body.url, '_blank', 'noopener');
        })
        .catch((e: unknown) => {
          w?.close();
          toast(e instanceof Error ? e.message : `Could not open ${name}`);
        });
    },
    [toast],
  );

  const toggleKey = (k: string) =>
    setOpenKeys((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  const showKey = useCallback((k: string) => {
    setOpenKeys((s) => new Set(s).add(k));
    window.setTimeout(() => {
      const el = document.getElementById(`key-${k}`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHl(k);
      window.setTimeout(() => setHl((h) => (h === k ? null : h)), 1800);
    }, 60);
  }, []);

  /* search palette: every portal key */
  const palette = useMemo<PaletteItem[]>(
    () =>
      keys.map((k) => ({
        id: `portal:${k.key}`,
        label: k.name,
        kind: `Portal${k.portal ? ` · ${k.portal.host}` : ''}`,
        sw: lawVar(k.law),
        go: () => {
          go('credentials');
          window.setTimeout(() => showKey(k.key), 600);
        },
      })),
    [keys, go, showKey],
  );
  usePaletteItems('credentials', palette);

  const ctx = useMemo<Ctx | null>(
    () => (data ? { data, grants, staff, now, edit, startEdit, commitEdit, cancelEdit, save, askOtp, lock, copy, openCert, label } : null),
    [data, grants, staff, now, edit, startEdit, commitEdit, cancelEdit, save, askOtp, lock, copy, openCert, label],
  );

  if (q.isPending) {
    return (
      <>
        <SecHead title="Credentials" />
        <SecLoading />
      </>
    );
  }
  if (q.isError || !data || !ctx) {
    return (
      <>
        <SecHead title="Credentials" />
        <SecError message="Your credentials could not load." onRetry={() => void q.refetch()} />
      </>
    );
  }

  const S = data.sheets[tab];
  const active = keys.filter((k) => k.status === 'active').length;
  const countOf = (id: CredSheet) => (id === 'kyc' ? Math.max(0, data.sheets.kyc.cols.length - 1) : data.sheets[id].rows.filter((r) => !r.spacer).length);
  const mgr = data.manager?.name ?? 'your Project Manager';

  return (
    <CredCtx.Provider value={ctx}>
      <SecHead title="Credentials" count={keys.length ? `${active} of ${keys.length} active` : undefined}>
        {undo ? (
          <Btn ico="back" onClick={() => void undo.run().then(() => setUndo(null))}>
            {undo.label}
          </Btn>
        ) : null}
        <Btn ico="hist" onClick={() => openModal(<AccessLog />, { label: 'Access log' })}>
          Access log
        </Btn>
        {!staff ? <ScopeButtons scope="page" what="everything" /> : null}
      </SecHead>

      {attn.length ? (
        <div className="attn-line" id="attn">
          {attn.map((a) => (
            <button key={a.key} type="button" className={a.tone} onClick={() => showKey(a.key)}>
              <Icon name={a.tone === 'r' ? 'alert' : 'clock'} />
              {a.text}
            </button>
          ))}
        </div>
      ) : null}

      {keys.length ? (
        <div className="keys" id="portals">
          {keys.map((k) => (
            <KeyTile key={k.key} k={k} open={openKeys.has(k.key)} hl={hl === k.key} onToggle={() => toggleKey(k.key)} />
          ))}
        </div>
      ) : (
        <p className="small" style={{ padding: '4px 0 8px' }}>
          No portal logins recorded yet. SBC adds each login as a registration completes; the sheets below hold the full record.
        </p>
      )}

      <div className="sheet-tabs cr-tabs">
        <Seg<CredSheet> options={TABS.map(([id, name]) => ({ value: id, label: name, n: countOf(id) }))} value={tab} onChange={(v) => setTab(v)} ariaLabel="Sheet" />
        <span className="sp" />
        <div className="cr-tools">
          {tab === 'login' || tab === 'other' ? (
            <Btn cls="sm" ico="up" onClick={() => needEdit(`tab:${tab}`, () => void addRow(tab))} title={staff ? undefined : `Needs an Edit code from ${mgr}`}>
              Add row
            </Btn>
          ) : null}
          {tab === 'kyc' ? (
            <Btn cls="sm" ico="team" onClick={() => needEdit('tab:kyc', () => void addRow('kyc'))}>
              Add director
            </Btn>
          ) : null}
          {!staff ? <ScopeButtons scope={`tab:${tab}`} what="this sheet" small /> : null}
        </div>
      </div>
      <section className="glass sht cr-sheet" id="csheet" aria-label={`${tabLabel(tab)} sheet`}>
        {tab === 'reg' ? <IdsTable ids={data.ids} /> : null}
        <SheetTable S={S} />
      </section>
    </CredCtx.Provider>
  );
}

/* ================================================================ Preview / Edit / Lock for a scope (page or sheet) */

function ScopeButtons({ scope, what, small }: { scope: string; what: string; small?: boolean }) {
  const { grants, now, askOtp, lock } = useCred();
  const m = modeOf(grants, scope);
  const cls = small ? 'sm' : '';
  return (
    <>
      {m ? (
        <span className={'cr-vis' + (m === 'Edit' ? ' ed' : '')}>
          {m} · {fmtLeft(until(grants, scope) - now)}
        </span>
      ) : null}
      {!m ? (
        <Btn cls={cls} ico="eye" onClick={() => askOtp('preview', scope)} title={`Show the masked values of ${what} for 10 minutes`}>
          Preview
        </Btn>
      ) : null}
      {m !== 'Edit' ? (
        <Btn cls={cls} ico="notes" onClick={() => askOtp('edit', scope)} title={`Change ${what} for 10 minutes`}>
          Edit
        </Btn>
      ) : null}
      {m ? (
        <Btn cls={cls} ico="lock" onClick={() => void lock(scope)}>
          Lock
        </Btn>
      ) : null}
    </>
  );
}

/* ================================================================ portal key tile */

function KeyTile({ k, open, hl, onToggle }: { k: PortalKey; open: boolean; hl: boolean; onToggle: () => void }) {
  const { data, grants, staff, now, askOtp, lock } = useCred();
  const S = data.sheets.login;
  const scope = `row:login|${k.key}`;
  const m = modeOf(grants, scope);
  const editOn = staff || canEdit(grants, false, 'login', k.key);
  const col = (key: string): WireCol | undefined => S.cols.find((c) => c.key === key);
  const rows: Array<[string, string]> = [
    ['LOGIN', 'id'],
    ['PASSWORD', 'password'],
    ['MAIL', 'mail'],
    ['MOBILE', 'mobile'],
  ];
  return (
    <section className={'glass key' + (open ? ' open' : '') + (hl ? ' hl' : '')} id={`key-${k.key}`}>
      <div
        className="key-h"
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <span className="mono-ic" style={{ background: lawVar(k.law) }}>
          {k.mono}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{k.name}</b>
          <span className={'st ' + k.status}>
            <i />
            {KSTAT[k.status][1]}
          </span>
        </div>
        <span className={'goa' + (open ? ' open' : '')} aria-hidden="true">
          <Icon name="ne" />
          <span>{k.portal?.host ?? 'Details'}</span>
        </span>
      </div>
      <div className="key-x">
        <div>
          <div className="key-body">
            {rows.map(([lbl, c]) =>
              col(c) ? (
                <div className="krow" key={c}>
                  {/* prototype markup: `.krow label` is a caption styled by the prototype CSS, not a form label */}
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label>{lbl}</label>
                  <CellValue S={S} row={k.row} col={col(c)!} krow />
                </div>
              ) : null,
            )}
            {col('status') ? (
              <div className="krow">
                {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                <label>STATUS</label>
                <CellValue S={S} row={k.row} col={col('status')!} krow />
              </div>
            ) : null}
            <div className="acts-row" style={{ marginTop: 4, flexWrap: 'wrap' }}>
              {!staff ? (
                <>
                  {m ? (
                    <span className={'cr-vis' + (m === 'Edit' ? ' ed' : '')}>
                      {m} · {fmtLeft(until(grants, scope) - now)}
                    </span>
                  ) : (
                    <Btn cls="sm" ico="eye" onClick={() => askOtp('preview', scope)}>
                      Show all
                    </Btn>
                  )}
                  {!editOn ? (
                    <Btn cls="sm" ico="notes" onClick={() => askOtp('edit', scope)}>
                      Edit
                    </Btn>
                  ) : null}
                  {m ? (
                    <Btn cls="sm" ico="lock" onClick={() => void lock(scope)}>
                      Lock
                    </Btn>
                  ) : null}
                </>
              ) : (
                <span className="klast">Staff view · values are clear</span>
              )}
              <span className="sp" />
              {k.portal ? <GoArrow label="Launch" href={k.portal.url} ghost /> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================ identifiers (head of the Registrations sheet) */

function IdsTable({ ids }: { ids: WireIdTile[] }) {
  const { grants, staff, now, askOtp, lock, copy } = useCred();
  return (
    <table className="cr-ids">
      <thead>
        <tr>
          <th>IDENTIFIER</th>
          <th>NUMBER</th>
          <th>AUTHORITY</th>
          <th>STATUS</th>
        </tr>
      </thead>
      <tbody>
        {ids.map((t) => {
          const key = `ids|${t.key}|value`;
          const scope = `cell:${key}`;
          const none = !t.value && !t.masked;
          const shown = t.secret ? previewed(grants, staff, key) && t.value : t.value;
          const cellOnly = until(grants, scope) > 0;
          return (
            <tr key={t.key}>
              <td>{t.name}</td>
              <td>
                {none ? (
                  <span className="pill up">{t.key === 'gstin' ? 'Not registered yet' : 'Pending'}</span>
                ) : (
                  <span className="cr-cell">
                    <span className="mono">{shown ? t.value : t.masked ?? MASK}</span>
                    {shown ? (
                      <>
                        <button type="button" className="cr-ib" aria-label={`Copy ${t.name}`} title="Copy" onClick={() => copy(t.value!)}>
                          <Icon name="copy" />
                        </button>
                        {cellOnly ? (
                          <>
                            <span className="cr-vis">Visible · {fmtLeft(until(grants, scope) - now)}</span>
                            <button type="button" className="cr-ib" aria-label={`Hide ${t.name}`} title="Hide" onClick={() => void lock(scope)}>
                              <Icon name="lock" />
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <button type="button" className="cr-ib" aria-label={`Show ${t.name}`} title="Show" onClick={() => askOtp('reveal', scope)}>
                        <Icon name="eye" />
                      </button>
                    )}
                  </span>
                )}
              </td>
              <td>{AUTH[t.auth]}</td>
              <td>{none ? <span className="pill due">Pending</span> : <span className="pill ok">Active</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================================================ a sheet */

function SheetTable({ S }: { S: WireSheet }) {
  const { data, grants, staff, now, askOtp, lock, edit, startEdit, label } = useCred();
  const kyc = S.id === 'kyc';
  const labIdx = S.cols.findIndex((c) => c.key === LABEL_COL);
  const isSecret = (rowKey: string, colKey: string) => (kyc ? Boolean(KYC_ROWS.find((p) => p.key === rowKey)?.s) : Boolean(S.cols.find((c) => c.key === colKey)?.s));
  const rowHasSecret = (r: WireRow) => S.cols.some((c) => isSecret(r.key, c.key) && r.cells[c.key]?.has);
  const noDirectors = kyc && S.cols.length <= 1;
  const rows = S.rows.filter((r) => !r.spacer);
  if (!rows.length || noDirectors) {
    return (
      <p className="small" style={{ padding: '18px 16px' }}>
        {noDirectors
          ? 'Directors appear here after the Proposed Directors step, or use Add director.'
          : S.id === 'other'
            ? `Nothing here yet. Add a row for any other login ${data.companyName.split(' ')[0]}’s team uses.`
            : 'Nothing here yet.'}
      </p>
    );
  }
  return (
    <table className={kyc ? 'cr-kyc' : undefined}>
      <thead>
        <tr>
          <th className="cr-g" scope="col">
            <span className="cr-srh">Row</span>
          </th>
          {S.cols.map((c) => {
            if (c.k === 'sno') return null;
            if (c.hdr) {
              const key = `kyc|h|${c.key}`;
              const can = canEdit(grants, staff, 'kyc', 'h');
              if (edit?.key === key) return <th key={c.key} scope="col"><Editor /></th>;
              return (
                <th key={c.key} scope="col" className={can ? 'cr-can' : undefined} tabIndex={can ? 0 : undefined} onClick={() => can && startEdit(key, c.n)} onKeyDown={(e) => can && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), startEdit(key, c.n))} title={can ? 'Click to rename' : undefined}>
                  {c.n || 'New director'}
                </th>
              );
            }
            return (
              <th key={c.key} scope="col">
                {c.n}
                {c.s ? <Icon name="lock" className="cr-lk" /> : null}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => {
          const scope = `row:${S.id}|${r.key}`;
          const m = modeOf(grants, scope);
          const name = kyc ? label(`kyc|${r.key}|${LABEL_COL}`).split(' · ').pop() : r.cells[LABEL_COL]?.v || `Row ${ri + 1}`;
          const kp = kyc ? KYC_ROWS.find((p) => p.key === r.key) : undefined;
          return (
            <tr key={r.key} className={m ? 'cr-rowon' : undefined}>
              <th scope="row" className="cr-g">
                <span className="cr-gw">
                  {m ? <span className="cr-rn on">{fmtLeft(until(grants, scope) - now)}</span> : <span className="cr-rn">{ri + 1}</span>}
                  {!staff && rowHasSecret(r) ? (
                    <button type="button" className={'cr-rb' + (m ? ' on' : '')} aria-label={`${m ? 'Lock' : 'Preview'} row ${ri + 1} · ${name}`} title={m ? 'Lock row' : 'Preview row'} onClick={() => (m ? void lock(scope) : askOtp('preview', scope))}>
                      <Icon name={m ? 'lock' : 'eye'} />
                    </button>
                  ) : null}
                  {!staff ? (
                    <button type="button" className={'cr-rb' + (m === 'Edit' ? ' on' : '')} aria-label={`${m === 'Edit' ? 'Lock' : 'Edit'} row ${ri + 1} · ${name}`} title={m === 'Edit' ? 'Lock row' : 'Edit row'} onClick={() => (m === 'Edit' ? void lock(scope) : askOtp('edit', scope))}>
                      <Icon name="notes" />
                    </button>
                  ) : null}
                </span>
              </th>
              {S.cols.map((c, ci) => {
                if (c.k === 'sno') return null;
                if (kyc && ci === labIdx) {
                  return (
                    <td key={c.key} className={'cr-lab' + (kp?.indent ? ' cr-ind' : '')}>
                      {r.cells[c.key]?.v}
                    </td>
                  );
                }
                return (
                  <td key={c.key} className={(ci === labIdx ? 'cr-lab' : '') + (kp?.tall ? ' cr-tall' : '')}>
                    <CellValue S={S} row={r} col={c} />
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ================================================================ one cell: masked / revealed / editable / status / certificate */

function CellValue({ S, row, col, krow }: { S: WireSheet; row: WireRow; col: WireCol; krow?: boolean }) {
  const { grants, staff, now, edit, startEdit, save, askOtp, lock, copy, openCert, label } = useCred();
  const key = `${S.id}|${row.key}|${col.key}`;
  const cell = row.cells[col.key];
  const v = cell?.v ?? '';
  const kyc = S.id === 'kyc';
  const kp = kyc ? KYC_ROWS.find((p) => p.key === row.key) : undefined;
  const secretCol = kyc ? Boolean(kp?.s) : Boolean(col.s);
  const sec = secretCol && Boolean(cell?.has);
  const can = canEdit(grants, staff, S.id, row.key);
  const tall = Boolean(kp?.tall);
  const src = cell?.src && (cell.v || cell.has) && cell.v !== 'Pending COI' ? (cell.edited ? 'Edited' : `Auto · ${cell.src}`) : null;
  const srcTitle = cell?.src ? (cell.edited ? `Changed by hand. It was filled from the ${cell.src}.` : `Filled from the ${cell.src}. Edit to override.`) : undefined;

  if (edit?.key === key) return <Editor multi={tall} />;

  const editable = (node: ReactNode, cls = '') =>
    can ? (
      <span
        className={'cr-edit ' + cls}
        role="button"
        tabIndex={0}
        title="Click to edit"
        onClick={(e) => {
          if ((e.target as Element).closest('button,select,a')) return;
          startEdit(key, sec && !(previewed(grants, staff, key) && cell?.v != null) ? '' : v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            startEdit(key, v);
          }
        }}
      >
        {node}
      </span>
    ) : (
      <span className={cls}>{node}</span>
    );

  const srcChip = src ? (
    <span className={'cr-src' + (cell?.edited ? ' ed' : '')} title={srcTitle}>
      {src}
    </span>
  ) : null;

  if (col.k === 'status') {
    const st = CRED_STATUS.find((x) => x[0] === v);
    if (can)
      return (
        <select className="cr-stsel" aria-label={`Status · ${label(key)}`} value={v} onChange={(e) => e.target.value !== v && void save(key, e.target.value)}>
          {CRED_STATUS.map((s) => (
            <option key={s[0]}>{s[0]}</option>
          ))}
        </select>
      );
    return st ? <span className={'pill ' + st[1]}>{v}</span> : <span className="cr-dash">—</span>;
  }

  if (sec) {
    const shown = previewed(grants, staff, key) && cell?.v != null;
    const scope = `cell:${key}`;
    const cellOnly = until(grants, scope) > 0 && !scopesCovering(key).filter((s) => !s.startsWith('cell:')).some((s) => until(grants, s) > 0);
    return (
      <span className={'cr-cell' + (krow ? ' k' : '')}>
        {shown
          ? editable(<span className={'mono' + (tall ? ' cr-pre' : '')}>{cell!.v}</span>)
          : editable(<span className="cr-mask">{MASK}</span>)}
        {shown ? (
          <>
            <button type="button" className="cr-ib" aria-label={`Copy ${label(key)}`} title="Copy" onClick={() => copy(cell!.v!)}>
              <Icon name="copy" />
            </button>
            {cellOnly ? (
              <>
                {!krow ? <span className="cr-vis">Visible · {fmtLeft(until(grants, scope) - now)}</span> : null}
                <button type="button" className="cr-ib" aria-label={`Hide ${label(key)}`} title="Hide" onClick={() => void lock(scope)}>
                  <Icon name="lock" />
                </button>
              </>
            ) : null}
          </>
        ) : !staff ? (
          <button type="button" className="cr-ib" aria-label={`Show ${label(key)}`} title="Show" onClick={() => askOtp('reveal', scope)}>
            <Icon name="eye" />
          </button>
        ) : null}
        {srcChip}
      </span>
    );
  }

  if (col.k === 'cert') {
    const proofPending = S.id === 'reg' && !v && Boolean(row.cells.number?.v);
    if (v && cell?.doc)
      return (
        <button type="button" className="cr-link" onClick={() => openCert(v, cell.doc!)}>
          <Icon name="doc" />
          {v}
        </button>
      );
    if (v)
      return editable(
        <span className="cr-td-x">
          <Icon name="doc" />
          {v}
        </span>,
      );
    return editable(proofPending ? <span className="pill due">Proof pending</span> : <span className="cr-dash">—</span>);
  }

  const shown = S.id === 'reg' && col.key === 'number' && !v ? 'Not registered yet' : v;
  const node = !shown ? (
    <span className="cr-dash">—</span>
  ) : shown === 'Not registered yet' || shown === 'Pending COI' ? (
    <span className="pill up">{shown}</span>
  ) : (
    <span className={tall ? 'cr-pre' : undefined}>{shown}</span>
  );
  return (
    <span className={'cr-cell' + (krow ? ' k' : '')}>
      {editable(node)}
      {krow && v && col.key !== LABEL_COL ? (
        <button type="button" className="cr-ib" aria-label={`Copy ${label(key)}`} title="Copy" onClick={() => copy(v)}>
          <Icon name="copy" />
        </button>
      ) : null}
      {srcChip}
    </span>
  );
}

/** The inline editor for the cell being edited (Enter saves, Esc cancels, blur saves). */
function Editor({ multi }: { multi?: boolean }) {
  const { edit, commitEdit, cancelEdit, label } = useCred();
  const [v, setV] = useState(edit?.v ?? '');
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select?.();
  }, []);
  if (!edit) return null;
  const common = {
    'aria-label': `Edit ${label(edit.key)}`,
    value: v,
    className: 'cr-ed-in' + (multi ? ' cr-ed-ta' : ''),
    onChange: (e: { target: { value: string } }) => setV(e.target.value),
    onBlur: () => commitEdit(v),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(multi && e.shiftKey)) {
        e.preventDefault();
        commitEdit(v);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
      }
    },
  };
  return multi ? <textarea {...common} ref={ref} rows={3} /> : <input {...common} ref={ref} type="text" />;
}

/* ================================================================ access log */

function AccessLog() {
  const { go } = usePortal();
  const q = useQuery({
    queryKey: [PK, 'credentials-log'],
    queryFn: async () => (await getJson<{ entries: CredentialsLogEntry[] }>('/api/client/credentials/log'))?.entries ?? [],
    refetchOnMount: 'always',
  });
  const rows = q.data ?? [];
  return (
    <ModalBox
      title="Access log"
      sub="Every preview, edit and reveal of your credentials, newest first. The same events are on the Audit page."
      foot={
        <>
          <button type="button" className="btn" data-close>
            Close
          </button>
          <button type="button" className="btn pri" data-close onClick={() => go('audit')}>
            <Icon name="hist" />
            Open in Audit
          </button>
        </>
      }
    >
      <ol className="cr-log">
        {q.isPending ? (
          <li className="small">Loading…</li>
        ) : q.isError ? (
          <li className="small">The access log could not load.</li>
        ) : rows.length === 0 ? (
          <li className="small">No previews, edits or reveals yet.</li>
        ) : (
          rows.map((e) => (
            <li key={e.id}>
              <time className="mono" dateTime={e.at}>
                {fmtY(todayIso(new Date(e.at).getTime()))} · {new Date(e.at).toTimeString().slice(0, 5)}
              </time>
              <span>{e.text}</span>
            </li>
          ))
        )}
      </ol>
    </ModalBox>
  );
}
