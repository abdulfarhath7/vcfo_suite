import { z } from 'zod';
import type { PortalPack } from './pack';

/**
 * RECIPE FORMAT — the cached, versioned field map one sub-agent fills a portal form from
 * (docs/specs/vcfo-assist-agents/PLAN.md §1). Pure: no db, no fetch, so the extension builder can
 * mirror the schema and the tests can parse every recipe file.
 *
 * A recipe never carries a value. `fields[].key` names a key in the Assist profile
 * (`src/lib/assist-profile/types.ts`, dotted, `[n]` for an array entry); the filler reads the value
 * from the profile inside the browser. `som` is the AEM Adaptive Forms SOM path the main-world
 * filler hands to `guideBridge.resolveNode`; `css` is the DOM fallback.
 *
 * Repeating groups (directors, subscribers): a field with `each: 'directors'` is a template. Its
 * key reads `directors[{i}].firstName`, and `{i}` (0-based) or `{n}` (1-based) in its SOM path,
 * selector and label are replaced once per entry of that profile array, inside the browser. The
 * template carries no count: the profile decides how many blocks are filled.
 */

/** The transforms the filler knows. Each maps one profile value to the portal's wording. */
export const RECIPE_TRANSFORMS = [
  'none',
  /** `DD/MM/YYYY` (the profile's date shape) to the portal's date. */
  'toMcaDate',
  /** A number to a rupee amount with no decimals. */
  'rupeeAmount',
  /** A Suite word to the MCA list word (`src/lib/assist-profile/vocabulary.ts`). */
  'vocabulary',
  /** A NIC-2008 code to its two-digit main division. */
  'nicDivision',
  /** A boolean to the portal's Yes / No. */
  'yesNo',
  'upper',
] as const;
export type RecipeTransform = (typeof RECIPE_TRANSFORMS)[number];

/**
 * Human-only gates: the run stops and the panel shows a "You do this" card. The same list as a
 * portal pack's gates (`pack.ts`); CAPTCHA, OTP and EVC are always the person's too.
 */
export const RECIPE_GATES = ['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT', 'PAY', 'EVC'] as const;
export type RecipeGate = (typeof RECIPE_GATES)[number];

const SEMVER = /^\d+\.\d+\.\d+$/;
const KEY = /^[a-z][a-zA-Z0-9]*(\[(\d+|\{i\})\])?(\.[a-zA-Z][a-zA-Z0-9]*(\[(\d+|\{i\})\])?)*$/;
/** A profile array for `each`, for example `directors` or `subscribers`. */
const EACH = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)*$/;
/** The instance placeholders of a repeating field. */
const PLACEHOLDER = /\{[in]\}/;
const ID = /^[a-z0-9][a-z0-9-]*$/;

/** How to find one element: a SOM path, a CSS selector, or the visible text of a button. */
const matchSchema = z
  .object({
    som: z.string().min(1).optional(),
    css: z.string().min(1).optional(),
    text: z.string().min(1).optional(),
  })
  .strict()
  .refine((m) => Boolean(m.som || m.css || m.text), { message: 'match_needs_som_css_or_text' });

const pageSchema = z
  .object({
    id: z.string().regex(ID),
    /** The portal pack page this page is (`recipe.pack`); Suite fills the rest from the pack. */
    packPage: z.string().regex(ID).optional(),
    title: z.string().min(1).optional(),
    /**
     * A glob on the path after the host, for example `/content/mca/.../spice.html`: `*` is any
     * run of characters, `?` one character, everything else literal. The extension refuses to fill
     * a page whose path does not match. Taken from the pack page when the recipe names one.
     */
    urlPattern: z.string().min(1).optional(),
    /** The same glob for the local mock portal; used instead of `urlPattern` on a mock host. */
    mockUrlPattern: z.string().min(1).optional(),
    /** The page is ready when this element exists (and, for a CSS match, is visible). */
    ready: matchSchema.optional(),
    /**
     * A step only the person takes before this page can be filled (open a wizard section or an
     * Add/Edit sub-panel). The extension shows it and waits for `ready`; it never clicks it.
     */
    step: z.string().min(1).optional(),
    /** Information pop-ups the agent may close before it fills (still guarded at the click). */
    closePopups: z.array(matchSchema).max(10).optional(),
  })
  .strict()
  .refine((p) => Boolean(p.packPage) || Boolean(p.title && p.urlPattern && p.ready), { message: 'page_needs_pack_page_or_url_and_ready' });

