'use client';

/**
 * Portal runtime: the React form of the prototype's page-level machinery
 * (a1_core.js + a6_rest.js):
 *
 *   - one continuous page of sections; `go(key)` scrolls to a section and the
 *     scroll-spy keeps the sidebar, mobile tabs and crumb on the current one;
 *   - one small anchored popover (`openPop`) with a Back stack;
 *   - one full-screen step-by-step walkthrough (`openWizard`);
 *   - one modal at a time (`openModal`), a toast, the Ctrl K search palette;
 *   - the Ask VCFO chat switch (`openChat`);
 *   - theme (light / dark / system), saved in the client's portal prefs;
 *   - nav badges and search items that sections publish;
 *   - route intents: /app/client/incorporation/step/pre-13 → the section that
 *     owns steps opens that step's walkthrough once its data has loaded.
 *
 * Popovers, walkthroughs and modals take a React node, not a snapshot: the
 * node's own component reads live data with hooks, so an open card updates
 * when the data refreshes (the prototype re-ran its build function).
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
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientPortalPrefs, ClientPortalShell, PortalTheme } from '@/lib/client-portal/types';
import { getJson, QK, sendJson } from './data';

/* ---------------------------------------------------------------- sections */

export type SectionKey =
  | 'home'
  | 'incorporation'
  | 'registrations'
  | 'master'
  | 'calendar'
  | 'filings'
  | 'documents'
  | 'library'
  | 'credentials'
  | 'team'
  | 'audit'
  | 'settings'
  | 'nhome'
  | 'nmd'
  | 'nsign';

/**
 * The ONE client portal, in page order (the scroll-spy walks it top to bottom).
 * Owner, 2026-10-29: every client gets this same portal, whatever the
 * company's stage. The prototype's separate "Client · SBC-GCC" screens
 * (Overview, Master data, Declarations: keys nhome / nmd / nsign) sit right
 * after Incorporation, because they are the client's part of SPICe+.
 */
export const PORTAL_SECTIONS: SectionKey[] = [
  'home',
  'incorporation',
  'nhome',
  'nmd',
  'nsign',
  'registrations',
  'master',
  'calendar',
  'filings',
  'documents',
  'library',
  'credentials',
  'team',
  'audit',
  'settings',
];

export const SECTION_LABEL: Record<SectionKey, string> = {
  home: 'Home',
  incorporation: 'Incorporation',
  registrations: 'Registrations',
  master: 'Master calendar',
  calendar: 'Calendar',
  filings: 'Filings',
  documents: 'Documents',
  library: 'Library',
  credentials: 'Credentials',
  team: 'Team',
  audit: 'Audit',
  settings: 'Settings',
  nhome: 'Overview',
  nmd: 'Master data',
  nsign: 'Declarations',
};

/** Crumb text when it differs from the label. */
export const SECTION_CRUMB: Partial<Record<SectionKey, string>> = {
  calendar: 'Compliances / Calendar',
  filings: 'Compliances / Filings',
};

/** DOM id of a section's frame. */
export const secId = (k: SectionKey): string => `sec-${k}`;

/* ---------------------------------------------------------------- intents (route → action) */

export type Intent =
  | { kind: 'section'; key: SectionKey }
  | { kind: 'step'; stepId: string }
  | { kind: 'phase'; phaseNo: number }
  | { kind: 'board' }
  | { kind: 'notes' }
  | { kind: 'anns' }
  | { kind: 'reader'; mode: 'saved' | 'learn'; id: string }
  | { kind: 'filing'; id: string };

/* ---------------------------------------------------------------- search palette */

export interface PaletteItem {
  id: string;
  label: string;
  /** right-hand hint: "Section", "Document", "16 Oct · Due soon" … */
  kind: string;
  /** swatch colour (CSS value) */
  sw: string;
  go: () => void;
}

/* ---------------------------------------------------------------- overlays */

