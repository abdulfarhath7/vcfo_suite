import { z } from 'zod';
import { SUPABASE_MAX_UPLOAD_BYTES } from '@/lib/upload-limits';
import {
  engagementHealthSchema,
  engagementStageSchema,
  internIdSchema,
} from '@/lib/api/engagement-schemas';

/** Normalized work email for auth and welcome flows. */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('invalid_email')
  .max(160);

/** Initial client portal password (edge function enforces the same rules). */
export const DEFAULT_CLIENT_TEMP_PASSWORD = 'SBC@2026';
export const clientPasswordSchema = z
  .string()
  .min(8, 'password_too_short')
  .max(128)
  .default(DEFAULT_CLIENT_TEMP_PASSWORD);

export const companyNameSchema = z.string().trim().min(1, 'company_required').max(120);

/** Full legal name of the parent entity (as on incorporation documents). */
export const parentEntityNameSchema = z
  .string()
  .trim()
  .min(1, 'parent_entity_name_required')
  .max(240);

/** Full registered address of the parent entity. */
export const parentEntityAddressSchema = z
  .string()
  .trim()
  .min(1, 'parent_entity_address_required')
  .max(2000);

/** India subsidiary / GCC entity legal name (Registration / Compliance). */
export const subsidiaryLegalNameSchema = z
  .string()
  .trim()
  .min(1, 'subsidiary_legal_name_required')
  .max(240);

/** India subsidiary registered address (Registration / Compliance). */
export const subsidiaryRegisteredAddressSchema = z
  .string()
  .trim()
  .min(1, 'subsidiary_registered_address_required')
  .max(2000);

/** India-incorporated vs overseas parent / FEMA track. */
export const companyTypeSchema = z.enum(['domestic', 'foreign']);

/** Indian legal form for compliance applicability. */
export const entityLegalFormSchema = z.enum(['company', 'llp', 'partnership', 'proprietorship']);

export const welcomeEmailBodySchema = z.object({
  clientEmail: emailSchema,
  clientName: z.string().trim().min(1).max(120),
  companyName: companyNameSchema,
  stage: z.string().trim().min(1).max(64),
  health: z.string().trim().min(1).max(32),
  createdAt: z.string().trim().min(1).max(64),
  clientPassword: clientPasswordSchema,
  /** When set, merges engagement progress_cc_emails with RESEND_PROGRESS_CC. */
  engagementId: z.string().trim().min(1).max(128).optional(),
});

export const resendWelcomeEmailBodySchema = z.object({
  engagementId: z.string().trim().min(1).max(128),
});

/** Up to 10 extra CC addresses per engagement (merged with RESEND_PROGRESS_CC on send). */
const progressCcEmailsSchema = z
  .array(emailSchema)
  .max(10, 'too_many_cc')
  .transform((emails) => [...new Set(emails.map((e) => e.toLowerCase()))]);

export const progressCcPatchBodySchema = z.object({
  emails: progressCcEmailsSchema,
});

/** Body for `create-client-engagement` edge function (mirrored server-side in Deno). */
const internPasswordSchema = clientPasswordSchema;

export const createInternBodySchema = z.object({
  email: emailSchema,
  password: internPasswordSchema,
  fullName: z.string().trim().min(1, 'name_required').max(120).optional(),
  phone: z.string().trim().max(32).optional(),
});

