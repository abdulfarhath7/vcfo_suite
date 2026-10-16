'use client';

/**
 * Client portal runtime — the React port of prototype proto.js + shell.js glue:
 * shell data, Before / After state, theme, toast with Undo, the shared
 * drill-down pop-up (rule 14), the point tooltip, and the Ask VCFO chat switch.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  effectiveAfter,
  type ClientPortalPrefs,
  type ClientPortalPrefsPatch,
  type ClientPortalShell,
  type PortalViewState,
} from '@/lib/client-portal/types';
import { portalHref, type PortalRouteKey } from './routes';

export interface DrillTab {
  label: string;
  color?: string;
  /** Total behind the tab when the list is a preview. */
  n?: number;
  rows: DrillRow[];
}
/** [title, meta, chip, chipColor, href] — the prototype's row tuple. */
export type DrillRow = { title: string; meta?: string; chip?: string; chipColor?: string; href?: string; onOpen?: () => void };
export interface DrillConfig {
  title: string;
  sub?: string;
  tabs: DrillTab[];
  active?: number;
  link?: { lead: string; text: string; href?: string; where?: string; onClick?: () => void };
}

export interface ToastOptions {
  undo?: () => void;
}

interface PortalContextValue {
  shell: ClientPortalShell | undefined;
  shellLoading: boolean;
  /** Layout shown: Before (false) or After (true) incorporation. */
  after: boolean;
  setAfter: (after: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  prefs: ClientPortalPrefs | undefined;
  savePrefs: (patch: ClientPortalPrefsPatch) => void;
  toast: (msg: string, opts?: ToastOptions) => void;
  drill: (cfg: DrillConfig) => void;
  tipAt: (x: number, y: number, text: string | null) => void;
  chatOpen: boolean;
  openChat: (question?: string, whatsThis?: WhatsThisAnswer) => void;
  closeChat: () => void;
  /** A question queued by openChat for the chat to send once mounted. */
  pendingQuestion: { q: string; w?: WhatsThisAnswer; n: number } | null;
  go: (key: PortalRouteKey | string) => void;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

/** What's this? answer card (owner board vs_ask). */
export interface WhatsThisAnswer {
  title: string;
  text: string;
  why?: string;
  source?: string;
  href?: string;
  goLabel?: string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function usePortal(): PortalContextValue {
  const v = useContext(PortalContext);
  if (!v) throw new Error('usePortal must be used inside ClientPortalShell');
  return v;
}

export function usePortalOptional(): PortalContextValue | null {
  return useContext(PortalContext);
}

export const PORTAL_SHELL_KEY = ['client-portal', 'shell'] as const;

async function fetchShell(): Promise<ClientPortalShell> {
  const res = await fetch('/api/client/portal', { cache: 'no-store' });
  if (!res.ok) throw new Error(res.status === 403 ? 'forbidden' : `shell ${res.status}`);
  const body = (await res.json()) as { shell: ClientPortalShell };
  return body.shell;
}

const THEME_KEY = 'vcfo.theme';

function readLocalTheme(): 'light' | 'dark' | 'system' | null {
  try {
    const v = JSON.parse(localStorage.getItem(THEME_KEY) ?? 'null');
    return v === 'dark' || v === 'system' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

export function PortalProvider({ children, rootRef }: { children: ReactNode; rootRef: React.RefObject<HTMLDivElement | null> }) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: shell, isLoading } = useQuery({ queryKey: PORTAL_SHELL_KEY, queryFn: fetchShell, staleTime: 30_000, refetchInterval: 60_000 });

  const prefs = shell?.prefs;
  const savePrefs = useCallback(
    (patch: ClientPortalPrefsPatch) => {
      qc.setQueryData<ClientPortalShell>(PORTAL_SHELL_KEY, (old) =>
        old
          ? {
              ...old,
              prefs: {
                ...old.prefs,
                ...(patch.viewState ? { viewState: patch.viewState } : {}),
                ...(patch.theme ? { theme: patch.theme } : {}),
                ...(patch.navOpen ? { navOpen: patch.navOpen } : {}),
                ...(patch.docGrouping ? { docGrouping: patch.docGrouping } : {}),
                ...(patch.introSeen ? { introSeen: true } : {}),
                ...(patch.botNoteSeen ? { botNoteSeen: true } : {}),
              },
            }
          : old,
      );
      void fetch('/api/client/portal/prefs', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => undefined);
    },
    [qc],
  );

  /* ---------- theme: light, dark (True black) or system; remembered ---------- */
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const on = () => setSystemDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [localTheme, setLocalTheme] = useState<'light' | 'dark' | 'system' | null>(null);
  useEffect(() => setLocalTheme(readLocalTheme()), []);
  const themePref = prefs?.theme ?? localTheme ?? 'light';
  const theme: 'light' | 'dark' = themePref === 'system' ? (systemDark ? 'dark' : 'light') : themePref;
  const toggleTheme = useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    setLocalTheme(next);
    savePrefs({ theme: next });
  }, [theme, savePrefs]);
  useEffect(() => {
    const el = rootRef.current;
    if (el) {
      el.setAttribute('data-theme', theme);
      el.style.colorScheme = theme;
    }
  }, [theme, rootRef]);

  /* ---------- toast (prototype #vp-toast: 3.2 s, Undo) ---------- */
  const [toastState, setToastState] = useState<{ msg: string; undo?: () => void; n: number; on: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toast = useCallback((msg: string, opts?: ToastOptions) => {
    setToastState((prev) => ({ msg, undo: opts?.undo, n: (prev?.n ?? 0) + 1, on: true }));
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState((p) => (p ? { ...p, on: false } : p)), 3200);
  }, []);

  /* ---------- Before / After ---------- */
  const after = shell ? effectiveAfter(shell) : false;
  const setAfter = useCallback(
    (v: boolean) => {
      if (!shell) return;
      if (v === after) {
        toast(`Already showing the company ${v ? 'after' : 'before'} incorporation`);
        return;
      }
      const viewState: PortalViewState = v === shell.incorporated ? 'auto' : v ? 'after' : 'before';
      savePrefs({ viewState });
      toast(v ? 'Showing the company after incorporation' : 'Showing the company before incorporation');
    },
    [shell, after, savePrefs, toast],
  );

  /* ---------- drill-down ---------- */
  const [drillCfg, setDrillCfg] = useState<DrillConfig | null>(null);
  const drill = useCallback((cfg: DrillConfig) => setDrillCfg(cfg), []);

  /* ---------- point tooltip (vcfoTipAt) ---------- */
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const tipAt = useCallback((x: number, y: number, text: string | null) => setTip(text == null ? null : { x, y, text }), []);

  /* ---------- chat ---------- */
  const [chatOpen, setChatOpen] = useState(false);
  const [pendingQuestion, setPending] = useState<PortalContextValue['pendingQuestion']>(null);
  const openChat = useCallback((question?: string, whatsThis?: WhatsThisAnswer) => {
    setChatOpen(true);
    if (question) setPending((p) => ({ q: question, w: whatsThis, n: (p?.n ?? 0) + 1 }));
  }, []);
  const closeChat = useCallback(() => setChatOpen(false), []);

  const [drawerOpen, setDrawerOpen] = useState(false);

  const go = useCallback(
    (key: PortalRouteKey | string) => {
      setDrawerOpen(false);
      const href = key.startsWith('/') ? key : portalHref(key as PortalRouteKey);
      router.push(href);
    },
    [router],
  );

  const value = useMemo<PortalContextValue>(
    () => ({
      shell,
      shellLoading: isLoading,
      after,
      setAfter,
      theme,
      toggleTheme,
      prefs,
      savePrefs,
      toast,
      drill,
      tipAt,
      chatOpen,
      openChat,
      closeChat,
      pendingQuestion,
      go,
      drawerOpen,
      setDrawerOpen,
    }),
    [shell, isLoading, after, setAfter, theme, toggleTheme, prefs, savePrefs, toast, drill, tipAt, chatOpen, openChat, closeChat, pendingQuestion, go, drawerOpen],
  );

  return (
    <PortalContext.Provider value={value}>
      {children}
      <div id="vp-toast" role="status" className={toastState?.on ? 'on' : undefined} data-n={toastState?.n}>
        {toastState ? (
          <>
            <span>{toastState.msg}</span>
            {toastState.undo ? (
              <button
                type="button"
                onClick={() => {
                  toastState.undo?.();
                  toast('Undone');
                }}
              >
                Undo
              </button>
            ) : null}
          </>
        ) : null}
      </div>
      <PointTip tip={tip} />
      {drillCfg ? <DrillDialog cfg={drillCfg} onClose={() => setDrillCfg(null)} go={go} toast={toast} /> : null}
    </PortalContext.Provider>
  );
}

function PointTip({ tip }: { tip: { x: number; y: number; text: string } | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useEffect(() => {
    if (!tip || !ref.current) return;
    const w = ref.current.offsetWidth;
    setPos({ left: Math.max(8, Math.min(window.innerWidth - w - 8, tip.x - w / 2)), top: tip.y - 40 < 4 ? tip.y + 18 : tip.y - 40 });
  }, [tip]);
  return (
    <div ref={ref} id="vp-tip" role="tooltip" className={tip ? 'on' : undefined} style={pos ? { left: pos.left, top: pos.top } : undefined}>
      {tip?.text}
    </div>
  );
}

/** One drill-down pop-up for every chart (rule 14): navy sliding pill tabs, rows open their page. */
function DrillDialog({
  cfg,
  onClose,
  go,
  toast,
}: {
  cfg: DrillConfig;
  onClose: () => void;
  go: (k: string) => void;
  toast: (m: string) => void;
}) {
  const [tab, setTab] = useState(cfg.active ?? 0);
  const [on, setOn] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const last = useRef<Element | null>(null);
  useEffect(() => {
    last.current = document.activeElement;
    const r = requestAnimationFrame(() => setOn(true));
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
    return () => {
      cancelAnimationFrame(r);
      clearTimeout(t);
    };
  }, []);
  const close = useCallback(() => {
    setOn(false);
    setTimeout(onClose, 160);
    (last.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [onClose]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [close]);
  const t = cfg.tabs[tab] ?? cfg.tabs[0];
  const rows = t?.rows ?? [];
  const total = t?.n != null ? t.n : rows.length;
  return (
    <div
      id="vp-drill-scrim"
      className={on ? 'on' : undefined}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div id="vp-drill" role="dialog" aria-modal="true" aria-labelledby="vp-drill-t">
        {cfg.link ? (
          <div className="top">
            <span>{cfg.link.lead}</span>
            <a
              href={cfg.link.href ?? '#'}
              onClick={(e) => {
                e.preventDefault();
                close();
                if (cfg.link?.href) go(cfg.link.href);
                else cfg.link?.onClick?.();
              }}
            >
              {cfg.link.text}
            </a>
          </div>
        ) : null}
        <div className="hd">
          <b id="vp-drill-t">
            {cfg.title}
            {cfg.sub ? <small>{cfg.sub}</small> : null}
          </b>
          <button ref={closeRef} type="button" className="x" aria-label="Close" onClick={close}>
            ×
          </button>
        </div>
        <div className="tabs" role="tablist">
          {cfg.tabs.map((x, i) => (
            <button key={x.label} type="button" role="tab" aria-selected={i === tab} onClick={() => setTab(i)}>
              {x.color ? <i style={{ background: x.color }} /> : null}
              {x.label}
              <span>{x.n != null ? x.n : x.rows.length}</span>
            </button>
          ))}
        </div>
        <div className="list">
          {rows.length ? (
            rows.map((r, i) => (
              <a
                key={`${r.title}-${i}`}
                href={r.href ?? '#'}
                className="r"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  if (r.onOpen) r.onOpen();
                  else if (r.href) go(r.href);
                  else toast(`Opening ${r.title}…`);
                }}
              >
                <b>{r.title}</b>
                <em>{r.meta ?? ''}</em>
                {r.chip ? (
                  <span className="c" style={{ background: r.chipColor ?? '#5a6b82' }}>
                    {r.chip}
                  </span>
                ) : (
                  <span />
                )}
                <span className="a">→</span>
              </a>
            ))
          ) : (
            <div style={{ padding: '16px 0', color: '#5a6b82' }}>Nothing here.</div>
          )}
        </div>
        <div className="ft">
          {rows.length < total
            ? `Showing ${rows.length} of ${total} · the full list is in ${cfg.link?.where ?? 'the app'}`
            : `Showing all ${total}`}
        </div>
      </div>
    </div>
  );
}
