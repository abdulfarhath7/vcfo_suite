import 'server-only';

import { createHash } from 'node:crypto';
import type { AuthContext } from '@/auth/guards';
import {
  freezePacket,
  getFilingRecords,
  getFilingUploadContext,
  packetStatus,
  portalPdfForSigners,
  recordSignatureRequests,
  remarkCausesSince,
  saveSignedPdf,
  savePortalPdf,
  setSignerFacts,
  signerFactsOf,
  type SignerFactsPatch,
} from '@/db/repositories/assist-filings';
import { listAssistAttachments } from '@/db/repositories/assist-attachments';
import { getDocPackInputs } from '@/db/repositories/doc-pack';
import { recordAuditEvent } from '@/db/repositories/audit-events';
import { buildAssistProfile } from '@/lib/assist-profile/build';
import { buildDocPackContext } from '@/lib/doc-pack/evaluate';
import { emailParagraph, escapeHtml, renderEmailDocument } from '@/lib/email/email-layout';
import { sendEmail } from '@/lib/email/send-email';
import { messageHtml, type EmailDraftView, type EmailEdits } from '@/lib/email/email-edits';
import { recordEmailSent } from '@/lib/email/record-email-sent';
import { readProposedDirectors } from '@/lib/incorporation/proposed-directors';
import { FILING_FORMS, FILING_FORM_LABEL, FILING_FORM_STEP_ID, FilingRefusal, istDate, linkedSrn, type FilingForm } from '@/lib/mca-filing/filing-state';
import { SRN_FIELD_ID } from '@/lib/checklist/checklist-responses';
import { applyChecklistPatch } from '@/lib/incorporation/apply-checklist-patch';
import { checklistStateFromRow, getEngagementById } from '@/db/repositories/engagements';
import { packetHash } from '@/lib/mca-filing/packet-hash';
import { filingReadiness, packetContent, repeatCauses, signerReadiness, type FilingReadiness, type PacketPart } from '@/lib/mca-filing/readiness';
import { comparePdfText, flattenExpected } from '@/lib/mca-filing/pdf-compare';
import { readPdfSignatures } from '@/lib/mca-filing/pdf-signatures';
import { extractPdfText } from '@/lib/mca-filing/pdf-text';
import { checkSignedPdf, knownSigners, type KnownSigner } from '@/lib/mca-filing/signers';
import type { FilingBundle, PortalPdfCheck, SignatureRequestEntry } from '@/lib/mca-filing/types';

/**
 * MCA FILING SERVICE — the steps a route runs in order: read the PDF, run the pure checks, store
 * through the repository, record the audit event. It never talks to the MCA portal and never signs.
 * Audit summaries carry no remark or note text, because clients can read their engagement's events.
 */

const SIGN_LINK_SECONDS = 72 * 3600;

export const MAX_FILING_PDF_BYTES = 15 * 1024 * 1024;

/** The profile and signers of one engagement. Null when out of scope. */
async function filingProfile(ctx: AuthContext, engagementParam: string) {
  const access = await getDocPackInputs(ctx, engagementParam);
  if (access.ok === false) return null;
  const { inputs } = access;
  const result = buildAssistProfile(buildDocPackContext({ state: inputs.checklistState, brRow: inputs.brRow, engagement: inputs.engagement }));
  const signers = knownSigners(result.profile, readProposedDirectors(inputs.checklistState));
  return { result, signers, checklistState: inputs.checklistState };
}

/** Remark causes count over the last 12 months. */
const CAUSE_WINDOW_DAYS = 365;

/** The data a packet freezes: profile, attachment list, signers and missing keys. */
async function currentPacket(ctx: AuthContext, engagementParam: string, profile: NonNullable<Awaited<ReturnType<typeof filingProfile>>>) {
  const listed = await listAssistAttachments(ctx, engagementParam);
  const attachments = listed.ok ? listed.value.items : null;
  const content = packetContent(profile.result.profile, attachments ?? [], profile.signers, profile.result.missing);
  return { attachments, content, hash: packetHash(content) };
}

