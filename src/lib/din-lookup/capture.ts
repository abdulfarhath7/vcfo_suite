import { z } from 'zod';

/**
 * The shape the VCFO Assist extension posts after it reads an MCA director page inside the
 * person's own logged-in session. It is deliberately the same spelling as the FalconeBiz
 * answer, so one normaliser (`normalizeDinResponse`) serves both sources.
 *
 * The extension sends only what the portal page shows. It never sends a password, an OTP, a
 * captcha answer or a session cookie, and this schema would refuse them: unknown keys are
 * stripped by `.strip()`, which is zod's default, so nothing else reaches the database.
 */
/**
 * One row of the report's "List of Associated Companies" or "List of Associated LLPs" table.
 * The columns are the portal's own: CIN/FCRN or LLPIN, name, status, designation, category of
 * appointment, original date of appointment, date of appointment at the current designation,
 * and date of cessation where there is one. The API fills only some of them; a dash in a cell
 * is read as empty.
 */
export const capturedAssociationSchema = z.object({
  cin: z.string().trim().max(40).optional(),
  /** The LLP table heads its columns LLPIN and "LLP name"; either spelling is taken. */
  llpin: z.string().trim().max(40).optional(),
  com_name: z.string().trim().max(300).optional(),
  llp_name: z.string().trim().max(300).optional(),
  llp_status: z.string().trim().max(80).optional(),
  designation: z.string().trim().max(120).optional(),
  appointment: z.string().trim().max(40).optional(),
  entity_type: z.string().trim().max(20).optional(),
  company_status: z.string().trim().max(80).optional(),
  appointment_category: z.string().trim().max(80).optional(),
  current_designation_date: z.string().trim().max(40).optional(),
  cessation: z.string().trim().max(40).optional(),
});

export const capturedDirectorSchema = z.object({
  din: z.string().trim().max(20),
  name: z.string().trim().max(200).optional(),
  din_status: z.string().trim().max(80).optional(),
  approve_date: z.string().trim().max(40).optional(),
  dir3_kyc: z.string().trim().max(40).optional(),
  updated_at: z.string().trim().max(40).optional(),
  association: z.array(capturedAssociationSchema).max(500).optional(),
});

export type CapturedDirector = z.infer<typeof capturedDirectorSchema>;