export interface PopOptions {
  /** extra class on `.pop` (e.g. 'wide') */
  cls?: string;
  /** keep the current card under a Back button */
  push?: boolean;
  /** identifies the card ('notes', 'anns' …) so a second click can toggle it */
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
  /** `soft` = the slower OTP-style entrance */
  soft?: boolean;
  /** `top` = align to the top (search palette) */
  top?: boolean;
  label?: string;
}

interface ModalState {
  node: ReactNode;
  opts: ModalOptions;
  seq: number;
}

/* ---------------------------------------------------------------- context */

export interface PortalCtx {
  shell: ClientPortalShell | undefined;
  shellLoading: boolean;
  sections: SectionKey[];

  active: SectionKey;
  go: (key: SectionKey, opts?: { target?: string }) => void;

  toast: (msg: string) => void;

  pop: PopState | null;
  openPop: (anchor: Element | DOMRect | null | undefined, node: ReactNode, opts?: PopOptions) => void;
  popBack: () => void;
  closePop: (slow?: boolean) => void;

  wizard: { node: ReactNode; seq: number } | null;
  openWizard: (node: ReactNode) => void;
  closeWizard: () => void;

  modal: ModalState | null;
  openModal: (node: ReactNode, opts?: ModalOptions) => void;
  closeModal: () => void;

  chat: { open: boolean; ask: { q: string; n: number } | null };
  openChat: (question?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;

  theme: PortalTheme;
  isLight: boolean;
  setTheme: (t: PortalTheme) => void;
  savePrefs: (patch: Partial<Pick<ClientPortalPrefs, 'theme'>> & { introSeen?: true; botNoteSeen?: true }) => void;

  badges: Partial<Record<string, number | string>>;
  setBadge: (key: string, value: number | string | undefined) => void;

  registerPalette: (source: string, items: PaletteItem[]) => void;
  paletteItems: () => PaletteItem[];
  openSearch: () => void;
  /** bumps each time Search is asked for; SearchBridge opens the palette */
  searchSeq: number;
  toastMsg: { msg: string; n: number } | null;

  intent: (Intent & { seq: number }) | null;
  setIntent: (i: Intent) => void;
  consumeIntent: (seq: number) => void;
}

const Ctx = createContext<PortalCtx | null>(null);

export function usePortal(): PortalCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePortal must be used inside <PortalRoot>');
  return v;
}

export function usePortalOptional(): PortalCtx | null {
  return useContext(Ctx);
}

/* ---------------------------------------------------------------- provider */

