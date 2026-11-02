'use client';

/**
 * Staff console runtime (manager now; admin, super admin and developer reuse it).
 * The React form of the prototype's console machinery (a59n_mgr_shell.js,
 * a59y_console.js): one frame (icon rail + hover panel + top bar), real Next
 * routes for the pages, and the shared overlays every page uses:
 *
 *   openPop     — small anchored card (also the breakdown "drill" and menus)
 *   openModal   — one dialog at a time (`.modal.mx-modal`)
 *   openDrawer  — the right-hand detail drawer (`.mx-drawer`, task / step details)
 *   toast       — a short confirmation, optionally with Undo
 *   openSearch  — Ctrl K palette over the items pages publish
 *   chat        — the Ask VCFO panel (real assistant)
 *
 * Overlays take a React node, not a snapshot: the node's own component reads
 * live data with hooks, so an open card refreshes with the data.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme as useAppTheme } from 'next-themes';
import { useApp } from '@/context/AppContext';

/* ---------------------------------------------------------------- seats */

/**
 * The console seats (prototype `data-seat`): manager, project lead, admin, super admin, developer.
 * The prototype drew the project lead in the client portal's frame, before the console existed; a lead
 * opens the same pages as a manager in the live tool (client, step, compliance, mail, vault …), so the
 * lead sits in the console too, with its own Today desk.
 */
export type Seat = 'mgr' | 'lead' | 'adm' | 'sup' | 'dev';

export const SEAT_LABEL: Record<Seat, string> = { mgr: 'Manager', lead: 'Project lead', adm: 'Admin', sup: 'Super admin', dev: 'Developer' };

/**
 * Where each seat's routes live. Pages shared by several seats build every link from
 * `useConsole().base` (never a hard-coded '/app/manager'), e.g. `${base}/projects/${slug}`.
 */
export const SEAT_BASE: Record<Seat, string> = { mgr: '/app/manager', lead: '/app/intern', adm: '/app/admin', sup: '/app/super', dev: '/app/dev' };

/** Stage filter for the book (prototype "View book as", made real): every client, or one stage. */
export type StageScope = 'all' | 'inc' | 'cmp';

/* ---------------------------------------------------------------- search palette */

export interface PaletteItem {
  id: string;
  label: string;
  kind: string;
  sw: string;
  go: () => void;
}

/* ---------------------------------------------------------------- overlays */

export interface PopOptions {
  cls?: string;
  push?: boolean;
  kind?: string;
}
export interface PopState {
  stack: ReactNode[];
  anchor: Element | DOMRect | null;
  cls?: string;
  kind?: string;
  seq: number;
}
export interface ModalOptions {
  /** extra class on `.modal` (e.g. 'wide') */
  cls?: string;
  /** align to the top (search palette) */
  top?: boolean;
  /** the node brings its own box (`.pal`), no `.modal` wrapper */
  bare?: boolean;
  label?: string;
}

/* ---------------------------------------------------------------- context */

export interface ConsoleCtx {
  seat: Seat;
  /** the seat's route prefix (SEAT_BASE), e.g. '/app/manager' or '/app/intern' */
  base: string;
  /** the signed-in person */
  me: { id: string; name: string; email: string; role: string; initials: string } | null;
  go: (href: string) => void;

  /** the trail a page set, with the path it belongs to (a trail never outlives its page) */
  crumbs: { path: string; trail: string[] };
  setCrumbs: (path: string, trail: string[]) => void;

  scope: StageScope;
  setScope: (s: StageScope) => void;

  pop: PopState | null;
  openPop: (anchor: Element | DOMRect | null | undefined, node: ReactNode, opts?: PopOptions) => void;
  popBack: () => void;
  closePop: () => void;

  modal: { node: ReactNode; opts: ModalOptions; seq: number } | null;
  openModal: (node: ReactNode, opts?: ModalOptions) => void;
  closeModal: () => void;

  drawer: { node: ReactNode; seq: number } | null;
  openDrawer: (node: ReactNode) => void;
  closeDrawer: () => void;

  toastMsg: { msg: string; undo?: () => void; n: number } | null;
  toast: (msg: string, undo?: () => void) => void;
  clearToast: () => void;

