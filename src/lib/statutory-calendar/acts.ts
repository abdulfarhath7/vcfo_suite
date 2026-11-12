import type { StatutoryAct, StatutoryDeadline } from '@/data/statutory-calendar-fy2627';

/**
 * The Act column of the import template. The labels are spelled as the printed SBC calendar
 * spells them; each maps to one of the app's act categories, which carry the calendar colours and
 * the applicability rules. APRERA and TGRERA share the RERA category, so the row keeps its own
 * label (`actLabel`) to show which authority it is.
 */
export const ACT_OPTIONS: readonly { label: string; act: StatutoryAct }[] = [
  { label: 'GST', act: 'GST' },
  { label: 'IT', act: 'IT' },
  { label: 'MCA', act: 'MCA' },
  { label: 'FEMA', act: 'FEMA' },
  { label: 'STPI/SEZ', act: 'STPI/SEZ' },
  { label: 'LABOUR', act: 'LABOUR' },
  { label: 'APRERA', act: 'RERA' },
  { label: 'TGRERA', act: 'RERA' },
  { label: 'TRANSFER PRICING', act: 'TP' },
];

/** Other spellings people type, mapped to a label above. */
const ALIASES: Record<string, string> = {
  'INCOME TAX': 'IT',
  LABOR: 'LABOUR',
  'STPI / SEZ': 'STPI/SEZ',
  'STPI-SEZ': 'STPI/SEZ',
  'STPI SEZ': 'STPI/SEZ',
  'AP RERA': 'APRERA',
  'TG RERA': 'TGRERA',
  TP: 'TRANSFER PRICING',
};

export const APPLIES_TO_OPTIONS = ['All', 'Company', 'LLP'] as const;

function normalise(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** The category and label for a typed Act value, or null when it is not one of the list. */
export function resolveAct(raw: string): { act: StatutoryAct; actLabel?: string } | null {
  const key = normalise(raw);
  const label = ALIASES[key] ?? key;
  const option = ACT_OPTIONS.find((o) => o.label === label);
  if (!option) return null;
  return option.act === 'RERA' ? { act: option.act, actLabel: option.label } : { act: option.act };
}

/** The scope for an Applies To value: undefined for All or blank, null when it is not valid. */
export function resolveAppliesTo(raw: string): StatutoryDeadline['scope'] | null {
  const key = normalise(raw);
  if (key === '' || key === 'ALL') return undefined;
  if (key === 'COMPANY' || key === 'COMPANIES') return 'co';
  if (key === 'LLP' || key === 'LLPS') return 'llp';
  return null;
}

/** The Act value to write back into the template for an existing deadline. */
export function templateActLabel(deadline: Pick<StatutoryDeadline, 'act' | 'actLabel' | 'title'>): string {
  if (deadline.act === 'RERA') {
    if (deadline.actLabel) return deadline.actLabel;
    return /^\s*TG\b/i.test(deadline.title) ? 'TGRERA' : 'APRERA';
  }
  return ACT_OPTIONS.find((o) => o.act === deadline.act)?.label ?? deadline.act;
}

export function templateAppliesTo(scope: StatutoryDeadline['scope']): string {
  if (scope === 'co') return 'Company';
  if (scope === 'llp') return 'LLP';
  return 'All';
}

/** The short tag a calendar row shows: the RERA authority where known, else the category label. */
export function deadlineTagLabel(deadline: Pick<StatutoryDeadline, 'act' | 'actLabel'>, categoryLabel: string): string {
  return deadline.act === 'RERA' && deadline.actLabel ? deadline.actLabel : categoryLabel;
}

/**
 * The filing area a statutory deadline belongs to, in the words the filings register uses
 * (`compliance_obligations.compliance_area`), so one area filter narrows the calendar's filings and
 * the SBC calendar's deadlines together. Acts the register has no area for keep their own name.
 */
export function statutoryArea(deadline: Pick<StatutoryDeadline, 'act' | 'scope'>): string {
  switch (deadline.act) {
    case 'GST':
      return 'GST';
    case 'IT':
      return 'Income Tax';
    case 'MCA':
      return deadline.scope === 'llp' ? 'LLP Act' : 'Companies Act, 2013';
    case 'FEMA':
      return 'FEMA / RBI';
    case 'LABOUR':
      return 'Labour Laws';
    case 'TP':
      return 'Transfer Pricing';
    default:
      return deadline.act;
  }
}
