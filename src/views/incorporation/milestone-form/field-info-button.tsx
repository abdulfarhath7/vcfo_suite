'use client';

import { HelpIcon } from '@/components/ui/help-icon';

/**
 * The (i) beside a form label that opens the field's help text (GL-04; owner, 10 Nov: what
 * "Authorised capital" means should be one click away). Every field with `helperText` gets it,
 * for the client and for staff. It is the shared `HelpIcon`.
 */
export function FieldInfoButton({ label, text }: { label: string; text: string }) {
  return <HelpIcon text={text} title={label.replace(/\s*\(.*$/, '')} />;
}
