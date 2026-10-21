'use client';

/**
 * Credentials page — board `s/home/v7p_credentials.dc.html` (route
 * `credentials`). Six tinted identifier tiles + a five-sheet workbook
 * (Address · Login Credentials · Registrations · Directors KYC · Other
 * credentials). Secret values stay masked; every Preview / Edit / Reveal asks
 * for a 6-digit OTP that goes to the client's Project Manager and opens a
 * 10-minute grant (server-enforced, `src/db/repositories/credentials.ts`).
 * Every access lands in the Access log drawer and on the Audit page.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePortalOptional } from '@/components/client-portal/PortalProvider';
import { DocViewer, type ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import {
  CRED_SRC_TIP,
  CRED_STATUS,
  CRED_TABS,
  KYC_ROWS,
  LABEL_COL,
  cellLabel,
  colLetter,
  scopeLabel,
  scopesCovering,
  tabLabel,
  type CredMode,
  type CredSheet,
  type CredentialsLogEntry,
  type CredentialsPayload,
  type WireCell,
  type WireGrant,
  type WireSheet,
} from '@/lib/client-portal/credentials';
import { Ic } from './Ic';
import { OtpDialog } from './OtpDialog';
import '../../css/credentials-page.css';

const QK = ['client-portal', 'credentials'] as const;
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;
function fmtS(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}
function fmtDate(t: string) {
  const d = new Date(t);
  return `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Focus = { act?: string; key?: string; alt?: string; td?: string; id?: string } | null;

interface OtpReq {
  mode: CredMode;
  scope: string;
  ret: Focus;
  then?: () => void;
  n: number;
}

/** Fallback for staff who open /app/client/* outside the client portal shell. */
export function CredentialsPage() {
  const portal = usePortalOptional();
  if (!portal) {
    return (
      <div style={{ padding: 24, font: '600 14px Manrope, system-ui, sans-serif' }}>
        Credentials are shown inside the client portal. Open the engagement&apos;s workspace to manage them.
      </div>
    );
  }
  return <CredentialsInner />;
}

