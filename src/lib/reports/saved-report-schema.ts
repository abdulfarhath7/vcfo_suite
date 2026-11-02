import { z } from 'zod';
import { REPORT_FORMATS, REPORT_SCHEDULES } from './partner-report';

/** Request bodies for `app/api/super/reports/**` (G-21). */
const monthParam = z.union([z.literal('latest'), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use a YYYY-MM month')]);

const recipients = z
  .array(z.string().trim().toLowerCase().email('Enter valid email addresses'))
  .max(20, 'Twenty recipients at most')
  .transform((list) => [...new Set(list)]);

export const savedReportCreateSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(120),
    params: z.object({ month: monthParam, format: z.enum(REPORT_FORMATS).optional() }),
    schedule: z.enum(REPORT_SCHEDULES).default('none'),
    recipients: recipients.default([]),
  })
  .refine((v) => v.schedule === 'none' || v.recipients.length > 0, {
    message: 'Add at least one recipient for a schedule',
    path: ['recipients'],
  });

export const savedReportPatchSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter a name').max(120).optional(),
    params: z.object({ month: monthParam, format: z.enum(REPORT_FORMATS).optional() }).optional(),
    schedule: z.enum(REPORT_SCHEDULES).optional(),
    recipients: recipients.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to change')
  .refine((v) => !v.schedule || v.schedule === 'none' || v.recipients === undefined || v.recipients.length > 0, {
    message: 'Add at least one recipient for a schedule',
    path: ['recipients'],
  });

export const pdfQuerySchema = z.object({ month: monthParam.default('latest') });