export async function filingBundle(ctx: AuthContext, engagementParam: string): Promise<FilingBundle | null> {
  const records = await getFilingRecords(ctx, engagementParam);
  if (!records) return null;
  const profile = await filingProfile(ctx, engagementParam);
  const today = istDate(new Date());
  const signers = profile?.signers ?? [];
  const facts = await signerFactsOf(records.dbId);
  const signerChecks = signers.map((s) => signerReadiness(s, facts.get(s.id), today));
  const packet = profile ? await currentPacket(ctx, engagementParam, profile) : null;
  const raw = packet ? await packetStatus(records.dbId, packet.content, packet.hash) : { latest: null, changed: [] as PacketPart[] };
  // Storage that could not be read is not a change to the attachment list.
  const status = packet?.attachments === null ? { ...raw, changed: raw.changed.filter((p) => p !== 'attachments') } : raw;
  const since = new Date(Date.now() - CAUSE_WINDOW_DAYS * 86_400_000).toISOString();
  const causes = repeatCauses(await remarkCausesSince(ctx, since));
  const missing = profile?.result.missing ?? [];
  const readiness = Object.fromEntries(
    FILING_FORMS.map((form) => [
      form,
      filingReadiness({
        form,
        missing,
        attachments: packet?.attachments ?? null,
        signers: signerChecks,
        packet: { frozenVersion: status.latest?.version ?? null, changed: status.changed, portalPdf: records.documents.some((d) => d.form === form && d.kind === 'portal_pdf') },
        causes,
      }),
    ]),
  ) as Record<FilingForm, FilingReadiness>;
  return {
    engagementId: records.engagementId,
    companyName: records.companyName,
    // SA-01: the SRN shown is the one on the matching checklist step (`acknowledgementNumber`).
    filings: records.filings.map((filing) => ({
      ...filing,
      srn: linkedSrn(profile?.checklistState[FILING_FORM_STEP_ID[filing.form]]?.responses?.[SRN_FIELD_ID], filing.srn),
    })),
    documents: records.documents,
    missing,
    signers,
    signerChecks,
    packet: { latest: status.latest, changed: status.changed, currentHash: packet?.hash ?? '' },
    causes,
    readiness,
  };
}

/**
 * SA-01: an SRN saved on the filing card goes onto the matching checklist step's
 * `acknowledgementNumber` through the ordinary staff save, so the step, its exports and the card
 * show one number. Additive: a refused save is logged and the filing record stands.
 */
