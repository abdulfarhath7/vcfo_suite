// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { dropContentType, dropFileRefusal } from './extensions';

describe('dropFileRefusal', () => {
  it('takes emails, refuses old Office files with a way out, and names what it reads', () => {
    expect(dropFileRefusal('Bonterra MOA.eml')).toBeNull();
    expect(dropFileRefusal('Board resolution.msg')).toBeNull();
    expect(dropFileRefusal('board.doc')).toMatch(/save it as \.docx/);
    expect(dropFileRefusal('payroll.xls')).toMatch(/save it as \.xlsx/);
    expect(dropFileRefusal('plan.dwg')).toMatch(/email/);
    expect(dropContentType('a.eml')).toBe('message/rfc822');
  });
});
