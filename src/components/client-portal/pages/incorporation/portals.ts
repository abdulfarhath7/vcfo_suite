/**
 * Rule 15 — the official portal (↗) for a step, from its forms / title.
 * URLs reuse the announcement portal table (src/lib/notifications/announcement-portals.ts).
 */
import { EPFO, ESIC, FIRMS, FLAIR, GST_LOGIN, IT_FO, MCA_FO, STPI, TGCT } from '@/lib/notifications/announcement-portals';
import type { ChecklistItem } from '@/data/checklist';

export interface PortalLink {
  /** "SPICe+ Part B" — what the tooltip names. */
  form: string;
  url: string;
}

const RULES: Array<[RegExp, string]> = [
  [/\bfla\b/i, FLAIR],
  [/fc-?gpr|fc-?trs|\bfdi\b|\bodi\b|fema|firms/i, FIRMS],
  [/\bgst\b|\blut\b/i, GST_LOGIN],
  [/\bepf|\bpf\b|provident/i, EPFO],
  [/\besi/i, ESIC],
  [/\btan\b|\bpan\b|income.?tax|tds/i, IT_FO],
  [/icegate/i, 'https://www.icegate.gov.in/'],
  [/\biec\b|dgft/i, 'https://www.dgft.gov.in/CP/?opt=iec-profile-management'],
  [/stpi/i, STPI],
  [/trade ?mark|patent/i, 'https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx'],
  [/udyam|msme/i, 'https://udyamregistration.gov.in/'],
  [/\blei\b/i, 'https://www.ccilindia-lei.co.in/'],
  [/professional tax|\bpt\b/i, TGCT],
  [/spice|\brun\b|inc-|dir-|agile|mgt-|adt-|sh-|pas-|moa|aoa|mca|certificate of incorporation|name/i, MCA_FO],
];

export function portalFor(item: ChecklistItem): PortalLink | null {
  const form = item.forms?.[0];
  const hay = `${(item.forms ?? []).join(' ')} ${item.title}`;
  for (const [re, url] of RULES) if (re.test(hay)) return { form: form || item.title, url };
  return null;
}