export async function recordFilingSrnOnStep(ctx: AuthContext, engagementDbId: string, form: FilingForm, srn: string | null): Promise<boolean> {
  if (!srn) return false;
  const stepId = FILING_FORM_STEP_ID[form];
  try {
    const row = await getEngagementById(ctx, engagementDbId);
    if (!row) return false;
    if (checklistStateFromRow(row)[stepId]?.responses?.[SRN_FIELD_ID]?.trim() === srn) return true;
    await applyChecklistPatch(ctx, engagementDbId, stepId, { responses: { [SRN_FIELD_ID]: srn } });
    return true;
  } catch (error) {
    console.warn('[mca-filing] SRN not written to the checklist step', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Record what staff confirmed about one signer's MCA set-up. Null when out of scope. */
export async function recordSignerFacts(ctx: AuthContext, engagementParam: string, signerId: string, patch: SignerFactsPatch) {
  const profile = await filingProfile(ctx, engagementParam);
  if (!profile) return null;
  if (!profile.signers.some((s) => s.id === signerId)) throw new FilingRefusal('unknown_signer', 'Suite does not list this signer for the company.', 404);
  const saved = await setSignerFacts(ctx, engagementParam, signerId, patch);
  if (!saved) return null;
  await recordAuditEvent(ctx, {
    engagementId: saved.dbId,
    action: 'assist_filing.signer_confirmed',
    summary: 'Recorded a signer\'s MCA set-up',
    // Field names only, as with remarks.
    metadata: { fields: Object.keys(patch) },
  });
  return saved;
}

/** Freeze the current data as the next filing packet. Null when out of scope. */
export async function freezeFilingPacket(ctx: AuthContext, engagementParam: string, note: string | null) {
  const profile = await filingProfile(ctx, engagementParam);
  if (!profile) return null;
  const current = await currentPacket(ctx, engagementParam, profile);
  if (current.attachments === null) throw new FilingRefusal('attachments_unreadable', 'The attachment list could not be read, so the packet would be incomplete.', 503);
  const saved = await freezePacket(ctx, engagementParam, current.content, current.hash, note);
  if (!saved) return null;
  if (saved.created) {
    await recordAuditEvent(ctx, {
      engagementId: saved.dbId,
      action: 'assist_filing.packet_frozen',
      summary: `Froze filing packet ${saved.packet.version}`,
      metadata: { version: saved.packet.version },
    });
  }
  return saved;
}

const safeName = (name: string) => name.replace(/[^\p{L}\p{N}._ ()-]+/gu, '_').slice(0, 160) || 'filing.pdf';

/** A PDF starts with its header within the first kilobyte. */
export function looksLikePdf(bytes: Buffer): boolean {
  return bytes.subarray(0, 1024).includes('%PDF-');
}

export async function uploadPortalPdf(ctx: AuthContext, engagementParam: string, form: FilingForm, fileName: string, bytes: Buffer) {
  const profile = await filingProfile(ctx, engagementParam);
  if (!profile) return null;
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const text = await extractPdfText(bytes);
  const compare = comparePdfText(text.text, text.unreadable, flattenExpected(profile.result.profile, form));
  const check: PortalPdfCheck = { ...compare, pages: text.pages, readerError: text.error };
  const saved = await savePortalPdf(ctx, engagementParam, form, { fileName: safeName(fileName), bytes, sha256, textHash: text.textHash, check });
  if (!saved) return null;
  if (saved.created) {
    await recordAuditEvent(ctx, {
      engagementId: saved.dbId,
      action: 'assist_filing.portal_pdf_added',
      summary: `Added the ${FILING_FORM_LABEL[form]} portal PDF`,
      metadata: { form, documentId: saved.document.id, sha256, missing: compare.missing.length, unreadable: compare.unreadable, textChanged: saved.textChanged },
    });
  }
  return saved;
}

export async function uploadSignedPdf(ctx: AuthContext, engagementParam: string, form: FilingForm, fileName: string, bytes: Buffer) {
  const context = await getFilingUploadContext(ctx, engagementParam, form);
  const profile = context ? await filingProfile(ctx, engagementParam) : null;
  if (!context || !profile) return null;
  const refuse = async (e: FilingRefusal) => {
    await recordAuditEvent(ctx, {
      engagementId: context.dbId,
      action: 'assist_filing.signed_pdf_refused',
      summary: `Refused a signed ${FILING_FORM_LABEL[form]} PDF`,
      metadata: { form, code: e.code },
      result: 'denied',
    });
    return e;
  };
  try {
    if (form !== 'spice-part-b') throw new FilingRefusal('signed_pdf_part_b_only', 'Only SPICe+ Part B takes a signed PDF here.', 422);
    if (!context.portal) throw new FilingRefusal('no_portal_pdf', 'Add the unsigned PDF from the portal before a signed copy.');
    if (!context.reviewedAt) throw new FilingRefusal('not_reviewed', 'The professional has not approved the PDF yet.');
    const text = await extractPdfText(bytes);
    const { check, matches } = checkSignedPdf({
      signatures: readPdfSignatures(bytes),
      textHash: text.textHash,
      portalTextHash: context.portal.textHash,
      signers: profile.signers,
      professionalName: context.reviewedByName,
    });
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const saved = await saveSignedPdf(ctx, engagementParam, form, {
      fileName: safeName(fileName),
      bytes,
      sha256,
      textHash: text.textHash,
      signers: matches,
      check,
      allSigned: check.missingSigners.length === 0,
    });
    if (saved?.created) {
      await recordAuditEvent(ctx, {
        engagementId: saved.dbId,
        action: 'assist_filing.signed_pdf_added',
        summary: `Added a signed ${FILING_FORM_LABEL[form]} PDF with ${matches.length} signature${matches.length === 1 ? '' : 's'}`,
        metadata: { form, documentId: saved.document.id, sha256, signatures: matches.length, missingSigners: check.missingSigners.length },
      });
    }
    return saved;
  } catch (e) {
    if (e instanceof FilingRefusal) throw await refuse(e);
    throw e;
  }
}

/** The words the person can change in the pop-up (GL-07); the greeting and the link stay fixed. */
function signatureMessage(input: { companyName: string; formLabel: string; hasAttachment: boolean; fromName: string }): string {
  return [
    `The ${input.formLabel} form for ${input.companyName} is ready for your digital signature. Please read it, sign it with your own DSC and send the signed PDF back to ${input.fromName}.`,
    input.hasAttachment ? 'The PDF is attached. The link below opens the same file for a limited time.' : 'The link below opens the PDF for a limited time.',
    'Nobody at the firm will ask for your DSC PIN or any one-time password. Please do not share them.',
  ].join('\n\n');
}

function signatureEmail(input: { signerName: string; companyName: string; formLabel: string; link: string; message: string; subject?: string }) {
  const title = `Please sign the ${input.formLabel} form for ${input.companyName}`;
  return {
    subject: input.subject?.trim() || title,
    html: renderEmailDocument({ eyebrow: 'MCA filing', title, bodyHtml: emailParagraph(escapeHtml(`Dear ${input.signerName},`)) + messageHtml(input.message), cta: { label: 'Open the PDF', href: input.link } }),
    text: `Dear ${input.signerName},\n\n${input.message}\n\n${input.link}`,
  };
}

/**
 * GL-07: the signature request as a draft for the "Send email" pop-up. Each signer still gets a
 * separate email that copies nobody, so To lists the signers (the person may remove some) and Cc
 * stays empty.
 */
export async function previewSignatureRequests(ctx: AuthContext, engagementParam: string, form: FilingForm, signerIds?: string[]): Promise<EmailDraftView | null> {
  const pdf = await portalPdfForSigners(ctx, engagementParam, form, SIGN_LINK_SECONDS);
  const profile = pdf ? await filingProfile(ctx, engagementParam) : null;
  if (!pdf || !profile) return null;
  const wanted = signerIds?.length ? profile.signers.filter((s) => signerIds.includes(s.id)) : profile.signers;
  const to = wanted.map((s) => s.email).filter((e): e is string => Boolean(e));
  if (to.length === 0) throw new FilingRefusal('no_signers', 'No signer of this filing has an email address yet.', 422);
  return {
    to,
    cc: [],
    subject: `Please sign the ${FILING_FORM_LABEL[form]} form for ${pdf.companyName}`,
    message: signatureMessage({ companyName: pdf.companyName, formLabel: FILING_FORM_LABEL[form], hasAttachment: Boolean(pdf.bytes), fromName: ctx.name }),
    attachments: pdf.bytes ? [pdf.fileName] : [],
    fixed: 'a greeting with each signer\'s name and the link to the PDF. Each signer gets a separate email and nobody is copied',
  };
}

/**
 * Staff pressed Send in the pop-up: one separate email to each chosen signer with the latest
 * portal PDF. A signer list comes only from this engagement's own profile, the link opens one
 * object, and nobody is copied, so no message shows another client's data or another signer's
 * address. With `edits`, only the signers left in To get it, with the edited subject and words.
 */
export async function sendSignatureRequests(ctx: AuthContext, engagementParam: string, form: FilingForm, signerIds?: string[], edits?: EmailEdits) {
  const pdf = await portalPdfForSigners(ctx, engagementParam, form, SIGN_LINK_SECONDS);
  const profile = pdf ? await filingProfile(ctx, engagementParam) : null;
  if (!pdf || !profile) return null;
  let wanted: KnownSigner[] = signerIds?.length ? profile.signers.filter((s) => signerIds.includes(s.id)) : profile.signers;
  if (edits) {
    if (edits.cc.length) throw new FilingRefusal('no_cc', 'Signature requests copy nobody. Remove the Cc addresses.', 422);
    const chosen = new Set(edits.to.map((e) => e.toLowerCase()));
    const known = new Set(wanted.map((s) => s.email?.toLowerCase()).filter(Boolean));
    if ([...chosen].some((e) => !known.has(e))) throw new FilingRefusal('unknown_signer', 'Send only to the signers of this filing.', 422);
    wanted = wanted.filter((s) => s.email && chosen.has(s.email.toLowerCase()));
  }
  if (wanted.length === 0) throw new FilingRefusal('no_signers', 'Suite holds no signer for this filing yet.', 422);
  const message = edits?.message ?? signatureMessage({ companyName: pdf.companyName, formLabel: FILING_FORM_LABEL[form], hasAttachment: Boolean(pdf.bytes), fromName: ctx.name });
  const keepPdf = Boolean(pdf.bytes) && !edits?.dropAttachments.includes(pdf.fileName);
  const extra = (edits?.addAttachments ?? []).map((a) => ({ filename: a.filename, content: Uint8Array.from(Buffer.from(a.contentBase64, 'base64')), contentType: a.contentType || 'application/octet-stream' }));

  const entries: SignatureRequestEntry[] = [];
  for (const signer of wanted) {
    const base = { signerId: signer.id, name: signer.name, email: signer.email, at: new Date().toISOString(), byName: ctx.name, documentId: pdf.documentId };
    if (!signer.email) {
      entries.push({ ...base, outcome: 'no_email' });
      continue;
    }
    const mail = signatureEmail({ signerName: signer.name, companyName: pdf.companyName, formLabel: FILING_FORM_LABEL[form], link: pdf.url, message, subject: edits?.subject });
    const attachments = [...(keepPdf && pdf.bytes ? [{ filename: pdf.fileName, content: pdf.bytes, contentType: 'application/pdf' }] : []), ...extra];
    const res = await sendEmail({
      to: signer.email,
      ...mail,
      replyTo: ctx.email || undefined,
      purpose: 'assist_filing.signature_request',
      ...(attachments.length ? { attachments } : {}),
    });
    entries.push({ ...base, outcome: res.ok ? 'sent' : res.skipped ? 'not_configured' : 'failed' });
  }
  const saved = await recordSignatureRequests(ctx, engagementParam, form, entries);
  if (!saved) return null;
  await recordAuditEvent(ctx, {
    engagementId: saved.dbId,
    action: 'assist_filing.signature_requested',
    summary: `Asked ${entries.filter((e) => e.outcome === 'sent').length} of ${entries.length} signers to sign the ${FILING_FORM_LABEL[form]} PDF`,
    metadata: { form, documentId: pdf.documentId, outcomes: entries.map((e) => ({ signerId: e.signerId, outcome: e.outcome })) },
  });
  const sentTo = entries.filter((e) => e.outcome === 'sent' && e.email).map((e) => e.email!);
  await recordEmailSent(ctx, { to: sentTo, subject: edits?.subject ?? `Please sign the ${FILING_FORM_LABEL[form]} form for ${pdf.companyName}`, engagementId: saved.dbId, itemId: `filing:${form}`, via: 'firm' });
  return { filing: saved.filing, requests: entries };
}
