import type { Engagement } from '@/data/engagements';
import { checklist } from '@/data/checklist';
import { APP_ID_TO_DB_ID, LEGACY_ENGAGEMENT_IDS } from '@/lib/legacy-engagement-ids';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Lowercase hyphenated slug from a company or display name. */
export function slugifyCompanyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'project';
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

const RESERVED_ENGAGEMENT_ROUTE_PARAMS = new Set(['new']);

/** True when a URL segment can identify an engagement (not create/reserved routes). */
export function isEngagementRouteParam(param: string): boolean {
  const value = param.trim();
  if (!value || RESERVED_ENGAGEMENT_ROUTE_PARAMS.has(value)) return false;
  if (isUuid(value)) return true;
  if (/^e\d+$/.test(value)) return true;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function stepSlugForItemId(itemId: string): string {
  return checklist.find((item) => item.id === itemId)?.slug ?? itemId;
}

function normalizeRouteToken(value: string): string {
  try {
    return decodeURIComponent(value).trim().toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

const STEP_ALIASES: Record<string, string> = {
  'pre-6': 'director-kyc-details',
  'director-kyc-detail': 'director-kyc-details',
  'director-kyc': 'director-kyc-details',
};

export function resolveChecklistItemFromStepParam(stepParam: string) {
  const normalized = normalizeRouteToken(stepParam);
  const canonical = STEP_ALIASES[normalized] ?? normalized;
  return (
    checklist.find((item) => item.slug === canonical) ??
    checklist.find((item) => item.id === canonical)
  );
}

/** Read engagement id/slug from App Router params (`[id]` or `[slug]` segments). */
export function engagementRouteParamFromParams(
  params: Record<string, string | string[] | undefined>,
): string {
  const raw = params.slug ?? params.id;
  if (Array.isArray(raw)) return raw[0]?.trim() ?? '';
  return typeof raw === 'string' ? raw.trim() : '';
}

export function resolveEngagementFromRouteParam(
  engagements: Engagement[],
  param: string,
): Engagement | undefined {
  const value = normalizeRouteToken(param);
  if (!value) return undefined;

  const bySlug = engagements.find((eng) => eng.slug?.toLowerCase() === value);
  if (bySlug) return bySlug;

  const byAppId = engagements.find((eng) => eng.id.toLowerCase() === value);
  if (byAppId) return byAppId;

  const byDbId = engagements.find((eng) => APP_ID_TO_DB_ID[eng.id]?.toLowerCase() === value);
  if (byDbId) return byDbId;

  const legacyAppId = LEGACY_ENGAGEMENT_IDS[value];
  if (legacyAppId) {
    return engagements.find((eng) => eng.id === legacyAppId);
  }

  // Fallback: support company-name slug lookup for rows missing `slug`.
  const byDerivedSlug = engagements.find((eng) => slugifyCompanyName(eng.companyName) === value);
  if (byDerivedSlug) return byDerivedSlug;

  return undefined;
}