const THEME_KEY = 'vcfo-theme';
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function readStoredTheme(): PortalTheme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const shellQ = useQuery({
    queryKey: QK.shell,
    queryFn: async () => (await getJson<{ shell: ClientPortalShell }>('/api/client/portal'))?.shell,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const shell = shellQ.data ?? undefined;
  const sections = PORTAL_SECTIONS;

  /* ---------- toast */
  const [toastMsg, setToastMsg] = useState<{ msg: string; n: number } | null>(null);
  const toast = useCallback((msg: string) => setToastMsg((t) => ({ msg, n: (t?.n ?? 0) + 1 })), []);

  /* ---------- theme */
  const [theme, setThemeState] = useState<PortalTheme>('system');
  const [sysLight, setSysLight] = useState(false);
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) setThemeState(stored);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    setSysLight(mq.matches);
    const on = () => setSysLight(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const prefTheme = shell?.prefs.theme;
  useEffect(() => {
    if (prefTheme && !readStoredTheme()) setThemeState(prefTheme);
  }, [prefTheme]);
  const savePrefs = useCallback(
    (patch: Record<string, unknown>) => {
      void sendJson('/api/client/portal/prefs', 'PATCH', patch)
        .then(() => qc.invalidateQueries({ queryKey: QK.shell }))
        .catch(() => undefined);
    },
    [qc],
  );
  const setTheme = useCallback(
    (t: PortalTheme) => {
      setThemeState(t);
      try {
        localStorage.setItem(THEME_KEY, t);
      } catch {
        /* storage unavailable */
      }
      savePrefs({ theme: t });
    },
    [savePrefs],
  );
  const isLight = theme === 'light' || (theme === 'system' && sysLight);

  /* ---------- navigation + scroll-spy */
  const [active, setActive] = useState<SectionKey>(sections[0]!);
  const spyLock = useRef(0);
  const settle = useRef<number[]>([]);
  const userScrolled = useRef(false);

  const scrollToEl = useCallback((el: Element, smooth: boolean) => {
    const y = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth && !reduceMotion() ? 'smooth' : 'auto' });
  }, []);

  const closePopRef = useRef<() => void>(() => undefined);

  const go = useCallback(
    (key: SectionKey, opts?: { target?: string }) => {
      const el = document.getElementById(opts?.target ?? secId(key));
      if (!el) return;
      closePopRef.current();
      setActive(key);
      spyLock.current = Date.now() + 1000;
      userScrolled.current = false;
      scrollToEl(el, true);
      // Sections above may still be loading and growing: correct the landing a few times.
      settle.current.forEach(clearTimeout);
      settle.current = [700, 1400, 2400].map((ms) =>
        window.setTimeout(() => {
          if (userScrolled.current) return;
          const top = el.getBoundingClientRect().top;
          if (Math.abs(top - 76) > 6 && window.innerHeight + window.scrollY < document.documentElement.scrollHeight - 4) {
            spyLock.current = Date.now() + 600;
            scrollToEl(el, false);
          }
        }, ms),
      );
    },
    [scrollToEl],
  );

  useEffect(() => {
    let raf = 0;
    const spy = () => {
      raf = 0;
      if (Date.now() < spyLock.current) return;
      let cur = sections[0]!;
      for (const k of sections) {
        const el = document.getElementById(secId(k));
        if (el && el.getBoundingClientRect().top <= 140) cur = k;
      }
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = sections[sections.length - 1]!;
      setActive((a) => (a === cur ? a : cur));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(spy);
    };
    const onUser = () => {
      userScrolled.current = true;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onUser, { passive: true });
    window.addEventListener('touchmove', onUser, { passive: true });
    window.addEventListener('keydown', onUser);
    // sections grow as their data arrives: look again whenever the page height changes, not only on scroll
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onScroll) : null;
    ro?.observe(document.body);
    return () => {
      ro?.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onUser);
      window.removeEventListener('touchmove', onUser);
      window.removeEventListener('keydown', onUser);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sections]);

  useEffect(() => {
    if (!sections.includes(active)) setActive(sections[0]!);
  }, [sections, active]);

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
  closePopRef.current = closePop;

  /* ---------- walkthrough */
  const [wizard, setWizard] = useState<{ node: ReactNode; seq: number } | null>(null);
  const openWizard = useCallback((node: ReactNode) => {
    setPop(null);
    setWizard((w) => ({ node, seq: (w?.seq ?? 0) + 1 }));
  }, []);
  const closeWizard = useCallback(() => setWizard(null), []);

  /* ---------- modal */
  const [modal, setModal] = useState<ModalState | null>(null);
  const openModal = useCallback((node: ReactNode, opts?: ModalOptions) => setModal((m) => ({ node, opts: opts ?? {}, seq: (m?.seq ?? 0) + 1 })), []);
  const closeModal = useCallback(() => setModal(null), []);

  /* ---------- chat */
  const [chat, setChat] = useState<{ open: boolean; ask: { q: string; n: number } | null }>({ open: false, ask: null });
  const openChat = useCallback((question?: string) => {
    setPop(null);
    setChat((c) => ({ open: true, ask: question ? { q: question, n: (c.ask?.n ?? 0) + 1 } : c.ask }));
  }, []);
  const closeChat = useCallback(() => setChat((c) => ({ ...c, open: false })), []);
  const toggleChat = useCallback(() => setChat((c) => ({ ...c, open: !c.open })), []);

  /* ---------- badges */
  const [badges, setBadges] = useState<Partial<Record<string, number | string>>>({});
  const setBadge = useCallback((key: string, value: number | string | undefined) => {
    setBadges((b) => (b[key] === value ? b : { ...b, [key]: value }));
  }, []);

  /* ---------- palette registry */
  const paletteRef = useRef(new Map<string, PaletteItem[]>());
  const registerPalette = useCallback((source: string, items: PaletteItem[]) => {
    paletteRef.current.set(source, items);
  }, []);
  const paletteItems = useCallback(() => [...paletteRef.current.values()].flat(), []);

  /* ---------- search */
  const [searchSeq, setSearchSeq] = useState(0);
  const openSearchModal = useCallback(() => setSearchSeq((n) => n + 1), []);

  /* ---------- intents */
  const [intent, setIntentState] = useState<(Intent & { seq: number }) | null>(null);
  const setIntent = useCallback((i: Intent) => setIntentState((cur) => ({ ...i, seq: (cur?.seq ?? 0) + 1 })), []);
  const consumeIntent = useCallback((seq: number) => setIntentState((cur) => (cur && cur.seq === seq ? null : cur)), []);

  /* ---------- keyboard: Ctrl K, Escape (modal → popover → chat → walkthrough) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearchModal();
        return;
      }
      if (e.key !== 'Escape') return;
      if (modal) return setModal(null);
      if (pop) return setPop(null);
      if (chat.open) return setChat((c) => ({ ...c, open: false }));
      if (wizard) return setWizard(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal, pop, chat.open, wizard, openSearchModal]);

  useEffect(() => {
    if (!wizard) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [wizard]);

  const value = useMemo<PortalCtx>(
    () => ({
      shell,
      shellLoading: shellQ.isPending,
      sections,
      active,
      go,
      toast,
      pop,
      openPop,
      popBack,
      closePop,
      wizard,
      openWizard,
      closeWizard,
      modal,
      openModal,
      closeModal,
      chat,
      openChat,
      closeChat,
      toggleChat,
      theme,
      isLight,
      setTheme,
      savePrefs,
      badges,
      setBadge,
      registerPalette,
      paletteItems,
      openSearch: openSearchModal,
      searchSeq,
      toastMsg,
      intent,
      setIntent,
      consumeIntent,
    }),
    [shell, shellQ.isPending, sections, active, go, toast, pop, openPop, popBack, closePop, wizard, openWizard, closeWizard, modal, openModal, closeModal, chat, openChat, closeChat, toggleChat, theme, isLight, setTheme, savePrefs, badges, setBadge, registerPalette, paletteItems, openSearchModal, searchSeq, toastMsg, intent, setIntent, consumeIntent],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** `.toast` — rendered inside the portal root so the scoped CSS reaches it. */
