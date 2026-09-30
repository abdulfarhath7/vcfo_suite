import { describe, expect, it } from 'vitest';
import { FIELD_HELP, FIELD_HELP_MAX_CHARS, fieldHelp } from '@/data/ask/field-help';
import { CLIENT_RESPONSE_FIELDS } from '@/lib/checklist-responses';

describe('C3 field help', () => {
  it('every line is at most 140 characters', () => {
    for (const [key, entry] of Object.entries(FIELD_HELP)) {
      expect(entry.text.length, key).toBeLessThanOrEqual(FIELD_HELP_MAX_CHARS);
    }
  });

  it('every key names a real client form field', () => {
    for (const key of Object.keys(FIELD_HELP)) {
      const [stepId, fieldId] = key.split(':') as [string, string];
      const ids = new Set<string>();
      const walk = (fields: Array<{ id: string; entryFields?: Array<{ id: string }> }>) =>
        fields.forEach((f) => {
          ids.add(f.id);
          if (f.entryFields) walk(f.entryFields);
        });
      walk(CLIENT_RESPONSE_FIELDS[stepId] ?? []);
      expect(ids.has(fieldId), key).toBe(true);
    }
  });

  it('shows reviewed lines only', () => {
    const entries = {
      'pre-15:din': { text: 'Reviewed line.', reviewed: true },
      'pre-15:hasDsc': { text: 'Draft line.', reviewed: false },
    };
    expect(fieldHelp('pre-15', 'din', entries)).toBe('Reviewed line.');
    expect(fieldHelp('pre-15', 'hasDsc', entries)).toBeNull();
    expect(fieldHelp('pre-15', 'unknown', entries)).toBeNull();
    // Repeat entries render with a prefixed id; the entry field id still matches.
    expect(fieldHelp('pre-15', 'directors.0.din', entries)).toBe('Reviewed line.');
  });

  it('ships every line as a draft until the firm reviews it', () => {
    expect(Object.values(FIELD_HELP).every((e) => e.reviewed === false)).toBe(true);
  });
});