function CredentialsInner() {
  const { after, setAfter, toast, go, shell } = usePortalOptional()!;
  const qc = useQueryClient();
  const engQ = '';
  const q = useQuery({
    queryKey: QK,
    queryFn: async (): Promise<CredentialsPayload> => {
      const res = await fetch(`/api/client/credentials${engQ}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { credentials: CredentialsPayload }).credentials;
    },
    staleTime: 15_000,
  });
  const data = q.data;
  const setData = useCallback((p: CredentialsPayload) => qc.setQueryData(QK, p), [qc]);
  const refetch = useCallback(() => qc.invalidateQueries({ queryKey: QK }), [qc]);

  const [tab, setTab] = useState<CredSheet>('address');
  const [edit, setEdit] = useState<string | null>(null);
  const [editV, setEditV] = useState('');
  const [otp, setOtp] = useState<OtpReq | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [viewer, setViewer] = useState<ViewerDoc | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [host, setHost] = useState<Element | null>(null);
  const pendingFocus = useRef<Focus>(null);
  const pendingScroll = useRef<'right' | 'bottom' | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const saving = useRef(false);

  useEffect(() => setHost(document.querySelector('.cp') ?? document.body), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /* ---------- grants ---------- */
  const grants: WireGrant[] = useMemo(() => (data?.grants ?? []).filter((g) => new Date(g.expiresAt).getTime() > now), [data?.grants, now]);
  const staff = Boolean(data?.staff);
  const until = useCallback(
    (scope: string, modes?: CredMode[]) =>
      grants.filter((g) => g.scope === scope && (!modes || modes.includes(g.mode))).reduce((m, g) => Math.max(m, new Date(g.expiresAt).getTime()), 0),
    [grants],
  );
  const modeOf = useCallback((scope: string): '' | 'Edit' | 'Preview' => (until(scope, ['edit']) ? 'Edit' : until(scope) ? 'Preview' : ''), [until]);
  const previewed = useCallback((key: string) => staff || scopesCovering(key).some((s) => until(s) > 0), [staff, until]);
  const hasEdit = useCallback((scope: string) => staff || until(scope, ['edit']) > 0, [staff, until]);

  /* a grant ran out: re-mask from the server and close an open edit */
  const expiredSeen = useRef(0);
  useEffect(() => {
    const exp = (data?.grants ?? []).filter((g) => new Date(g.expiresAt).getTime() <= now).length;
    if (exp > expiredSeen.current) {
      expiredSeen.current = exp;
      void refetch();
    } else if (exp < expiredSeen.current) expiredSeen.current = exp;
  }, [now, data?.grants, refetch]);

  const sheets = data?.sheets;
  const T = sheets?.[tab];
  const labOf = (S: WireSheet) => S.cols.findIndex((c) => c.key === LABEL_COL);
  const hasSno = (S: WireSheet) => S.cols.some((c) => c.k === 'sno');

  const label = useCallback((key: string) => (data ? cellLabel(data.sheets, data.ids, key) : key), [data]);
  const sLabel = useCallback((scope: string) => (data ? scopeLabel(data.sheets, data.ids, scope) : scope), [data]);

  const isSecretCell = (S: WireSheet, rowKey: string, colKey: string) =>
    S.id === 'kyc' ? Boolean(KYC_ROWS.find((p) => p.key === rowKey)?.s) : Boolean(S.cols.find((c) => c.key === colKey)?.s);

  const editable = useCallback(
    (key: string) => {
      if (!sheets) return false;
      const [sh, row, col] = key.split('|');
      if (sh === 'ids') return false;
      const S = sheets[sh as CredSheet];
      if (!S) return false;
      if (row !== 'h') {
        const r = S.rows.find((x) => x.key === row);
        if (!r || r.spacer) return false;
        const c = S.cols.find((x) => x.key === col);
        if (c?.k === 'sno' || (S.id === 'kyc' && col === LABEL_COL)) return false;
      }
      return ['page', `tab:${sh}`, ...(row !== 'h' ? [`row:${sh}|${row}`] : [])].some(hasEdit);
    },
    [sheets, hasEdit],
  );

  /* an edit whose grant ended closes */
  useEffect(() => {
    if (edit && !editable(edit)) setEdit(null);
  }, [edit, editable]);

  /* ---------- focus + sticky header rows (fixGrid) ---------- */
  const fixGrid = useCallback(() => {
    const nb = gridRef.current;
    if (!nb) return;
    nb.style.setProperty('--vis-w', `${Math.max(160, nb.clientWidth - 84)}px`);
    let y = 0;
    nb.querySelectorAll('thead tr').forEach((tr) => {
      tr.querySelectorAll<HTMLElement>('th').forEach((th) => {
        th.style.top = `${y}px`;
      });
      y += tr.getBoundingClientRect().height;
    });
  }, []);
  useLayoutEffect(() => {
    fixGrid();
    const nb = gridRef.current;
    if (nb && pendingScroll.current) {
      if (pendingScroll.current === 'right') nb.scrollLeft = nb.scrollWidth;
      if (pendingScroll.current === 'bottom') nb.scrollTop = nb.scrollHeight;
      pendingScroll.current = null;
    }
    if (edit) {
      const inp = editRef.current;
      if (inp && document.activeElement !== inp) {
        inp.focus();
        inp.select?.();
      }
      return;
    }
    const spec = pendingFocus.current;
    if (spec && rootRef.current) {
      const root = rootRef.current;
      const sel = (a?: string) => (a ? `[data-act="${a}"]${spec.key != null ? `[data-key="${CSS.escape(spec.key)}"]` : ''}` : '');
      let el: HTMLElement | null = null;
      if (spec.id) el = document.getElementById(spec.id);
      else if (spec.td) el = root.querySelector(`[data-edit="${CSS.escape(spec.td)}"]`);
      else if (spec.act) el = root.querySelector(sel(spec.act));
      if (!el && spec.alt) el = root.querySelector(sel(spec.alt));
      if (el) {
        el.focus();
        pendingFocus.current = null;
      }
    }
  });
  useEffect(() => {
    window.addEventListener('resize', fixGrid);
    return () => window.removeEventListener('resize', fixGrid);
  }, [fixGrid]);
  const refocus = (spec: Focus) => {
    pendingFocus.current = spec;
  };

  /* ---------- API ---------- */
  const api = useCallback(
    async (path: string, method: string, body?: unknown): Promise<{ ok: boolean; credentials?: CredentialsPayload; rowKey?: string; error?: string }> => {
      try {
        const res = await fetch(`/api/client/credentials${path}${engQ}`, {
          method,
          headers: { 'content-type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        });
        const out = (await res.json().catch(() => ({}))) as { ok?: boolean; credentials?: CredentialsPayload; rowKey?: string; error?: string };
        if (out.credentials) setData(out.credentials);
        if (!res.ok) return { ok: false, error: out.error ?? String(res.status) };
        return { ok: true, credentials: out.credentials, rowKey: out.rowKey };
      } catch {
        return { ok: false, error: 'network' };
      }
    },
    [setData],
  );

  const failToast = (error?: string) =>
    toast(error === 'edit_grant_required' ? 'Read-only. Choose Edit and enter the OTP to change values.' : 'Could not save. Try again.');

  /* ---------- OTP ---------- */
  const openOtp = (mode: CredMode, scope: string, ret: Focus, then?: () => void) => setOtp((o) => ({ mode, scope, ret, then, n: (o?.n ?? 0) + 1 }));
  const closeOtp = () => {
    if (otp) refocus(otp.ret);
    setOtp(null);
  };
  const granted = async (g: WireGrant) => {
    const o = otp;
    setOtp(null);
    await refetch();
    const sc = g.scope;
    if (sc.startsWith('cell:')) refocus({ act: 'hide', key: sc.slice(5), alt: 'copy' });
    else if (sc.startsWith('row:')) refocus({ act: g.mode === 'edit' ? 'row-edit' : 'row-preview', key: sc.slice(4) });
    else refocus({ act: 'lock', key: sc });
    toast(`${g.mode === 'edit' ? 'Edit' : g.mode === 'preview' ? 'Preview' : 'Visible'} for 10 minutes`);
    o?.then?.();
  };
  const endScope = async (scope: string, spec: Focus) => {
    if (edit && !scope.startsWith('cell:')) setEdit(null);
    await api('/lock', 'POST', { scope });
    await refetch();
    refocus(spec);
  };
  const needEdit = (scope: string, then: () => void) => {
    if (hasEdit('page') || hasEdit(scope)) {
      then();
      return;
    }
    openOtp('edit', scope, { act: 'editmode', key: scope }, then);
  };

  /* ---------- edit / add / copy ---------- */
  const valueOf = (key: string): { v: string; cell?: WireCell } => {
    if (!sheets) return { v: '' };
    const [sh, row, col] = key.split('|');
    const S = sheets[sh as CredSheet];
    if (!S) return { v: '' };
    if (row === 'h') return { v: S.cols.find((c) => c.key === col)?.n ?? '' };
    const cell = S.rows.find((r) => r.key === row)?.cells[col ?? ''];
    return { v: cell?.v ?? '', cell };
  };

  const saveChange = async (key: string, val: string) => {
    const { v: prev, cell } = valueOf(key);
    const wasEdited = Boolean(cell?.edited);
    saving.current = true;
    const r = await api('/cells', 'PATCH', { key, value: val });
    saving.current = false;
    if (!r.ok) {
      failToast(r.error);
      return;
    }
    refocus({ td: key });
    toast('Saved', {
      undo: async () => {
        const u = await api('/cells', 'PATCH', { key, value: prev === 'Pending COI' ? '' : prev, restore: { edited: wasEdited } });
        if (!u.ok) failToast(u.error);
        refocus({ td: key });
      },
    });
  };
  const startEdit = (key: string) => {
    if (!editable(key)) {
      toast('Read-only. Choose Edit and enter the OTP to change values.');
      return;
    }
    if (edit && edit !== key) commitEdit(editRef.current?.value ?? null);
    setEdit(key);
    setEditV(valueOf(key).v);
  };
  const commitEdit = (val: string | null) => {
    const key = edit;
    if (!key) return;
    setEdit(null);
    const v = String(val ?? '').trim();
    if (v === '' || v === valueOf(key).v) {
      refocus({ td: key });
      return;
    }
    void saveChange(key, v);
  };
  const cancelEdit = () => {
    const key = edit;
    setEdit(null);
    if (key) refocus({ td: key });
  };
  const addRow = async (sheet: CredSheet) => {
    const r = await api('/rows', 'POST', { sheet });
    if (!r.ok || !r.rowKey) {
      failToast(r.error);
      return;
    }
    const rowKey = r.rowKey;
    const isKyc = sheet === 'kyc';
    setTab(sheet);
    pendingScroll.current = isKyc ? 'right' : 'bottom';
    const key = isKyc ? `kyc|h|${rowKey}` : `${sheet}|${rowKey}|${LABEL_COL}`;
    setEdit(key);
    setEditV('');
    toast(isKyc ? 'Director column added' : 'Row added', {
      undo: async () => {
        setEdit((e) => (e && e.includes(rowKey) ? null : e));
        const u = await api('/rows', 'DELETE', { sheet, rowKey });
        if (!u.ok) failToast(u.error);
      },
    });
  };
  const copyText = (v: string) => {
    const ok = () => toast('Copied');
    const fb = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = v;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        const okc = document.execCommand('copy');
        document.body.removeChild(ta);
        if (okc) ok();
        else toast('Copy blocked by this browser');
      } catch {
        toast('Copy blocked by this browser');
      }
    };
    try {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(v).then(ok, fb);
        return;
      }
    } catch {
      /* fall back */
    }
    fb();
  };
  const openCert = (name: string, path: string) =>
    setViewer({
      id: path,
      name,
      url: async () => {
        const res = await fetch(`/api/milestone-documents/signed-url?path=${encodeURIComponent(path)}`);
        const out = (await res.json()) as { url?: string };
        if (!out.url) throw new Error('no url');
        return out.url;
      },
    });

  /* ---------- stage (Before / After COI) ---------- */
  const setStage = (st: 'before' | 'after') => {
    setEdit(null);
    refocus({ act: 'stage', key: st });
    if ((st === 'after') !== after) setAfter(st === 'after');
  };

  /* Esc closes the access log; Enter / Space on a cell edits */
  useEffect(() => {
    if (!logOpen) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !otp) {
        e.preventDefault();
        setLogOpen(false);
        refocus({ act: 'log' });
      }
    };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [logOpen, otp]);

  /* ---------- render helpers ---------- */
  const companyName = data?.companyName ?? shell?.companyName ?? '';
  const mgrName = data?.manager?.name ?? 'your Project Manager';

  const sessChip = (scope: string) => {
    const m = modeOf(scope);
    if (!m) return null;
    return (
      <span className={`cr-vis${m === 'Edit' ? ' ed' : ''}`}>
        {m} · {fmtS(until(scope) - now)}
      </span>
    );
  };
  const modeBtns = (scope: string, sm: string, ids: boolean) => {
    const m = modeOf(scope);
    return (
      <>
        {m ? sessChip(scope) : null}
        {m !== 'Preview' && m !== 'Edit' ? (
          <button type="button" className={`cr-btn${sm}`} data-act="preview" data-key={scope} onClick={() => openOtp('preview', scope, { act: 'preview', key: scope })}>
            <Ic n="eye" s={14} />
            {ids ? 'Preview' : 'Preview sheet'}
          </button>
        ) : null}
        {m !== 'Edit' ? (
          <button type="button" className={`cr-btn cr-btn-p${sm}`} data-act="editmode" data-key={scope} onClick={() => openOtp('edit', scope, { act: 'editmode', key: scope })}>
            <Ic n="pencil" s={14} />
            {ids ? 'Edit' : 'Edit sheet'}
          </button>
        ) : null}
        {m ? (
          <button type="button" className={`cr-btn${sm}`} data-act="lock" data-key={scope} onClick={() => void endScope(scope, { act: 'preview', key: scope })}>
            <Ic n="lock" s={14} />
            Lock
          </button>
        ) : null}
      </>
    );
  };

  const copyBtn = (key: string, v: string) => (
    <button type="button" className="cr-ib cr-s cr-ibp" data-act="copy" data-key={key} aria-label={`Copy ${label(key)}`} onClick={() => copyText(v)}>
      <Ic n="copy" s={13} />
    </button>
  );
  const hideBtn = (key: string) => (
    <button
      type="button"
      className="cr-ib cr-s"
      data-act="hide"
      data-key={key}
      aria-label={`Hide ${label(key)}`}
      onClick={() => void endScope(`cell:${key}`, { act: 'reveal-cell', key })}
    >
      <Ic n="eye-off" s={13} />
    </button>
  );
  const cellChip = (key: string) => <span className="cr-vis">Visible · {fmtS(until(`cell:${key}`) - now)}</span>;
  const revealBtn = (key: string, icon: 'lock' | 'eye') => (
    <button
      type="button"
      className="cr-ib cr-s"
      data-act="reveal-cell"
      data-key={key}
      aria-label={`Reveal ${label(key)}`}
      onClick={() => openOtp('reveal', `cell:${key}`, { act: 'reveal-cell', key })}
    >
      <Ic n={icon} s={13} />
    </button>
  );

  /* six tiles */
  const PEND = <span className="cr-ctv cr-cpend">Pending COI</span>;
  const tile = (auth: string, title: string, value: ReactNode, act?: ReactNode) => (
    <article className="cr-ctile" data-auth={auth} key={title}>
      <div className="cr-ctt">
        <span className="cr-ctn">{title}</span>
        {act}
      </div>
      {value}
    </article>
  );
  const idTiles = () =>
    (data?.ids ?? []).map((t) => {
      if (!after) return tile(t.auth, t.name, PEND);
      const key = `ids|${t.key}|value`;
      if (!t.value && !t.masked) return tile(t.auth, t.name, t.key === 'gstin' ? <span className="cr-ctv cr-cpend">Not registered yet</span> : PEND);
      if (!t.secret) return tile(t.auth, t.name, <span className="cr-ctv">{t.value}</span>, copyBtn(key, t.value!));
      const rev = previewed(key) && t.value;
      if (!rev) return tile(t.auth, t.name, <span className="cr-ctv">{t.masked}</span>, revealBtn(key, 'eye'));
      return tile(t.auth, t.name, <span className="cr-ctv">{t.value}</span>, (
        <>
          {copyBtn(key, t.value!)}
          {hideBtn(key)}
        </>
      ));
    });
  const regTile = () => {
    if (!after) return tile('oth', 'Registrations', PEND);
    return tile(
      'oth',
      'Registrations',
      data?.registrationsSummary ? <span className="cr-ctv">{data.registrationsSummary}</span> : <span className="cr-ctv cr-cpend">Not registered yet</span>,
      <button type="button" className="cr-ib cr-s" data-act="tab" data-key="reg" aria-label="Open the registrations sheet" onClick={() => selectTab('reg')}>
        <Ic n="arrow-right" s={13} />
      </button>,
    );
  };
  const dscTile = () => {
    if (!after) return tile('oth', 'DSC holders', PEND);
    const n = data?.directors ?? 0;
    return tile(
      'oth',
      'DSC holders',
      <span className="cr-ctv">
        {n} holder{n === 1 ? '' : 's'}
      </span>,
      <button type="button" className="cr-ib cr-s" data-act="tab" data-key="kyc" aria-label="Open the directors KYC sheet" onClick={() => selectTab('kyc')}>
        <Ic n="arrow-right" s={13} />
      </button>,
    );
  };
  const selectTab = (t: CredSheet) => {
    setTab(t);
    refocus({ act: 'tab', key: t });
  };

  /* grid cells */
  const statusChip = (v: string) => {
    const s = CRED_STATUS.find((x) => x[0] === v);
    return s ? <span className={`cr-chip ${s[1]}`}>{v}</span> : <span className="cr-dash">—</span>;
  };
  const plain = (v: string | null | undefined): ReactNode => {
    if (!v) return <span className="cr-dash">—</span>;
    if (v === 'Proof pending') return <span className="cr-chip due">Proof pending</span>;
    if (v === 'Not registered yet' || v === 'Pending COI') return <span className="cr-chip up">{v}</span>;
    return v;
  };
  const srcChip = (cell: WireCell | undefined) => {
    if (!cell?.src || !(cell.v || cell.has) || cell.v === 'Pending COI') return null;
    if (cell.edited)
      return (
        <span className="cr-src ed" title={`Changed by hand. It was filled from the ${cell.src}.`}>
          Edited
        </span>
      );
    return (
      <span className="cr-src" title={CRED_SRC_TIP[cell.src]} aria-label={`Auto from ${cell.src}. ${CRED_SRC_TIP[cell.src]}`}>
        Auto · from {cell.src}
      </span>
    );
  };
  const stickyCls = (S: WireSheet, ci: number) => {
    const c = S.cols[ci]!;
    if (c.k === 'sno') return 'cr-sno';
    if (ci === labOf(S)) return `cr-c0${hasSno(S) ? ' cr-l96' : ''}`;
    return S.id === 'kyc' ? 'cr-eq' : '';
  };
  const rowHasSecret = (S: WireSheet, rowKey: string) => {
    const r = S.rows.find((x) => x.key === rowKey);
    if (!r) return false;
    return S.cols.some((c) => isSecretCell(S, rowKey, c.key) && r.cells[c.key]?.has);
  };

  const editor = (key: string, multi: boolean) => {
    const common = {
      id: 'cr-ed',
      'aria-label': `Edit ${label(key)}`,
      value: editV,
      onChange: (e: { target: { value: string } }) => setEditV(e.target.value),
      onBlur: (e: { target: { value: string } }) => {
        if (edit === key) commitEdit(e.target.value);
      },
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !(multi && e.shiftKey)) {
          e.preventDefault();
          commitEdit((e.target as HTMLInputElement).value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cancelEdit();
        }
      },
    };
    return multi ? (
      <textarea {...common} ref={editRef} className="cr-ed-in cr-ed-ta" rows={3} />
    ) : (
      <input {...common} ref={editRef} className="cr-ed-in" type="text" />
    );
  };

  const onCellActivate = (key: string) => {
    if (edit !== key) startEdit(key);
  };

  const cellTd = (S: WireSheet, ri: number, ci: number) => {
    const row = S.rows[ri]!;
    const col = S.cols[ci]!;
    const key = `${S.id}|${row.key}|${col.key}`;
    const cell = row.cells[col.key];
    const v = cell?.v ?? '';
    const secretCol = isSecretCell(S, row.key, col.key) && ci !== labOf(S);
    const sec = secretCol && Boolean(cell?.has);
    let cls = stickyCls(S, ci);
    const kp = S.id === 'kyc' ? KYC_ROWS.find((p) => p.key === row.key) : undefined;
    if (kp?.indent && ci === labOf(S)) cls += ' cr-ind';
    const tall = Boolean(kp?.tall) && ci !== labOf(S);
    if (tall) cls += ' cr-tall';
    if (col.k === 'sno') {
      let n = 0;
      for (let i = 0; i <= ri; i++) if (!S.rows[i]!.spacer) n++;
      return (
        <td className={cls} key={col.key}>
          {n}
        </td>
      );
    }
    if (S.id === 'kyc' && ci === labOf(S)) {
      return (
        <td className={cls} key={col.key}>
          <span className="cr-lt">{plain(v)}</span>
        </td>
      );
    }
    const can = editable(key);
    if (can) cls += ' cr-can';
    if (edit === key) {
      return (
        <td className={`${cls} cr-editing`} data-edit={key} key={col.key}>
          {editor(key, tall)}
        </td>
      );
    }
    const src = srcChip(cell);
    const srow = src ? <span className="cr-srcrow">{src}</span> : null;
    if (src) cls += ' cr-has-src';
    if (col.k === 'status') {
      return (
        <td className={cls} key={col.key}>
          {can ? (
            <select
              className="cr-stsel"
              aria-label={`Status · ${row.cells[LABEL_COL]?.v ?? ''}`}
              value={v}
              onChange={(e) => {
                if (e.target.value !== v) void saveChange(key, e.target.value);
              }}
            >
              {CRED_STATUS.map((s) => (
                <option key={s[0]}>{s[0]}</option>
              ))}
            </select>
          ) : (
            statusChip(v)
          )}
        </td>
      );
    }
    let inner: ReactNode;
    if (sec) {
      if (previewed(key) && cell?.v != null) {
        const cellOnly = until(`cell:${key}`) > 0 && !scopesCovering(key).filter((s) => !s.startsWith('cell:')).some((s) => until(s) > 0);
        inner = (
          <>
            <span className="cr-cellpad">
              <span className={`cr-mono${tall ? ' cr-pre' : ''}`}>{cell.v}</span>
              {cellOnly ? (
                <>
                  {cellChip(key)}
                  {copyBtn(key, cell.v)}
                  {hideBtn(key)}
                </>
              ) : (
                copyBtn(key, cell.v)
              )}
            </span>
            {srow}
          </>
        );
      } else {
        inner = (
          <>
            <span className="cr-cellpad">
              <span className="cr-mask">••••••</span>
              {revealBtn(key, 'lock')}
              <button
                type="button"
                className="cr-ib cr-s"
                data-act="info"
                data-key={key}
                aria-label="About this field"
                onClick={() => toast(`${label(key)}: masked. Preview or Reveal needs an OTP from ${mgrName}.`)}
              >
                <Ic n="info" s={13} />
              </button>
            </span>
            {srow}
          </>
        );
      }
    } else if (col.k === 'cert') {
      const proofPending = S.id === 'reg' && !v && Boolean(row.cells.number?.v);
      inner =
        v && cell?.doc ? (
          <button type="button" className="cr-link" data-act="cert" onClick={() => openCert(v, cell.doc!)}>
            <Ic n="paperclip" s={12} />
            {v}
          </button>
        ) : v ? (
          <span className="cr-td-x">
            <Ic n="paperclip" s={12} />
            {v}
          </span>
        ) : (
          plain(proofPending ? 'Proof pending' : '')
        );
    } else {
      const shown = S.id === 'reg' && col.key === 'number' && !v ? 'Not registered yet' : v;
      inner = src ? (
        <>
          <span className={tall ? 'cr-pre' : undefined}>{plain(shown)}</span>
          {srow}
        </>
      ) : (
        plain(shown)
      );
    }
    if (ci === labOf(S) && !sec) inner = <span className="cr-lt">{inner}</span>;
    return (
      <td
        className={cls}
        data-edit={key}
        tabIndex={0}
        key={col.key}
        onClick={(e) => {
          if ((e.target as Element).closest('button,select,a')) return;
          onCellActivate(key);
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
            e.preventDefault();
            onCellActivate(key);
          }
        }}
      >
        {inner}
      </td>
    );
  };

  const headCell = (S: WireSheet, ci: number) => {
    const col = S.cols[ci]!;
    const cls = stickyCls(S, ci);
    if (col.hdr) {
      const key = `kyc|h|${col.key}`;
      const can = editable(key);
      if (edit === key)
        return (
          <th scope="col" className={`${cls} cr-editing`} data-edit={key} key={col.key}>
            {editor(key, false)}
          </th>
        );
      return (
        <th
          scope="col"
          className={`${cls}${can ? ' cr-can' : ''}`}
          data-edit={key}
          tabIndex={0}
          key={col.key}
          onClick={() => onCellActivate(key)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onCellActivate(key);
            }
          }}
        >
          {col.n || 'New director'}
        </th>
      );
    }
    return (
      <th scope="col" className={cls} key={col.key}>
        {col.n}
        {col.s ? <Ic n="lock" s={11} cls="cr-lk" /> : null}
      </th>
    );
  };

  const gutter = (S: WireSheet, ri: number) => {
    const row = S.rows[ri]!;
    if (row.spacer) return <th scope="row" className="cr-g" />;
    const scope = `row:${S.id}|${row.key}`;
    const m = modeOf(scope);
    const id = `${S.id}|${row.key}`;
    const name = S.id === 'kyc' ? scopeLabel(sheets!, data!.ids, scope).split(' · ').slice(1).join(' · ') : row.cells[LABEL_COL]?.v || `Row ${ri + 1}`;
    const num = m ? <span className="cr-rn on">{fmtS(until(scope) - now)}</span> : <span className="cr-rn">{ri + 1}</span>;
    const pv = rowHasSecret(S, row.key) ? (
      <button
        type="button"
        className={`cr-rb${m ? ' on' : ''}`}
        data-act="row-preview"
        data-key={id}
        aria-label={`${m ? 'Lock row ' : 'Preview row '}${ri + 1} · ${name}`}
        title={m ? 'Lock row' : 'Preview row'}
        onClick={() => (m ? void endScope(scope, { act: 'row-preview', key: id }) : openOtp('preview', scope, { act: 'row-preview', key: id }))}
      >
        <Ic n={m ? 'eye-off' : 'eye'} s={12} />
      </button>
    ) : (
      <span className="cr-rb-x" />
    );
    const edOn = until(scope, ['edit']) > 0;
    const edb = (
      <button
        type="button"
        className={`cr-rb${m === 'Edit' ? ' on' : ''}`}
        data-act="row-edit"
        data-key={id}
        aria-label={`${m === 'Edit' ? 'Lock row ' : 'Edit row '}${ri + 1} · ${name}`}
        title={m === 'Edit' ? 'Lock row' : 'Edit row'}
        onClick={() => (edOn ? void endScope(scope, { act: 'row-edit', key: id }) : openOtp('edit', scope, { act: 'row-edit', key: id }))}
      >
        <Ic n="pencil" s={12} />
      </button>
    );
    return (
      <th scope="row" className="cr-g">
        <span className="cr-gw">
          {num}
          {pv}
          {edb}
        </span>
      </th>
    );
  };

  /* The Login band reads the Address sheet's Registered office row (same source
     as that sheet); only when that row has no street-level parts does it fall
     back to the step-7 free-text line the row's State/PIN were derived from. */
  const bandAddress = (() => {
    const reg = sheets?.address?.rows.find((r) => r.key === 'registered');
    const val = (k: string) => (reg?.cells[k]?.v ?? '').trim();
    const street = ['door', 'building', 'street', 'area', 'landmark', 'city'].map(val).filter(Boolean);
    if (street.length) return [...street, ...['district', 'state', 'pin', 'country'].map(val).filter(Boolean)].join(', ');
    return data?.registeredAddress ?? '';
  })();

  const grid = (S: WireSheet) => {
    const nc = S.cols.length;
    const titles =
      S.id === 'login'
        ? [`${companyName.toUpperCase()} - Login Credentials`, ...(bandAddress ? [`Address: ${bandAddress}`] : [])]
        : S.id === 'kyc'
          ? [companyName.toUpperCase()]
          : [];
    const em = hasEdit('page') || hasEdit(`tab:${S.id}`);
    const addRowBtn = S.id === 'login' || S.id === 'other';
    const noDirectors = S.id === 'kyc' && S.cols.length <= 1;
    return (
      <>
        {noDirectors ? (
          <div className="cr-empty cr-empty-kyc">
            <CrBot />
            <span className="cr-bub">Directors appear here after the Proposed Directors step, or use Add director.</span>
          </div>
        ) : null}
        {/* a scrolling region must take focus so keyboard users can scroll it (WCAG 2.1.1) */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- focusable scroll container, see above */}
        <div className="cr-gridbox" tabIndex={0} role="region" aria-label={`${tabLabel(S.id)} sheet`} ref={gridRef}>
          <table className={`cr-t${S.id === 'kyc' ? ' kyc xl' : ''}${S.id === 'login' ? ' xl' : ''}${em ? ' cr-editmode' : ''}`}>
            <caption className="sr">
              {tabLabel(S.id)} · {S.rows.length} rows{em ? ' · edit mode' : ' · read-only'}
            </caption>
            <thead>
              <tr className="cr-letters">
                <th className="cr-g" scope="col">
                  <span className="sr">Row</span>
                </th>
                {S.cols.map((c, i) => (
                  <th scope="col" className={stickyCls(S, i)} key={c.key}>
                    {colLetter(i)}
                  </th>
                ))}
              </tr>
              {titles.map((t, i) => (
                <tr className="cr-ttlrow" key={i}>
                  <th className="cr-g" scope="col" />
                  <th className={`cr-ttl${i ? ' cr-ttl2' : ''}`} colSpan={nc} scope="colgroup">
                    <span className="cr-ttl-in">{t}</span>
                  </th>
                </tr>
              ))}
              <tr className="cr-names">
                <th className="cr-g" scope="col">
                  #
                </th>
                {S.cols.map((_, i) => headCell(S, i))}
              </tr>
            </thead>
            {S.rows.length === 0 ? (
              <tbody>
                <tr>
                  <td className="cr-empty-td" colSpan={nc + 1}>
                    <div className="cr-empty">
                      <CrBot />
                      <span className="cr-bub">
                        {S.id === 'other' ? `Nothing here yet. Add a row for any other login ${shell?.companyShort ?? 'your'}’s team uses.` : 'Nothing here yet.'}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {S.rows.map((row, ri) =>
                  row.spacer ? (
                    <tr className="cr-spacer" key={row.key}>
                      {gutter(S, ri)}
                      <td colSpan={nc} />
                    </tr>
                  ) : (
                    <tr
                      key={row.key}
                      className={`${KYC_ROWS.find((p) => p.key === row.key && p.tall) && S.id === 'kyc' ? 'cr-tallrow ' : ''}${modeOf(`row:${S.id}|${row.key}`) ? 'cr-rowon' : ''}`}
                    >
                      {gutter(S, ri)}
                      {S.cols.map((_, ci) => cellTd(S, ri, ci))}
                    </tr>
                  ),
                )}
              </tbody>
            )}
          </table>
        </div>
        {addRowBtn ? (
          <div className="cr-addrow">
            <button type="button" className="cr-btn cr-btn-sm" data-act="add-row" onClick={() => needEdit(`tab:${S.id}`, () => void addRow(S.id))}>
              <Ic n="plus" s={13} />
              Add row
            </button>
          </div>
        ) : null}
      </>
    );
  };

  const countOf = (id: CredSheet) => (sheets ? sheets[id].rows.filter((r) => !r.spacer).length : 0);
  const idx = CRED_TABS.findIndex((t) => t[0] === tab);
  const stage = after ? 'after' : 'before';

  return (
    <div className="cp-credentials" ref={rootRef}>
      <div className="cr-page">
        <div className="cr-main" id="creds-root">
          <div className="cr-wrap">
            <div className="cr-bar" role="toolbar" aria-label="Credentials">
              <span className="cr-tile">
                <Ic n="key-round" s={16} />
              </span>
              <h1 className="cr-title">Credentials</h1>
              <div className="cr-seg" role="radiogroup" aria-label="Stage">
                <span className="thumb" style={{ transform: `translateX(${stage === 'after' ? 100 : 0}%)` }} />
                <button type="button" role="radio" aria-checked={stage === 'before'} className={stage === 'before' ? 'on' : ''} data-act="stage" data-key="before" onClick={() => setStage('before')}>
                  Before COI
                </button>
                <button type="button" role="radio" aria-checked={stage === 'after'} className={stage === 'after' ? 'on' : ''} data-act="stage" data-key="after" onClick={() => setStage('after')}>
                  After COI
                </button>
              </div>
              <span className="cr-sp" />
              <button type="button" className="cr-btn" data-act="log" onClick={() => setLogOpen(true)}>
                <Ic n="history" s={14} />
                Access log
              </button>
              {data ? modeBtns('page', '', true) : null}
            </div>

            {q.isError ? (
              <div className="cr-errbox" role="alert">
                Could not load the credentials. <button type="button" className="cr-link" onClick={() => void q.refetch()}>Try again</button>
              </div>
            ) : !data || !T ? (
              <>
                <section className="cr-ids" aria-label="Company identifiers" aria-busy="true">
                  {['CIN', 'PAN', 'TAN', 'GSTIN', 'Registrations', 'DSC holders'].map((n, i) =>
                    tile(['mca', 'it', 'it', 'gst', 'oth', 'oth'][i]!, n, <span className="cr-ctv cr-cpend">…</span>),
                  )}
                </section>
                <div className="cr-skel" aria-hidden="true" />
              </>
            ) : (
              <>
                <section className="cr-ids" aria-label="Company identifiers">
                  {idTiles()}
                  {regTile()}
                  {dscTile()}
                </section>
                <section className="cr-wb" aria-label="Workbook">
                  <div className="cr-wbh">
                    <div className="cr-segx">
                      <div className="cr-seg cr-seg5" role="tablist" aria-label="Sheets">
                        <span className="thumb" style={{ transform: `translateX(${idx * 100}%)` }} />
                        {CRED_TABS.map(([id, name]) => (
                          <button
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            className={tab === id ? 'on' : ''}
                            data-act="tab"
                            data-key={id}
                            key={id}
                            onClick={() => selectTab(id)}
                          >
                            {name}
                            <span className="cr-cnt">{countOf(id)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="cr-sel">
                      <span className="sr">Sheet</span>
                      <select
                        id="cr-tabsel"
                        aria-label="Sheet"
                        value={tab}
                        onChange={(e) => {
                          setTab(e.target.value as CredSheet);
                          refocus({ id: 'cr-tabsel' });
                        }}
                      >
                        {CRED_TABS.map(([id, name]) => (
                          <option value={id} key={id}>
                            {name} ({countOf(id)})
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="cr-sp" />
                    <div className="cr-wbb">
                      {tab === 'kyc' ? (
                        <button type="button" className="cr-btn cr-btn-sm" data-act="add-dir" onClick={() => needEdit('tab:kyc', () => void addRow('kyc'))}>
                          <Ic n="plus" s={13} />
                          Add director
                        </button>
                      ) : null}
                      {modeBtns(`tab:${tab}`, ' cr-btn-sm', false)}
                    </div>
                  </div>
                  {grid(T)}
                </section>
              </>
            )}
          </div>
        </div>
      </div>

      {host && otp && data
        ? createPortal(
            <div className="cp-credentials" style={{ display: 'contents' } as CSSProperties}>
              <OtpDialog
                key={otp.n}
                mode={otp.mode}
                scope={otp.scope}
                caption={sLabel(otp.scope)}
                manager={data.manager}
                engagementQuery={engQ}
                onClose={closeOtp}
                onGranted={(g) => void granted(g)}
                onFail={(msg) => {
                  toast(msg);
                  closeOtp();
                }}
              />
            </div>,
            host,
          )
        : null}
      {host && logOpen
        ? createPortal(
            <div className="cp-credentials" style={{ display: 'contents' } as CSSProperties}>
              <AccessLog
                engQ={engQ}
                onClose={() => {
                  setLogOpen(false);
                  refocus({ act: 'log' });
                }}
                onAudit={() => go('audit')}
              />
            </div>,
            host,
          )
        : null}
      {viewer ? <DocViewer docs={[viewer]} index={0} onClose={() => setViewer(null)} /> : null}
    </div>
  );
}

function AccessLog({ engQ, onClose, onAudit }: { engQ: string; onClose: () => void; onAudit: () => void }) {
  const xRef = useRef<HTMLButtonElement>(null);
  const q = useQuery({
    queryKey: ['client-portal', 'credentials-log'],
    queryFn: async (): Promise<CredentialsLogEntry[]> => {
      const res = await fetch(`/api/client/credentials/log${engQ}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { entries: CredentialsLogEntry[] }).entries;
    },
    refetchOnMount: 'always',
  });
  useEffect(() => {
    xRef.current?.focus();
  }, []);
  const rows = q.data ?? [];
  return (
    <div id="cr-drawer">
      <div className="cr-scrim" role="presentation" onClick={onClose} />
      <div className="cr-drawer" role="dialog" aria-label="Access log">
        <header className="cr-dh">
          <span className="cr-tile">
            <Ic n="history" s={16} />
          </span>
          <h2 className="cr-dt">Access log</h2>
          <span className="cr-chip prog">{rows.length}</span>
          <span className="cr-sp" />
          <button type="button" className="cr-btn cr-btn-sm" data-act="audit" onClick={onAudit}>
            <Ic n="file-text" s={13} />
            Open in Audit
          </button>
          <button type="button" id="cr-log-x" className="cr-ib" aria-label="Close access log" onClick={onClose} ref={xRef}>
            <Ic n="x" s={14} />
          </button>
        </header>
        <ol className="cr-log" aria-busy={q.isLoading}>
          {q.isLoading ? (
            <li className="cr-log-empty">Loading…</li>
          ) : q.isError ? (
            <li className="cr-log-empty">Could not load the access log.</li>
          ) : rows.length === 0 ? (
            <li className="cr-log-empty">No previews, edits or reveals yet.</li>
          ) : (
            rows.map((e) => (
              <li key={e.id}>
                <time className="cr-mono" dateTime={e.at}>
                  {fmtDate(e.at)}
                </time>
                <span>{e.text}</span>
              </li>
            ))
          )}
        </ol>
        <footer className="cr-df">
          <span className="cr-cap">Previews, edits and saved changes are logged here and on the Audit page</span>
        </footer>
      </div>
    </div>
  );
}

/** The prototype's small Visor bot next to a navy `.cr-bub` pill (v7p_credentials.dc.html BOT). */
function CrBot() {
  return (
    <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true" focusable="false" style={{ flex: 'none' }}>
      <line x1="24" y1="6" x2="24" y2="11" stroke="#1E40AF" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="24" cy="5" r="3" fill="#2DD4BF" />
      <rect x="9" y="11" width="30" height="26" rx="10" fill="#4C8DF8" />
      <rect x="14" y="17" width="20" height="13" rx="6" fill="#0B1736" />
      <circle cx="19" cy="23" r="2.6" fill="#7DD3FC" />
      <circle cx="29" cy="23" r="2.6" fill="#7DD3FC" />
      <rect x="16" y="39" width="16" height="5" rx="2.5" fill="#1E40AF" />
    </svg>
  );
}
