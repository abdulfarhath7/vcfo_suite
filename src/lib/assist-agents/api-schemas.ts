import { z } from 'zod';
import { containsPersonalData } from './pii';
import { ASSIST_AGENT_RUN_STATUSES, ASSIST_BLANK_REASONS, ASSIST_HEAL_TIERS, ASSIST_PATCH_TIERS, ASSIST_SIGNER_REF } from './types';

/**
 * Request bodies of the VCFO Assist agent routes (docs/specs/vcfo-assist-agents/API.md). Pure, so
 * the extension builder and the tests read the same shapes. Every free-text part is labels only:
 * a body that looks like it carries personal data is refused with `personal_data`.
 */

/**
 * Refuses personal data in the body's free text only. `texts` picks the label-like strings (names,
 * labels, refusal targets, errors, patch evidence); ids, versions, enums and the SRN are never
 * checked, because a uuid whose first group is all digits looks like a DIN or an Aadhaar number,
 * and the SRN is a filing reference that can look like a passport number.
 */
const labelsOnly = <T extends z.ZodTypeAny>(schema: T, texts: (value: z.infer<T>) => unknown) =>
  schema.refine((value) => !containsPersonalData(texts(value)), { message: 'personal_data' });

const SRN = /^[A-Z0-9]{6,20}$/;
const STATE = /^[A-Z][A-Z0-9_]{0,39}$/;
const INSTALL_ID = /^[A-Za-z0-9-]{8,64}$/;
const VERSION = /^\d{1,4}(\.\d{1,5}){0,3}$/;

export const createAgentRunSchema = z
  .object({
    subAgent: z.string().trim().min(1).max(40),
    /** The host of the portal tab the run fills; live hosts are refused until enabled. */
    portalHost: z.string().trim().min(1).max(200),
    /** The recipe version the extension holds; a stale one is refused with `recipe_outdated`. */
    recipeVersion: z.string().trim().max(20).optional(),
    fieldsTotal: z.number().int().min(0).max(1000).optional(),
    state: z.string().regex(STATE).optional(),
    /**
     * Evidence: which MCA login the staff member says they are using, as they typed it (a user id
     * or an email). A label only: the panel never asks for a password, and this is never checked
     * for personal data because it is the staff member's own login name.
     */
    mcaLoginLabel: z.string().trim().min(1).max(120).optional(),
    /** Evidence: the browser install (a random id kept in chrome.storage.local) and its user agent. */
    device: z
      .object({ installId: z.string().regex(INSTALL_ID), userAgent: z.string().max(400) })
      .strict()
      .optional(),
    /** The extension's own version, as its manifest says. */
    extensionVersion: z.string().regex(VERSION).optional(),
  })
  .strict();

const healSchema = z.object({ field: z.string().min(1).max(120), tier: z.enum(ASSIST_HEAL_TIERS), ok: z.boolean() }).strict();
const refusalSchema = z.object({ kind: z.string().min(1).max(40), target: z.string().max(200).optional(), at: z.string().max(40).optional() }).strict();
const blankSchema = z.object({ field: z.string().min(1).max(120), reason: z.enum(ASSIST_BLANK_REASONS) }).strict();

export const updateAgentRunSchema = labelsOnly(
  z
    .object({
      status: z.enum(ASSIST_AGENT_RUN_STATUSES).optional(),
      state: z.string().regex(STATE).optional(),
      fieldsTotal: z.number().int().min(0).max(1000).optional(),
      fieldsFilled: z.number().int().min(0).max(1000).optional(),
      heals: z.array(healSchema).max(200).optional(),
      refusals: z.array(refusalSchema).max(100).optional(),
      srn: z.string().trim().toUpperCase().regex(SRN, { message: 'srn_shape' }).nullable().optional(),
      error: z.string().max(500).nullable().optional(),
      /** Fields left for the user to fill from the client's records (G16); keys and reasons only. Replaces the stored list. */
      blanks: z.array(blankSchema).max(300).optional(),
      /** Who signed at the DSC step, as references Suite resolves to names from its own records. */
      dscSigners: z.array(z.string().regex(ASSIST_SIGNER_REF, { message: 'signer_ref_shape' })).min(1).max(20).optional(),
    })
    .strict(),
  (body) => [body.error, body.heals?.map((h) => h.field), body.refusals?.map((r) => [r.kind, r.target]), body.blanks?.map((b) => b.field)],
);

export const proposePatchSchema = labelsOnly(
  z
    .object({
      recipeId: z.string().trim().min(1).max(60),
      recipeVersion: z.string().trim().min(1).max(20),
      fieldKey: z.string().trim().min(1).max(120),
      proposed: z
        .object({ som: z.string().max(400).optional(), css: z.string().max(400).optional(), label: z.string().max(200).optional() })
        .strict()
        .refine((p) => Boolean(p.som || p.css || p.label), { message: 'proposed_empty' }),
      evidence: z
        .object({
          fieldLabel: z.string().max(200).optional(),
          candidateLabels: z.array(z.string().max(200)).max(40).optional(),
          chosenLabel: z.string().max(200).optional(),
          confidence: z.number().min(0).max(1).optional(),
          note: z.string().max(500).optional(),
        })
        .strict()
        .default({}),
      sourceTier: z.enum(ASSIST_PATCH_TIERS),
      runId: z.string().uuid().optional(),
    })
    .strict(),
  (body) => [body.fieldKey, body.proposed, body.evidence],
);

/**
 * POST /api/engagements/[id]/assist-runs/[runId]/attestation — the certifier's checks (G17). The
 * booleans and choices come from the person's own clicks; nothing defaults to ticked. Whether the
 * set is complete for this run's form is checked by the repository against the run's sub-agent.
 */
export const attestationSchema = labelsOnly(
  z
    .object({
      checks: z
        .object({
          fieldsCheckedAgainstRecords: z.literal(true, { message: 'fields_check_required' }),
          registeredOffice: z.enum(['visited', 'owner_noc']).optional(),
          subscriberSignatures: z.enum(['in_presence', 'video_kyc']).optional(),
        })
        .strict(),
      /** Evidence documents already in the engagement's vault (site-visit photo, NOC, video-KYC record). */
      evidenceDocumentIds: z.array(z.string().uuid()).max(20).default([]),
      note: z.string().trim().max(500).optional(),
    })
    .strict(),
  (body) => [body.note],
);

export const reviewPatchSchema = z.object({ decision: z.enum(['approved', 'rejected']) }).strict();