const fieldSchema = z
  .object({
    key: z.string().regex(KEY, { message: 'field_key_shape' }),
    /**
     * Tells two fields with the same profile key apart, for example a subscriber-director's DIN in
     * Part B block 6b and again in block 7a. The field's identity is `key@slot`.
     */
    slot: z.string().regex(ID).optional(),
    page: z.string().regex(ID).optional(),
    /** AEM SOM path for guideBridge. Optional: live MCA SOM paths are not captured yet. */
    som: z.string().min(1).optional(),
    /**
     * CSS of the field's box or control, for example `.guideFieldNode.proposedname1` (the MCA
     * semantic class). A box is searched for its control (select, textarea or input).
     */
    css: z.string().min(1).optional(),
    /**
     * Which match of `css` on the page, 0-based (default 0). With `each`, every expanded entry takes
     * the next match of the same selector, in recipe order, so subscriber-directors and directors
     * share one director block list.
     */
    nth: z.number().int().min(0).max(50).optional(),
    /** The captured AEM field node id (or the control's id): the second T0 tier. */
    nodeId: z.string().regex(/^[A-Za-z][\w-]*$/).max(200).optional(),
    label: z.string().min(1),
    transform: z.enum(RECIPE_TRANSFORMS).optional(),
    required: z.boolean(),
    /**
     * The profile cannot supply this field, so the panel asks the user to answer it on the portal.
     * The agent highlights it and never types into it.
     */
    askUser: z.boolean().optional(),
    note: z.string().optional(),
    /** The profile array this template repeats over (see the file comment). */
    each: z.string().regex(EACH).optional(),
    /**
     * With `each`: only the entries whose values pass are expanded. `true` = present and not
     * empty, `false` = absent or empty, a string = equal to it. For example Part B's subscribers
     * with a DIN (block 6b) and without one (6c).
     */
    where: z.record(z.string().regex(EACH), z.union([z.boolean(), z.string().min(1)])).optional(),
    /** A dependent dropdown: poll up to the recipe's `waits.optionsMs` for the option to appear. */
    waitForOptions: z.boolean().optional(),
    /** The portal looks other fields up after this one (a PIN code): wait `waits.afterPincodeMs`. */
    lookup: z.boolean().optional(),
    /**
     * The no-placeholder rule (SAFETY.md G16, after ICAI DC/1891/2024). When true, a missing,
     * blank or placeholder-looking value (`9999999999`, `NA`, `test`, the firm's own phone or email)
     * leaves the field empty, highlighted "You fill this from the client's records", and recorded
     * on the run. Defaults to `required` (see `fieldRejectsPlaceholder`). The extension never types
     * a placeholder-looking value into any field whatever this says: a guard is not a setting.
     */
    noPlaceholder: z.boolean().optional(),
  })
  .strict();

const actionSchema = z
  .object({
    id: z.string().regex(ID),
    label: z.string().min(1),
    /** `safe` the agent may click (Save draft, Check form); `human` it only highlights. */
    kind: z.enum(['safe', 'human']),
    match: matchSchema,
  })
  .strict();

const expectSchema = z
  .object({
    id: z.string().regex(ID),
    /** `srn`: the pattern's first match is the SRN to write back. `text`: a success message. */
    kind: z.enum(['srn', 'text']),
    pattern: z.string().min(1),
  })
  .strict()
  .refine(
    (e) => {
      try {
        new RegExp(e.pattern);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'expect_pattern_invalid' },
  );

export const recipeSchema = z
  .object({
    id: z.string().regex(ID),
    version: z.string().regex(SEMVER, { message: 'version_semver' }),
    title: z.string().min(1),
    /** The catalog sub-agent this recipe drives. */
    subAgent: z.string().regex(ID),
    /** Which portal build the SOM paths were checked against. `mock` until a supervised live run. */
    verifiedAgainst: z.enum(['mock', 'capture', 'live']),
    /** For `capture`: which capture or commit the keys were checked against. */
    capturedFrom: z.string().min(1).optional(),
    /** The portal pack this recipe runs on (`packs/<id>.json`). */
    pack: z.string().regex(ID).optional(),
    /** Waits from the pack (Suite fills them when it resolves the pack). */
    waits: z
      .object({ readyMs: z.number().int().min(0).max(60_000), optionsMs: z.number().int().min(0).max(60_000), afterPincodeMs: z.number().int().min(0).max(60_000) })
      .strict()
      .optional(),
    pages: z.array(pageSchema).min(1),
    fields: z.array(fieldSchema).min(1),
    actions: z.array(actionSchema),
    gates: z.array(z.enum(RECIPE_GATES)),
    expect: z.array(expectSchema),
  })
  .strict()
  .superRefine((recipe, ctx) => {
    const pageIds = new Set(recipe.pages.map((p) => p.id));
    recipe.pages.forEach((p, i) => {
      if (p.packPage && !recipe.pack) ctx.addIssue({ code: 'custom', path: ['pages', i, 'packPage'], message: 'pack_page_without_pack' });
    });
    const keys = new Set<string>();
    recipe.fields.forEach((field, i) => {
      const identity = fieldIdentity(field);
      if (keys.has(identity)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: 'field_key_duplicate' });
      keys.add(identity);
      if (field.page && !pageIds.has(field.page)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'page'], message: 'field_page_unknown' });
      if (!field.som && !field.css && !field.nodeId) ctx.addIssue({ code: 'custom', path: ['fields', i], message: 'field_needs_som_css_or_node_id' });
      if (field.each) {
        if (!field.key.startsWith(`${field.each}[{i}].`)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'key'], message: 'each_key_shape' });
        // A SOM path or a CSS selector without `nth` must name the instance itself.
        if (field.som && !PLACEHOLDER.test(field.som)) ctx.addIssue({ code: 'custom', path: ['fields', i, 'som'], message: 'each_som_needs_placeholder' });
        if (!field.som && field.css && field.nth === undefined && !PLACEHOLDER.test(field.css)) {
          ctx.addIssue({ code: 'custom', path: ['fields', i, 'css'], message: 'each_css_needs_placeholder_or_nth' });
        }
      } else {
        if ([field.key, field.som ?? '', field.css ?? '', field.label].some((t) => PLACEHOLDER.test(t) || t.includes('[{i}]'))) {
          ctx.addIssue({ code: 'custom', path: ['fields', i, 'each'], message: 'placeholder_without_each' });
        }
        if (field.where) ctx.addIssue({ code: 'custom', path: ['fields', i, 'where'], message: 'where_without_each' });
      }
    });
    // Submit and Pay are never the agent's to click (PLAN §4): such an action must be `human`.
    recipe.actions.forEach((action, i) => {
      const words = `${action.id} ${action.label} ${action.match.text ?? ''}`;
      if (action.kind === 'safe' && /submit|pay|final|sign|otp|login|confirm|delete|remove|e-?verify|evc/i.test(words)) {
        ctx.addIssue({ code: 'custom', path: ['actions', i, 'kind'], message: 'action_must_be_human' });
      }
    });
  });

