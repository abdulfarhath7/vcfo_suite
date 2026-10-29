import type { DirectoryPerson } from '@/lib/email/directory-filter';

/**
 * Template merge fields (prototype EmailScreen `fill`): {client}, {name} and {step} come from
 * the first client contact in To. {client} is that contact's first company, {name} the
 * contact's first name and {step} the company's current checklist step. A field with no real
 * value stays as written, so the sender sees what is left to fill; nothing is invented.
 */
export interface MergeValues {
  client?: string | null;
  name?: string | null;
  step?: string | null;
}

export function fillMergeFields(text: string, values: MergeValues): string {
  let out = text;
  for (const key of ['client', 'name', 'step'] as const) {
    const value = values[key]?.trim();
    if (value) out = out.replaceAll(`{${key}}`, value);
  }
  return out;
}

/** The first word of a name ("Rohan Mehta" reads "Rohan"). */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? '';
}

/**
 * Merge values from the picked recipients: the first client contact, its first company, and
 * that company's current step from `stepOf` (null when the company has no open step).
 */
export function mergeValuesFor(
  picked: DirectoryPerson[],
  stepOf: (engagementId: string) => string | null,
): MergeValues {
  const contact = picked.find((p) => p.kind === 'client');
  if (!contact) return {};
  const project = contact.projects[0];
  return {
    client: project?.companyName ?? null,
    name: firstName(contact.name) || null,
    step: project ? stepOf(project.id) : null,
  };
}