  chat: { open: boolean; ask: { q: string; n: number } | null };
  openChat: (question?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;

  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;

  badges: Partial<Record<string, { n: number | string; tone?: '' | 'hot' | 'new' }>>;
  setBadge: (key: string, v: { n: number | string; tone?: '' | 'hot' | 'new' } | undefined) => void;

  registerPalette: (source: string, items: PaletteItem[]) => void;
  paletteItems: () => PaletteItem[];
  openSearch: () => void;
  searchSeq: number;
}

const Ctx = createContext<ConsoleCtx | null>(null);

export function useConsole(): ConsoleCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useConsole must be used inside <ConsoleRoot>');
  return v;
}
export function useConsoleOptional(): ConsoleCtx | null {
  return useContext(Ctx);
}

const THEME_KEY = 'vcfo-theme';
const SCOPE_KEY = 'vcfo-console-scope';

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}

export function ConsoleProvider({ seat, children }: { seat: Seat; children: ReactNode }) {
  const router = useRouter();
  const { user } = useApp();
  const me = useMemo(
    () => (user ? { id: user.id, name: user.name || user.email, email: user.email, role: user.role, initials: initialsOf(user.name || user.email) } : null),
    [user],
  );
  const go = useCallback((href: string) => router.push(href), [router]);

  /* ---------- crumbs (pages set them) */
  const [crumbs, setCrumbsState] = useState<{ path: string; trail: string[] }>({ path: '', trail: [] });
  const setCrumbs = useCallback(
    (path: string, trail: string[]) =>
      setCrumbsState((c) => (c.path === path && c.trail.join('\u0000') === trail.join('\u0000') ? c : { path, trail })),
    [],
  );

  /* ---------- stage scope (remembered for the browser session) */
  const [scope, setScopeState] = useState<StageScope>('all');
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(SCOPE_KEY);
      if (v === 'inc' || v === 'cmp' || v === 'all') setScopeState(v);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setScope = useCallback((s: StageScope) => {
    setScopeState(s);
    try {
      sessionStorage.setItem(SCOPE_KEY, s);
    } catch {
      /* storage unavailable */
    }
  }, []);

  /* ---------- theme: the console opens dark (Graphite) unless the person chose light */
  const [theme, setThemeState] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === 'light') setThemeState('light');
    } catch {
      /* storage unavailable */
    }
  }, []);
  // the app's own theme (next-themes, the old views) follows the console's switch, as Settings does
  const { setTheme: setAppTheme } = useAppTheme();
  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    setAppTheme(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      /* storage unavailable */
    }
  }, [setAppTheme]);

  /* ---------- popover */
  const [pop, setPop] = useState<PopState | null>(null);
  const openPop = useCallback((anchor: Element | DOMRect | null | undefined, node: ReactNode, opts?: PopOptions) => {
    setPop((p) => {
      const seq = (p?.seq ?? 0) + 1;
      if (opts?.push && p) return { ...p, stack: [...p.stack, node], cls: opts.cls ?? p.cls, kind: opts.kind ?? p.kind, anchor: anchor ?? p.anchor, seq };
      return { stack: [node], anchor: anchor ?? null, cls: opts?.cls, kind: opts?.kind, seq };
    });
  }, []);
  const popBack = useCallback(() => setPop((p) => (p && p.stack.length > 1 ? { ...p, stack: p.stack.slice(0, -1), seq: p.seq + 1 } : p)), []);
  const closePop = useCallback(() => setPop(null), []);

  /* ---------- modal / drawer */
  const [modal, setModal] = useState<{ node: ReactNode; opts: ModalOptions; seq: number } | null>(null);
  const openModal = useCallback((node: ReactNode, opts?: ModalOptions) => {
    setPop(null);
    setModal((m) => ({ node, opts: opts ?? {}, seq: (m?.seq ?? 0) + 1 }));
  }, []);
  const closeModal = useCallback(() => setModal(null), []);
  const [drawer, setDrawer] = useState<{ node: ReactNode; seq: number } | null>(null);
  const openDrawer = useCallback((node: ReactNode) => {
    setPop(null);
    setDrawer((d) => ({ node, seq: (d?.seq ?? 0) + 1 }));
  }, []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  /* ---------- toast (with an optional Undo, prototype mxToast) */
  const [toastMsg, setToastMsg] = useState<{ msg: string; undo?: () => void; n: number } | null>(null);
  const toast = useCallback((msg: string, undo?: () => void) => setToastMsg((t) => ({ msg, undo, n: (t?.n ?? 0) + 1 })), []);
  const clearToast = useCallback(() => setToastMsg(null), []);

  /* ---------- chat */
  const [chat, setChat] = useState<{ open: boolean; ask: { q: string; n: number } | null }>({ open: false, ask: null });
  const openChat = useCallback((question?: string) => {
    setPop(null);
    setChat((c) => ({ open: true, ask: question ? { q: question, n: (c.ask?.n ?? 0) + 1 } : c.ask }));
  }, []);
  const closeChat = useCallback(() => setChat((c) => ({ ...c, open: false })), []);
  const toggleChat = useCallback(() => setChat((c) => ({ ...c, open: !c.open })), []);

  /* ---------- nav badges (pages and data hooks publish them) */
  const [badges, setBadges] = useState<ConsoleCtx['badges']>({});
  const setBadge = useCallback((key: string, v: { n: number | string; tone?: '' | 'hot' | 'new' } | undefined) => {
    setBadges((b) => {
      const cur = b[key];
      if ((!cur && !v) || (cur && v && cur.n === v.n && cur.tone === v.tone)) return b;
      const next = { ...b };
      if (v) next[key] = v;
      else delete next[key];
      return next;
    });
  }, []);

  /* ---------- search palette */
  const paletteRef = useRef(new Map<string, PaletteItem[]>());
  const registerPalette = useCallback((source: string, items: PaletteItem[]) => {
    paletteRef.current.set(source, items);
  }, []);
  const paletteItems = useCallback(() => [...paletteRef.current.values()].flat(), []);
  const [searchSeq, setSearchSeq] = useState(0);
  const openSearch = useCallback(() => setSearchSeq((n) => n + 1), []);

  /* ---------- keyboard: Ctrl K; Escape closes modal → popover → drawer → chat */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
        return;
      }
      if (e.key !== 'Escape') return;
      if (modal) return setModal(null);
      if (pop) return setPop(null);
      if (drawer) return setDrawer(null);
      if (chat.open) return setChat((c) => ({ ...c, open: false }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, pop, drawer, chat.open, openSearch]);

  useEffect(() => {
    if (!drawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawer]);

  const value = useMemo<ConsoleCtx>(
    () => ({
      seat,
      base: SEAT_BASE[seat],
      me,
      go,
      crumbs,
      setCrumbs,
      scope,
      setScope,
      pop,
      openPop,
      popBack,
      closePop,
      modal,
      openModal,
      closeModal,
      drawer,
      openDrawer,
      closeDrawer,
      toastMsg,
      toast,
      clearToast,
      chat,
      openChat,
      closeChat,
      toggleChat,
      theme,
      setTheme,
      badges,
      setBadge,
      registerPalette,
      paletteItems,
      openSearch,
      searchSeq,
    }),
    [seat, me, go, crumbs, setCrumbs, scope, setScope, pop, openPop, popBack, closePop, modal, openModal, closeModal, drawer, openDrawer, closeDrawer, toastMsg, toast, clearToast, chat, openChat, closeChat, toggleChat, theme, setTheme, badges, setBadge, registerPalette, paletteItems, openSearch, searchSeq],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/* ---------------------------------------------------------------- hooks for pages */

/** The top-bar trail after the person's name, e.g. ['Clients', 'Northwind', 'Registered office address']. */
export function useCrumbs(trail: string[]) {
  const { setCrumbs } = useConsole();
  const path = usePathname() ?? '';
  const key = trail.join('\u0000');
  useEffect(() => {
    setCrumbs(path, key ? key.split('\u0000') : []);
  }, [path, key, setCrumbs]);
}

/** Publish search items; replaced whenever `items` changes. */
export function useConsolePalette(source: string, items: PaletteItem[]) {
  const { registerPalette } = useConsole();
  useEffect(() => {
    registerPalette(source, items);
  }, [registerPalette, source, items]);
}

/** Publish a sidebar badge for a nav key. `undefined` (or a 0 count) hides it. */
export function useConsoleBadge(key: string, n: number | string | undefined, tone: '' | 'hot' | 'new' = '') {
  const { setBadge } = useConsole();
  useEffect(() => {
    setBadge(key, n === undefined || n === 0 || n === '' ? undefined : { n, tone });
  }, [setBadge, key, n, tone]);
}

/** Fade-in / settle / fade-out (prototype showFx / hideFx): mounted while open or fading out. */
export function useFx(open: boolean, ms = 260): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (open) {
      setMounted(true);
      let r2 = 0;
      const r1 = requestAnimationFrame(() => {
        r2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(r1);
        cancelAnimationFrame(r2);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted, shown };
}
