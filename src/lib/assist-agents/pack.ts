import { z } from 'zod';

/**
 * PORTAL PACKS — what VCFO Assist knows about one government website, shared by every task on it
 * (docs/specs/vcfo-assist-agents/PLAN.md, "portal packs"; SAFETY.md, "Portal packs and tax tasks").
 * Pure: no db, no fetch.
 *
 * A pack holds the site's hosts, its pages (URL glob and a "page is ready" selector), shared
 * selectors, waits, information pop-ups the agent may close, and the human gates the site has. A
 * task recipe names its pack (`recipe.pack`) and its pages by id (`pages[].packPage`); Suite fills
 * the page's URL pattern, ready check, human step and pop-ups from the pack before it signs the
 * recipe, so the extension gets one self-contained, signed recipe.
 *
 * `legalStatus` starts as `mock-only`. A pack runs on its live hosts only when its status is
 * `cs-cleared` and the server names it in `ASSIST_LIVE_PACKS` (see `packLive`). Approval for one
 * portal never extends to another.
 */

/** The human gates a portal can have. The agent never performs any of them. */
export const PACK_GATES = ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT', 'PAY', 'EVC'] as const;
export type PackGate = (typeof PACK_GATES)[number];

export const PACK_LEGAL_STATUSES = ['mock-only', 'cs-cleared'] as const;
export type PackLegalStatus = (typeof PACK_LEGAL_STATUSES)[number];

const ID = /^[a-z0-9][a-z0-9-]*$/;
/** An exact host name, or `*.` and a domain for its subdomains. No scheme, port or path. */
const HOST = /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
const MOCK_HOST = /^[a-z0-9.-]+$/;
const ms = z.number().int().min(0).max(60_000);

const packPageSchema = z
  .object({
    id: z.string().regex(ID),
    title: z.string().min(1),
    /** A glob on the URL path (`*` any run, `?` one character), as in recipes. */
    urlPattern: z.string().startsWith('/'),
    mockUrlPattern: z.string().startsWith('/').optional(),
    /** CSS of the element that exists and is visible once the page (or wizard section) is ready. */
    readySelector: z.string().min(1),
    /**
     * A step only the person takes before this page can be filled, for example opening a wizard
     * section or an Add/Edit sub-panel. The agent shows it as "You do this" and waits for
     * `readySelector`; it never clicks the step itself.
     */
    step: z.string().min(1).optional(),
  })
  .strict();

const popupSchema = z
  .object({
    id: z.string().regex(ID),
    label: z.string().min(1),
    /** The information pop-up's OK or Close button. Still guarded at the click (G4, G5). */
    css: z.string().min(1),
  })
  .strict();

export const packSchema = z
  .object({
    id: z.string().regex(ID),
    title: z.string().min(1),
    /** Live portal hosts. Runs reach them only once the pack is live. */
    hosts: z.array(z.string().regex(HOST)).min(1),
    /** Hosts that count as this pack's mock portal (local only). */
    mockHosts: z.array(z.string().regex(MOCK_HOST)).min(1),
    legalStatus: z.enum(PACK_LEGAL_STATUSES),
    /**
     * True when even capturing or building against this portal waits for the CS opinion (GST: its
     * user agreement bars interfaces GSTN has not authorised). The panel shows "Needs CS opinion".
     */
    needsCsOpinionFirst: z.boolean(),
    framework: z.enum(['aem', 'unknown']),
    pages: z.array(packPageSchema),
    /** Shared selectors by purpose, for example `fieldNode`, `fieldLabel`, `wizardStep`, `loggedIn`. */
    selectors: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), z.string().min(1)),
    waits: z
      .object({
        /** How long a page or wizard section may take to show its ready selector. */
        readyMs: ms,
        /** Dependent dropdowns: how long to poll for the wanted option to appear. */
        optionsMs: ms,
        /** After a PIN code is typed, the portal looks up area, city and state. */
        afterPincodeMs: ms,
      })
      .strict(),
    popups: z.array(popupSchema),
    gates: z.array(z.enum(PACK_GATES)).min(1),
    /** Where the pack's knowledge came from (a capture, a commit) and its legal position. */
    source: z.string().min(1),
    notes: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((pack, ctx) => {
    const ids = new Set<string>();
    pack.pages.forEach((p, i) => {
      if (ids.has(p.id)) ctx.addIssue({ code: 'custom', path: ['pages', i, 'id'], message: 'pack_page_duplicate' });
      ids.add(p.id);
    });
    // Login, captcha, OTP, Submit and Pay are the person's on every portal; a pack cannot drop them.
    for (const gate of ['LOGIN', 'SUBMIT'] as const) {
      if (!pack.gates.includes(gate)) ctx.addIssue({ code: 'custom', path: ['gates'], message: `pack_gate_missing_${gate.toLowerCase()}` });
    }
    // A pop-up the agent may close must not read like Submit, Pay, Sign, OTP or Login.
    pack.popups.forEach((p, i) => {
      if (/submit|pay|final|sign|otp|login|verify|proceed|confirm|delete|remove/i.test(`${p.id} ${p.label}`)) {
        ctx.addIssue({ code: 'custom', path: ['popups', i], message: 'popup_must_be_informational' });
      }
    });
  });

export type PortalPack = z.infer<typeof packSchema>;
export type PackPage = PortalPack['pages'][number];

export function parsePack(raw: unknown): PortalPack {
  const parsed = packSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`invalid_pack: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
  }
  return parsed.data;
}

type Env = Record<string, string | undefined>;

/**
 * The packs the server switches on for live use: `ASSIST_LIVE_PACKS=mca-v3,income-tax-efiling`.
 * `ASSIST_LIVE_PORTALS=true` is the deprecated single switch; it still names `mca-v3`, and only
 * that pack. Default: none.
 */
export function assistLivePackIds(env: Env = process.env): Set<string> {
  const ids = new Set(
    (env.ASSIST_LIVE_PACKS ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => ID.test(s)),
  );
  if (env.ASSIST_LIVE_PORTALS?.trim().toLowerCase() === 'true') ids.add('mca-v3');
  return ids;
}

/** A pack is live only when it is `cs-cleared` and the server names it. Either alone is not enough. */
export function packLive(pack: Pick<PortalPack, 'id' | 'legalStatus'>, env: Env = process.env): boolean {
  return pack.legalStatus === 'cs-cleared' && assistLivePackIds(env).has(pack.id);
}

/** True when `host` (no port) is one of the pack's live hosts; `*.x.gov.in` covers subdomains only. */
export function packHasHost(pack: Pick<PortalPack, 'hosts'>, host: string): boolean {
  const bare = host.trim().toLowerCase().replace(/:\d+$/, '');
  return pack.hosts.some((h) => (h.startsWith('*.') ? bare.endsWith(h.slice(1)) : bare === h));
}
