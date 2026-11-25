/**
 * One place a value can go. The sources stay where they are (`CLIENT_RESPONSE_FIELDS`, the compliance
 * inputs and questionnaire, the registration rules); `npm run ask:catalog` writes this list from
 * them, and a test fails when the written list no longer matches.
 */
export const FIELD_FORMATS = [
  'pan',
  'din',
  'cin',
  'gstin',
  'ifsc',
  'pin',
  'tan',
  'llpin',
  'aadhaar',
  'passport',
  'date',
  'email',
  'mobile',
  'amount',
  'choice',
  'file',
  'text',
  'longtext',
] as const;
export type FieldFormat = (typeof FIELD_FORMATS)[number];

/** `identity` values are masked in chat, logs and stored prompts. */
export type FieldSensitivity = 'identity' | 'normal';

/** Whose fact it is. A person or a subscriber has one entry per person on a repeating list. */
export type FieldSubject = 'director' | 'subscriber' | 'company' | 'office' | 'parent' | 'signatory' | 'general';

export interface FieldUse {
  source: 'checklist' | 'compliance' | 'questionnaire' | 'registration';
  /** Step id, obligation id, or question group. */
  ref: string;
  /** Field id, with `#` for a numbered slot (`director#FirstName`) and relative to the entry on a repeat. */
  field: string;
  /** The repeating list the field sits in. */
  repeat?: string;
}

export interface CatalogEntry {
  /** Canonical key such as `director.pan`, or `<step>.<field>` for a fact only one step holds. */
  key: string;
  label: string;
  synonyms: string[];
  format: FieldFormat;
  sensitivity: FieldSensitivity;
  subject: FieldSubject;
  options?: Array<{ value: string; label: string }>;
  /** Other keys this one fills: a whole name fills first, middle and last name. */
  expands?: string[];
  /**
   * The document types this fact is printed in (`board_resolution`, `moa`, `incorporation_certificate`
   * …). Once a file is known to be one of these, the reader asks the model for exactly these facts
   * (`readTargeted`), so a fact written as prose, such as the business description in a board
   * resolution, still reaches its field.
   */
  foundIn?: string[];
  /** What the reader asks for, in words, for a targeted read. A long field says its summary limit here. */
  extract?: string;
  /** A fact with no field of its own fills this entry instead: the main objects fill the business description. */
  fills?: string;
  /**
   * A strict fact is taken from a file only when the file is one of these document types (`form`
   * covers a client details sheet; a workbook counts as one). A date in an NOC is never the date of
   * incorporation. Pasted text is not limited: the person typed the label themselves.
   */
  onlyFrom?: string[];
  /** A pattern (case-insensitive) the value must match, so an address is never taken as "rented" or "owned". */
  valueMatches?: string;
  uses: FieldUse[];
}
