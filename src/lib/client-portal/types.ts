/**
 * Client portal v7 — shared types for the shell (sidebar, top bar, Before /
 * After pill, Ask VCFO launcher). Pure: imported by the repository, the API
 * route and the client components.
 */

export type PortalViewState = 'auto' | 'before' | 'after';
type PortalTheme = 'light' | 'dark' | 'system';
type PortalDocGrouping = 'step' | 'category';

export interface ClientPortalPrefs {
  viewState: PortalViewState;
  theme: PortalTheme;
  navOpen: Record<string, boolean>;
  introSeen: boolean;
  docGrouping: PortalDocGrouping;
  botNoteSeen: boolean;
}

export interface ClientPortalPrefsPatch {
  viewState?: PortalViewState;
  theme?: PortalTheme;
  navOpen?: Record<string, boolean>;
  introSeen?: true;
  docGrouping?: PortalDocGrouping;
  botNoteSeen?: true;
}

export const CLIENT_PORTAL_DEFAULT_PREFS: ClientPortalPrefs = {
  viewState: 'auto',
  theme: 'light',
  navOpen: {},
  introSeen: false,
  docGrouping: 'step',
  botNoteSeen: false,
};

/** Accept only known keys and values; anything else is dropped. */
export function normalizePortalPrefsPatch(input: unknown): ClientPortalPrefsPatch {
  const out: ClientPortalPrefsPatch = {};
  if (!input || typeof input !== 'object') return out;
  const p = input as Record<string, unknown>;
  if (p.viewState === 'auto' || p.viewState === 'before' || p.viewState === 'after') out.viewState = p.viewState;
  if (p.theme === 'light' || p.theme === 'dark' || p.theme === 'system') out.theme = p.theme;
  if (p.docGrouping === 'step' || p.docGrouping === 'category') out.docGrouping = p.docGrouping;
  if (p.introSeen === true) out.introSeen = true;
  if (p.botNoteSeen === true) out.botNoteSeen = true;
  if (p.navOpen && typeof p.navOpen === 'object' && !Array.isArray(p.navOpen)) {
    const nav: Record<string, boolean> = {};
    for (const [k, v] of Object.entries(p.navOpen as Record<string, unknown>)) {
      if (/^[a-z-]{1,24}$/.test(k) && typeof v === 'boolean') nav[k] = v;
    }
    out.navOpen = nav;
  }
  return out;
}

export interface ClientPortalContact {
  id: string;
  name: string;
  role: 'Project Manager' | 'Project Lead' | 'SBC help desk';
  initials: string;
  support?: boolean;
  email?: string;
  phoneE164?: string;
  /** Same-origin photo URL (`/api/client/portal/team-photo/<id>`), when the person has one. */
  avatarUrl?: string;
  whatsappE164?: string;
}

export interface ClientPortalShell {
  engagementId: string;
  companyName: string;
  /** "Northwind" for "Northwind India Private Limited". */
  companyShort: string;
  me: { name: string; email: string; initials: string; roleLabel: string };
  team: ClientPortalContact[];
  /** Real COI state (CIN or incorporation date recorded). */
  incorporated: boolean;
  /** The engagement's incorporation (COI) date, `YYYY-MM-DD`, when it is recorded. */
  coiDate?: string | null;
  /**
   * Who looks at the portal. A client with a COI date sees the After view only and no
   * Before/After switch (D4); staff who preview the client view keep the switch.
   */
  viewer?: 'client' | 'staff';
  badges: {
    notifications: number;
    documents: number;
    spiceDone: number;
    spiceTotal: number;
  };
  prefs: ClientPortalPrefs;
}

/** D4: the Before/After switch shows unless a client looks at an engagement with a COI date. */
export function showsBeforeAfterSwitch(shell: Pick<ClientPortalShell, 'coiDate' | 'viewer'> | null | undefined): boolean {
  if (!shell) return false;
  return !(shell.coiDate && shell.viewer !== 'staff');
}

/**
 * Which layout the client sees: the stored pill choice, else the real state. Once the
 * engagement has a COI date a client always sees After (D4).
 */
export function effectiveAfter(shell: Pick<ClientPortalShell, 'incorporated' | 'prefs' | 'coiDate' | 'viewer'>): boolean {
  if (!showsBeforeAfterSwitch(shell)) return true;
  if (shell.prefs.viewState === 'after') return true;
  if (shell.prefs.viewState === 'before') return false;
  return shell.incorporated;
}