export const createProjectBodySchema = z
  .object({
    companyName: companyNameSchema,
    companyType: companyTypeSchema,
    entityLegalForm: entityLegalFormSchema.default('company'),
    parentEntityName: parentEntityNameSchema,
    parentEntityAddress: parentEntityAddressSchema,
    clientEmail: emailSchema,
    clientPassword: clientPasswordSchema,
    clientName: z.string().trim().max(120).optional(),
    /** WhatsApp destination in E.164 (+919876543210). Optional — email is the record. */
    clientPhoneE164: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/, 'invalid_phone_e164')
      .optional(),
    /** Explicit, un-ticked-by-default WhatsApp consent. DPDP evidence. */
    clientWhatsappConsent: z.boolean().optional(),
    /** Primary lead (legacy). Prefer internIds. */
    internId: internIdSchema.optional(),
    /** One or more project leads; first becomes primary. */
    internIds: z.array(internIdSchema).max(20).optional(),
    /** Primary manager (legacy). Prefer managerIds. */
    managerId: z.string().uuid().optional(),
    /** One or more project managers; first becomes primary (admins). Managers always include self. */
    managerIds: z.array(z.string().uuid()).max(20).optional(),
    stage: engagementStageSchema.optional(),
    health: engagementHealthSchema.optional(),
    /** Required when stage is Registration or Compliance. */
    subsidiaryLegalName: z.string().trim().max(240).optional(),
    subsidiaryRegisteredAddress: z.string().trim().max(2000).optional(),
    /** Compliance questionnaire answers (question id → yes/no, count, or pick). */
    complianceQuestionnaire: z
      .record(z.string(), z.union([z.boolean(), z.number(), z.string()]))
      .optional(),
  })
  .refine(
    (d) => Boolean(d.internId?.trim()) || (d.internIds?.some((id) => id.trim()) ?? false),
    { message: 'intern_required', path: ['internId'] },
  )
  .superRefine((d, ctx) => {
    const stage = d.stage ?? 'Pre-Incorporation';
    if (stage === 'Pre-Incorporation') return;
    const name = d.subsidiaryLegalName?.trim() ?? '';
    const address = d.subsidiaryRegisteredAddress?.trim() ?? '';
    if (!name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subsidiary_legal_name_required',
        path: ['subsidiaryLegalName'],
      });
    } else if (name.length > 240) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subsidiary_legal_name_too_long',
        path: ['subsidiaryLegalName'],
      });
    }
    if (!address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subsidiary_registered_address_required',
        path: ['subsidiaryRegisteredAddress'],
      });
    } else if (address.length > 2000) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'subsidiary_registered_address_too_long',
        path: ['subsidiaryRegisteredAddress'],
      });
    }
  });

export const knowledgeBankIdParamSchema = z.object({
  id: z.uuid('invalid_id'),
});

export const documentIdParamSchema = z.object({
  id: z.uuid('invalid_id'),
});

const knowledgeBankTitleSchema = z
  .string()
  .trim()
  .min(1, 'title_required')
  .max(200, 'title_too_long');

const knowledgeBankDescriptionSchema = z
  .string()
  .trim()
  .max(2000, 'description_too_long')
  .optional();

/** Register a Knowledge Bank file after direct Storage upload (avoids Vercel body limit). */
export const knowledgeBankRegisterBodySchema = z.object({
  id: z.uuid('invalid_id'),
  title: knowledgeBankTitleSchema,
  description: knowledgeBankDescriptionSchema,
  storagePath: z.string().trim().min(3).max(512),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().max(128),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(SUPABASE_MAX_UPLOAD_BYTES, 'file_too_large'),
  folderId: z.uuid('invalid_folder_id').nullable().optional(),
});

const knowledgeBankFolderNameSchema = z
  .string()
  .trim()
  .min(1, 'name_required')
  .max(80, 'name_too_long');

export const knowledgeBankCreateFolderBodySchema = z.object({
  name: knowledgeBankFolderNameSchema,
  parentId: z.uuid('invalid_parent_id').nullable().optional(),
});

/** Signed board resolution path after direct Storage upload (client role). */
export const signedBoardResolutionRegisterBodySchema = z.object({
  storagePath: z.string().trim().min(3).max(512),
});

/** Register a documents-table index row (optional metadata for S3 objects). */
export const createDocumentBodySchema = z.object({
  engagementId: z.string().trim().min(1).max(128),
  fileName: z.string().trim().min(1).max(255),
  objectKey: z.string().trim().min(3).max(512),
  category: z.string().trim().max(64).optional().nullable(),
  contentType: z.string().trim().max(128).optional().nullable(),
  sizeBytes: z
    .number()
    .int()
    .nonnegative()
    .max(SUPABASE_MAX_UPLOAD_BYTES, 'file_too_large')
    .optional()
    .nullable(),
  stepId: z.string().trim().max(128).optional().nullable(),
  sharedWithClient: z.boolean().optional(),
});