export function ToastView() {
  const msg = usePortal().toastMsg;
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!msg) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 2800);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div className={'toast' + (on ? ' on' : '')} role="status" aria-live="polite">
      {msg?.msg}
    </div>
  );
}

/* ---------------------------------------------------------------- hooks for sections */

/** Publish search items from a section; they are replaced whenever `items` changes. */
export function usePaletteItems(source: string, items: PaletteItem[]) {
  const { registerPalette } = usePortal();
  useEffect(() => {
    registerPalette(source, items);
  }, [registerPalette, source, items]);
}

/** Publish a sidebar badge (`nb-<key>` in the prototype). `undefined` hides it. */
export function useNavBadge(key: string, value: number | string | undefined) {
  const { setBadge } = usePortal();
  useEffect(() => {
    setBadge(key, value);
  }, [setBadge, key, value]);
}

/**
 * Run `handler` when a route intent of one of `kinds` is pending and the
 * section is `ready` (its data has loaded). The intent is consumed once handled.
 */
export function useIntent<K extends Intent['kind']>(
  kinds: K[],
  ready: boolean,
  handler: (i: Extract<Intent, { kind: K }>) => void,
) {
  const { intent, consumeIntent } = usePortal();
  const h = useRef(handler);
  h.current = handler;
  const key = kinds.join(',');
  useEffect(() => {
    if (!intent || !ready) return;
    if (!key.split(',').includes(intent.kind)) return;
    consumeIntent(intent.seq);
    h.current(intent as unknown as Extract<Intent, { kind: K }>);
  }, [intent, ready, key, consumeIntent]);
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
