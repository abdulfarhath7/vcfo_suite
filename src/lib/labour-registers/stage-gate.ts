import { formatFilingDate } from '@/lib/compliance/filings';

/**
 * LABOUR REGISTERS STAGE GATE — whether a register batch may be opened for a company and a
 * period. A company has no statutory life before its Certificate of Incorporation, so it keeps
 * no labour registers before then, and no register covers a month that ended before it was
 * incorporated.
 *
 * Periods are whole months on the picker, so the month of incorporation is allowed: a company
 * incorporated on 10 June keeps a June register for the days from 10 June. A period that starts
 * before the first day of that month is refused.
 *
 * Pure: the repository refuses with it, and the page uses the same words to disable the button.
 */

export class LabourBatchRefused extends Error {
  constructor(
    message: string,
    readonly status: 409 | 422,
    readonly code: 'not_incorporated' | 'before_incorporation',
  ) {
    super(message);
    this.name = 'LabourBatchRefused';
  }
}

export const NOT_INCORPORATED_MESSAGE =
  'Labour registers start after the Certificate of Incorporation. This company is not incorporated yet.';

/** The refusal for opening a batch, or null when it may be opened. */
export function labourBatchRefusal(
  company: { incorporated: boolean; incorporationDate?: string | null },
  periodFrom: string,
): LabourBatchRefused | null {
  if (!company.incorporated) return new LabourBatchRefused(NOT_INCORPORATED_MESSAGE, 409, 'not_incorporated');
  const date = company.incorporationDate?.trim().slice(0, 10);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && periodFrom.slice(0, 10) < `${date.slice(0, 7)}-01`) {
    return new LabourBatchRefused(
      `This period starts before the company was incorporated on ${formatFilingDate(date)}. Pick the month of incorporation or a later one.`,
      422,
      'before_incorporation',
    );
  }
  return null;
}