export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeField = Recipe['fields'][number];

/** True when the field follows the no-placeholder rule: as declared, else when it is mandatory. */
export function fieldRejectsPlaceholder(field: Pick<RecipeField, 'required' | 'noPlaceholder'>): boolean {
  return field.noPlaceholder ?? field.required;
}

/** A field's identity in a run: its profile key, plus `@slot` when it has one. */
export function fieldIdentity(field: Pick<RecipeField, 'key' | 'slot'>): string {
  return field.slot ? `${field.key}@${field.slot}` : field.key;
}

/**
 * The recipe field a concrete key belongs to: an exact key, or a repeating template whose `[{i}]`
 * matches an index (`directors[1].firstName` finds `directors[{i}].firstName`).
 */
export function findRecipeField(recipe: Recipe, identity: string): RecipeField | null {
  const at = identity.lastIndexOf('@');
  const key = at > 0 ? identity.slice(0, at) : identity;
  const slot = at > 0 ? identity.slice(at + 1) : undefined;
  const fields = recipe.fields.filter((f) => f.slot === slot);
  const exact = fields.find((f) => f.key === key);
  if (exact) return exact;
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return fields.find((f) => f.each && new RegExp(`^${f.key.split('[{i}]').map(escape).join('\\[\\d+\\]')}$`).test(key)) ?? null;
}

/** Parses a recipe and throws a readable error naming the first problem. */
export function parseRecipe(raw: unknown): Recipe {
  const parsed = recipeSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`invalid_recipe: ${issue?.path.join('.') ?? ''} ${issue?.message ?? ''}`.trim());
  }
  return parsed.data;
}

/**
 * The canonical JSON of a value: object keys sorted at every depth, no whitespace. The signature
 * is over this string, so the extension can re-create it from the recipe it received.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/**
 * A recipe with its pack applied: every page that names a `packPage` takes that page's title, URL
 * patterns, ready check and human step from the pack (unless the recipe sets its own), the pack's
 * information pop-ups, and the pack's waits. Suite signs and serves this resolved recipe, so the
 * extension never needs the pack itself. Throws on an unknown pack or pack page.
 */
export function resolveRecipe(recipe: Recipe, packs: ReadonlyMap<string, PortalPack>): Recipe {
  if (!recipe.pack) return recipe;
  const pack = packs.get(recipe.pack);
  if (!pack) throw new Error(`invalid_recipe: ${recipe.id} names unknown pack ${recipe.pack}`);
  const popups = pack.popups.map((p) => ({ css: p.css }));
  const pages = recipe.pages.map((page) => {
    if (!page.packPage) return page;
    const pp = pack.pages.find((x) => x.id === page.packPage);
    if (!pp) throw new Error(`invalid_recipe: ${recipe.id} page ${page.id} names unknown pack page ${page.packPage}`);
    return {
      ...page,
      title: page.title ?? pp.title,
      urlPattern: page.urlPattern ?? pp.urlPattern,
      mockUrlPattern: page.mockUrlPattern ?? pp.mockUrlPattern,
      ready: page.ready ?? { css: pp.readySelector },
      step: page.step ?? pp.step,
      closePopups: page.closePopups ?? (popups.length ? popups : undefined),
    };
  });
  return parseRecipe({ ...recipe, waits: recipe.waits ?? pack.waits, pages });
}
