/**
 * RECEIVABLES EMAIL TEMPLATES (owner, 19 Nov 2026) — the words of every receivables email, which a
 * sheet's staff can see and change in the Templates tab. Each email type keeps four parts: the
 * subject, the greeting, the opening text above the table and the closing text under it. The
 * tables are always built from the sheet; they are not part of a template. An empty part means
 * the standard words. Pure, so the server builders and the pop-ups' previews share it.
 *
 * Placeholders, filled when the email is built: {name} (the recipient's first name), {client},
 * {period} and {ontime} (the Collections report's period and its share received on time),
 * {count}, {total} (₹ open or received), {overdue} (₹ past due), {date} (today) and {sheet} (the
 * client organisation). A placeholder an email type does not have is left as typed.
 */

export const TEMPLATE_KINDS = ['summary', 'collections', 'new_invoice', 'revised', 'rollup', 'digest', 'statement', 'payment_received'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export type TemplateText = { subject: string; greeting: string; intro: string; closing: string };
/** The saved parts of one email type; a missing or empty part uses the standard words. */
export type TemplateOverride = Partial<TemplateText>;
export type TemplateSet = Partial<Record<TemplateKind, TemplateOverride>>;

export type TemplateMeta = {
  label: string;
  /** When the email goes out, in one line. */
  when: string;
  /** The placeholders this email type fills. */
  placeholders: string[];
  /** The standard words, shown in the editor when a part is empty. */
  standard: TemplateText;
};

export const TEMPLATE_META: Record<TemplateKind, TemplateMeta> = {
  summary: {
    label: 'Receivables update',
    when: 'Send email on the Sheet tab, to leaders only',
    placeholders: ['{name}', '{date}', '{total}', '{sheet}'],
    standard: { subject: 'Receivables update - {date}', greeting: 'Hi {name},', intro: 'Please find the receivables summary as of today:', closing: '' },
  },
  collections: {
    label: 'Collections report',
    when: 'Send email on the Collections tab, to partners and leaders',
    placeholders: ['{name}', '{period}', '{ontime}', '{date}', '{sheet}'],
    standard: {
      subject: 'Collections · {period} · {ontime} on time',
      greeting: 'Hi {name},',
      intro: 'Please find the collections for {period}: the invoices received on time against those received late.',
      closing: '',
    },
  },
  new_invoice: {
    label: 'New invoice',
    when: 'After an approval, to the client partner',
    placeholders: ['{name}', '{client}', '{count}', '{total}', '{date}'],
    standard: { subject: 'New invoice · {client}', greeting: 'Hi {name},', intro: 'A new invoice has been raised for your client:', closing: '' },
  },
  revised: {
    label: 'Invoice revised',
    when: 'After an amount change is approved, to the client partner',
    placeholders: ['{name}', '{client}', '{total}', '{date}'],
    standard: { subject: 'Invoice revised · {client}', greeting: 'Hi {name},', intro: 'The amount of an invoice for {client} has been revised.', closing: '' },
  },
  rollup: {
    label: 'Open invoices roll-up',
    when: 'On the roll-up weekdays, to each client partner',
    placeholders: ['{name}', '{count}', '{total}', '{overdue}', '{date}', '{sheet}'],
    standard: { subject: 'Open invoices for your clients · ₹{total} · {date}', greeting: 'Hi {name},', intro: 'Here are the open invoices for your clients as of {date}: ₹{total} in all.', closing: '' },
  },
  digest: {
    label: 'Leadership digest',
    when: 'On the digest schedule, one email to every leader',
    placeholders: ['{count}', '{total}', '{overdue}', '{date}', '{sheet}'],
    standard: { subject: '{sheet} receivables · ₹{total} open · {date}', greeting: 'Hello,', intro: 'The {sheet} receivables as of {date}: ₹{total} open across {count} invoices.', closing: '' },
  },
  statement: {
    label: 'Client statement',
    when: 'Statement on the People tab, to a client',
    placeholders: ['{client}', '{count}', '{total}', '{date}'],
    standard: {
      subject: 'Statement of open invoices · {client} · {date}',
      greeting: 'Dear Sir or Madam,',
      intro: 'Please find below the open invoices of {client} as of {date}, ₹{total} in all. We would be grateful for payment of the amounts due.',
      closing: '',
    },
  },
  payment_received: {
    label: 'Payment received',
    when: 'After Mark received, when you click Send',
    placeholders: ['{name}', '{client}', '{count}', '{total}', '{date}'],
    standard: { subject: 'Payment received · {client} · ₹{total}', greeting: 'Hi {name},', intro: 'We have received the payment for {client}:', closing: 'Thank you.' },
  },
};

export const isTemplateKind = (v: unknown): v is TemplateKind => typeof v === 'string' && (TEMPLATE_KINDS as readonly string[]).includes(v);

const LIMITS: Record<keyof TemplateText, number> = { subject: 200, greeting: 120, intro: 2000, closing: 2000 };

/** A saved part, trimmed and cut to its limit; empty means the standard words. */
export function cleanTemplate(input: unknown): TemplateOverride {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const out: TemplateOverride = {};
  for (const k of Object.keys(LIMITS) as Array<keyof TemplateText>) {
    const v = typeof o[k] === 'string' ? (o[k] as string).replace(/\r\n/g, '\n').trim().slice(0, LIMITS[k]) : '';
    if (v) out[k] = k === 'subject' || k === 'greeting' ? v.replace(/\s+/g, ' ') : v;
  }
  return out;
}

/** Fills the placeholders; one this email does not have stays as typed. */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? vars[key]! : m));
}

/** The saved part, filled, or null when the email keeps its standard words. */
export function partOf(o: TemplateOverride | undefined, part: keyof TemplateText, vars: Record<string, string>): string | null {
  const v = o?.[part]?.trim();
  return v ? fillTemplate(v, vars) : null;
}

/** The parts the person changed, for the "Custom" tag. */
export function changedParts(o: TemplateOverride | undefined): Array<keyof TemplateText> {
  return (Object.keys(LIMITS) as Array<keyof TemplateText>).filter((k) => Boolean(o?.[k]?.trim()));
}
