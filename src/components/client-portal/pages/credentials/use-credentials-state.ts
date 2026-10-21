import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePortalOptional } from '@/components/client-portal/PortalProvider';
import type { ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import {
  KYC_ROWS,
  LABEL_COL,
  cellLabel,
  scopeLabel,
  scopesCovering,
  type CredMode,
  type CredSheet,
  type CredentialsPayload,
  type WireCell,
  type WireGrant,
  type WireSheet,
} from '@/lib/client-portal/credentials';

const QK = ['client-portal', 'credentials'] as const;

export type Focus = { act?: string; key?: string; alt?: string; td?: string; id?: string } | null;

export interface OtpReq {
  mode: CredMode;
  scope: string;
  ret: Focus;
  then?: () => void;
  n: number;
}

/**
 * State and actions behind the credentials page: the workbook query, live
 * grants and their countdowns, focus and sticky-header bookkeeping, the OTP
 * flow, cell edits, row adds, copy, and the Before / After COI stage.
 */
export function useCredentialsState() {
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

  const companyName = data?.companyName ?? shell?.companyName ?? '';
  const mgrName = data?.manager?.name ?? 'your Project Manager';

  const selectTab = (t: CredSheet) => {
    setTab(t);
    refocus({ act: 'tab', key: t });
  };

  return {
    after,
    setAfter,
    toast,
    go,
    shell,
    qc,
    engQ,
    q,
    data,
    setData,
    refetch,
    tab,
    setTab,
    edit,
    setEdit,
    editV,
    setEditV,
    otp,
    setOtp,
    logOpen,
    setLogOpen,
    viewer,
    setViewer,
    now,
    setNow,
    host,
    setHost,
    pendingFocus,
    pendingScroll,
    rootRef,
    gridRef,
    editRef,
    saving,
    grants,
    staff,
    until,
    modeOf,
    previewed,
    hasEdit,
    expiredSeen,
    sheets,
    T,
    labOf,
    hasSno,
    label,
    sLabel,
    isSecretCell,
    editable,
    fixGrid,
    refocus,
    api,
    failToast,
    openOtp,
    closeOtp,
    granted,
    endScope,
    needEdit,
    valueOf,
    saveChange,
    startEdit,
    commitEdit,
    cancelEdit,
    addRow,
    copyText,
    openCert,
    setStage,
    companyName,
    mgrName,
    selectTab,
  };
}

export type CredentialsState = ReturnType<typeof useCredentialsState>;
