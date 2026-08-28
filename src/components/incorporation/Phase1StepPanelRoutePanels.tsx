'use client';

import Link from 'next/link';
import { CheckCircle2, Clock, FileText, Upload } from 'lucide-react';
import type { ChecklistItem } from '@/data/checklist';
import { getItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import {
  computeMcaNameApprovalExpiryDate,
  extractItemResponses,
  type ChecklistItemResponses,
} from '@/lib/checklist-responses';
import { formatPre1DateDisplay } from '@/lib/checklist-pre1-validation';
import { isDeliveredToClient } from '@/lib/checklist-state-key';
import { clientBoardResolutionPath } from '@/lib/project-step-path';
import { incorpDraftDocLinksFromResponses } from '@/lib/incorporation-docs/client';
import {
  filterClientVisibleIncorpDrafts,
  hasAnyClientVisibleIncorpDraft,
} from '@/lib/incorporation-docs/share';
import { cn } from '@/lib/utils';
import { IncorporationDocsGeneratePanel } from '@/components/incorporation/IncorporationDocsGeneratePanel';
import { IncorporationDocsBulkShareBar } from '@/components/incorporation/IncorporationDocsBulkShareBar';
import { MilestoneFileDisplay } from '@/components/incorporation/MilestoneFileDisplay';
import { hasPre7OtherAttachments } from '@/lib/checklist-pre7-other-attachments';
import { buildPre7NonIncorpDraftDocLinks } from '@/components/incorporation/phase1-step-panel-utils';
import {
  PanelShell,
  Pre7OtherAttachmentsList,
  DraftDocLinksList,
  Pre8DeliveredDraftDocsPanel,
} from '@/components/incorporation/Phase1StepPanelParts';
import type { Phase1StepPanelRoutesProps } from '@/components/incorporation/Phase1StepPanelSections';

export function Phase1Pre2Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    if (!engagement) return null;

    // Intern CTA lives in the form-card footer (`aboveFooterActions`), not above the fields.
    if (isIntern) return null;

    if (!isClient) {
      return (
        <div className={className}>
          <PanelShell title="Draft Board Resolution">
            {brStatus === 'loading' && <p className="text-text-tertiary">Checking status…</p>}
            {brStatus === 'none' && (
              <p className="text-text-tertiary">
                Not generated yet — assigned project lead drafts from Pre-1 client data in Step 2.
              </p>
            )}
            {brStatus === 'draft' && (
              <p className="flex items-center gap-1.5 text-text-secondary">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Draft in progress — awaiting project lead review and finalization.
              </p>
            )}
            {brStatus === 'finalized' && (
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Finalized and shared with client for review.
              </p>
            )}
            {brStatus === 'signed' && (
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Client has uploaded a signed copy (Step 3).
              </p>
            )}
          </PanelShell>
        </div>
      );
    }

    return (
      <div className={className}>
        <PanelShell title="Draft Board Resolution">
          {brStatus === 'loading' && (
            <p className="text-text-tertiary">Checking status…</p>
          )}
          {brStatus === 'none' || brStatus === 'draft' ? (
            <p>Not finalized yet.</p>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Draft board resolution released — download and review before signing in Step 3.
              </p>
              <Link
                href={clientBoardResolutionPath()}
                className="inline-flex items-center gap-1.5 text-blue-700 hover:underline font-medium"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                View draft board resolution
              </Link>
            </>
          )}
        </PanelShell>
      </div>
    );
}

export function Phase1Pre3Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    if (isClient) {
      return (
        <div className={className}>
          <PanelShell title="Signed Board Resolution">
            {brStatus === 'signed' ? (
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Signed copy uploaded — your engagement team has received it.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-text-tertiary">
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Signed copy not uploaded yet.
              </p>
            )}
            {(brStatus === 'finalized' || brStatus === 'signed') && (
              <Link
                href={clientBoardResolutionPath()}
                className="inline-flex items-center gap-1.5 text-blue-700 hover:underline font-medium"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {brStatus === 'signed' ? 'View or replace signed copy' : 'Upload signed copy'}
              </Link>
            )}
            {brStatus === 'none' || brStatus === 'draft' ? (
              <p className="text-text-tertiary">
                Available once your engagement team finalizes the draft board resolution.
              </p>
            ) : null}
          </PanelShell>
        </div>
      );
    }

    return (
      <div className={className}>
        <PanelShell title="Signed Board Resolution">
          {brStatus === 'loading' && <p className="text-text-tertiary">Checking status…</p>}
          {brStatus === 'signed' ? (
            <p className="flex items-center gap-1.5 text-success-text">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Signed copy received from client.
            </p>
          ) : brStatus === 'finalized' ? (
            <p className="flex items-center gap-1.5 text-text-tertiary">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Draft released — awaiting client upload of signed copy.
            </p>
          ) : (
            <p className="text-text-tertiary">
              Finalize the draft board resolution in Step 2 before the client can sign.
            </p>
          )}
        </PanelShell>
      </div>
    );
}

export function Phase1Pre4Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    const ack = responses.nameApplicationAcknowledgementUrl?.trim();
    const notes = responses.nameApplicationFilingNotes?.trim();

    if (isClient) {
      return (
        <div className={className}>
          <PanelShell title="Name Application">
            {deliveredToClient && ack ? (
              <>
                <p className="flex items-center gap-1.5 text-success-text">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Your name application has been filed with ROC.
                </p>
                <MilestoneFileDisplay
                  storagePath={ack}
                  label="ROC acknowledgement"
                />
              </>
            ) : (
              <p>Name application is being filed. Acknowledgement appears here when delivered.</p>
            )}
            {deliveredToClient && notes && <p className="text-text-tertiary">{notes}</p>}
          </PanelShell>
        </div>
      );
    }

    return (
      <div className={className}>
        <PanelShell>
          {brStatus === 'signed' ? (
            <p className="text-success-text">Signed board resolution is on file.</p>
          ) : (
            <p className="text-text-tertiary">
              Awaiting signed board resolution from the client (Step 3).
            </p>
          )}
        </PanelShell>
      </div>
    );
}

export function Phase1Pre5Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    const approvedName = responses.approvedCompanyName?.trim();
    const approvalDate = responses.nameApprovalDate?.trim();
    const expiryDate =
      responses.nameApprovalExpiryDate?.trim() ||
      (approvalDate ? computeMcaNameApprovalExpiryDate(approvalDate) : '');
    const letter = responses.mcaApprovalLetterUrl?.trim();

    if (!isClient) return null;

    return (
      <div className={className}>
        <PanelShell title="Name Approval">
          {deliveredToClient && (approvedName || approvalDate || expiryDate || letter) ? (
            <dl className="space-y-2">
              {approvedName && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                    Approved name
                  </dt>
                  <dd className="text-ink font-medium">{approvedName}</dd>
                </div>
              )}
              {approvalDate && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                    Approval date
                  </dt>
                  <dd>{formatPre1DateDisplay(approvalDate) ?? approvalDate}</dd>
                </div>
              )}
              {expiryDate && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                    Expiry date
                  </dt>
                  <dd>{formatPre1DateDisplay(expiryDate) ?? expiryDate}</dd>
                </div>
              )}
              {letter && (
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                    Approval letter
                  </dt>
                  <dd>
                    <MilestoneFileDisplay storagePath={letter} label="MCA approval letter" />
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p>
              MCA name approval typically arrives within 4 to 5 working days from the date of
              filing. Your Project Lead will share the approved name and approval letter here.
            </p>
          )}
        </PanelShell>
      </div>
    );
}

export function Phase1Pre7Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    const nrDsc = responses.nrDirectorDscSuccessMessageUrl?.trim();
    const residentDsc = responses.residentDirectorDscSuccessMessageUrl?.trim();
    const hasDsc = Boolean(nrDsc || residentDsc);
    const draftDocs = buildPre7NonIncorpDraftDocLinks(responses);
    const coreDraftDocs = incorpDraftDocLinksFromResponses(responses, incorpDraftLabelOptions);
    const hasDraftDocs = draftDocs.length > 0;
    const kycStatus = responses.kycReviewStatus?.trim();
    const kycNotes = responses.kycReviewNotes?.trim();
    const hasOtherAttachments = hasPre7OtherAttachments(responses);
    const hasDeliveredContent =
      deliveredToClient && (hasDsc || hasDraftDocs || hasOtherAttachments);

    if (isClient) {
      return (
        <div className={className}>
          <PanelShell title="KYC Review & DSC">
            {hasDeliveredContent ? (
              <>
                <p className="flex items-center gap-1.5 text-success-text">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Your engagement team has completed KYC review and shared DSC proof and draft documents.
                </p>
                {kycStatus && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      KYC review status
                    </p>
                    <p className="text-ink font-medium capitalize">
                      {kycStatus === 'corrections-requested'
                        ? 'Corrections requested'
                        : kycStatus}
                    </p>
                  </div>
                )}
                {kycNotes && <p className="text-text-tertiary">{kycNotes}</p>}
                {hasDsc && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      DSC success messages
                    </p>
                    {nrDsc && (
                      <MilestoneFileDisplay
                        storagePath={nrDsc}
                        label="DSC success — Non-resident Director"
                      />
                    )}
                    {residentDsc && (
                      <MilestoneFileDisplay
                        storagePath={residentDsc}
                        label="DSC success — Resident Director"
                      />
                    )}
                  </div>
                )}
                {hasDraftDocs && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      Draft incorporation documents
                    </p>
                    <DraftDocLinksList
                      docs={draftDocs}
                      engagementId={engagement?.id}
                      showIncorpDocxPreview={false}
                    />
                  </div>
                )}
                {hasOtherAttachments && (
                  <Pre7OtherAttachmentsList responses={responses} />
                )}
              </>
            ) : (
              <p>Draft incorporation documents appear here when delivered.</p>
            )}
          </PanelShell>
        </div>
      );
    }

    return (
      <div className={cn('space-y-3', className)}>
        {engagement && !isClient && (
          <IncorporationDocsGeneratePanel engagement={engagement} responses={responses} />
        )}
        <PanelShell title="KYC Review & DSC">
          {coreDraftDocs.length > 0 && (
            <p className="text-success-text">
              {coreDraftDocs.length} core draft document{coreDraftDocs.length === 1 ? '' : 's'}{' '}
              on file — preview or rebuild in the panel above, then share when edits are saved.
            </p>
          )}
        </PanelShell>
        <Pre7OtherAttachmentsList responses={responses} />
      </div>
    );
}

export function Phase1Pre8Panel(props: Phase1StepPanelRoutesProps) {
  const { item, engagement, responses, className, isClient, isIntern, brStatus, deliveredToClient, itemState, incorpDraftLabelOptions, getStateForEngagement } = props;
    const pre7Item = getItem('pre-7');
    const pre7State = engagement ? getStateForEngagement(engagement)['pre-7'] : undefined;
    const pre7Responses = pre7Item
      ? extractItemResponses(pre7Item, pre7State)
      : ({} as ChecklistItemResponses);
    const pre7Delivered = isDeliveredToClient(pre7State);
    const coreDraftDocs = incorpDraftDocLinksFromResponses(pre7Responses, incorpDraftLabelOptions);
    const clientVisibleDrafts = filterClientVisibleIncorpDrafts(
      pre7Responses,
      pre7State,
      incorpDraftLabelOptions,
    );
    const hasCoreDrafts = coreDraftDocs.length > 0;
    const hasClientVisibleDrafts = hasAnyClientVisibleIncorpDraft(
      pre7Responses,
      pre7State,
      incorpDraftLabelOptions,
    );
    const clientSubmitted = Boolean(itemState?.clientSubmittedAt?.trim());

    if (isClient) {
      return (
        <div className={className}>
          <PanelShell title="Document Execution">
            {hasClientVisibleDrafts ? (
              <>
                <p className="flex items-center gap-1.5 text-success-text">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Draft incorporation forms are ready — download, sign, notarize, and upload executed
                  copies below.
                </p>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                    Draft incorporation documents
                  </p>
                  <DraftDocLinksList
                    docs={clientVisibleDrafts}
                    engagementId={engagement?.id}
                    showIncorpDocxPreview={false}
                  />
                </div>
              </>
            ) : pre7Delivered && !hasCoreDrafts ? (
              <p>Drafts have been delivered, but DIR-2, DIR-8, INC-9, or PAN files are not attached yet.</p>
            ) : (
              <p>Draft DIR-2, DIR-8, INC-9, and PAN files appear here when shared.</p>
            )}
            {clientSubmitted ? (
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Signed documents submitted — your engagement team is reviewing.
              </p>
            ) : hasClientVisibleDrafts ? (
              <p className="flex items-center gap-1.5 text-text-tertiary">
                <Upload className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Download, sign, notarize, and upload executed copies below.
              </p>
            ) : null}
          </PanelShell>
        </div>
      );
    }

    return (
      <div className={cn('space-y-3', className)}>
        {engagement?.id && hasCoreDrafts && (
          <IncorporationDocsBulkShareBar
            engagementId={engagement.id}
            responses={pre7Responses}
            pre7State={pre7State}
            labelOptions={incorpDraftLabelOptions}
          />
        )}
        <PanelShell title="Document Execution">
          {hasClientVisibleDrafts ? (
            <>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-text-tertiary">
                  Shared draft documents (from Step 2)
                </p>
                {engagement?.id ? (
                  <Pre8DeliveredDraftDocsPanel
                    engagementId={engagement.id}
                    pre7Responses={pre7Responses}
                    labelOptions={incorpDraftLabelOptions}
                  />
                ) : null}
              </div>
            </>
          ) : hasCoreDrafts ? (
            <p className="flex items-center gap-1.5 text-text-tertiary">
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {coreDraftDocs.length} draft document{coreDraftDocs.length === 1 ? '' : 's'} generated
              on Step 2 — use <strong>Share with client</strong> on Pre-7 before they appear here.
            </p>
          ) : (
            <p>
              Generate DIR-2, DIR-8, INC-9, and PAN drafts on{' '}
              <strong>Phase 2 Step 2 (Pre-7)</strong>, then share with the client. Signed uploads
              are collected on this step.
            </p>
          )}
        </PanelShell>
      </div>
    );
}

export function Phase1Pre9Panel(props: Phase1StepPanelRoutesProps) {
  const { className, isClient, itemState } = props;
  const clientSubmitted = Boolean(itemState?.clientSubmittedAt?.trim());
  const confirmation = props.responses.spicePartBConfirmation?.trim();

  if (isClient) {
    return (
      <div className={className}>
        <PanelShell title="SPICe+ Confirmation">
          {clientSubmitted ? (
            <>
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Your Spice Part B confirmation has been submitted.
              </p>
              {confirmation === 'changes-recommended' && (
                <p className="text-text-tertiary">
                  You recommended changes — your project lead will update the application before
                  filing.
                </p>
              )}
              {confirmation === 'confirmed' && (
                <p className="text-text-tertiary">
                  You confirmed the application — your project lead will proceed to MCA filing.
                </p>
              )}
            </>
          ) : (
            <p>
              Review the shared SPICe+ Part B application with your project lead, then record your
              review notes and confirmation in the form below. Allow 2–3 working days for this step.
            </p>
          )}
        </PanelShell>
      </div>
    );
  }

  return (
    <div className={className}>
      <PanelShell title="SPICe+ Confirmation">
        {clientSubmitted && (
          <p className="flex items-center gap-1.5 text-success-text">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Client submitted their Spice Part B confirmation.
          </p>
        )}
      </PanelShell>
    </div>
  );
}

export function Phase1Pre10Panel(props: Phase1StepPanelRoutesProps) {
  const { className, isClient, deliveredToClient } = props;
  const filedNotes = props.responses.spicePartBAndAgileFiledNotes?.trim();

  if (isClient) {
    return (
      <div className={className}>
        <PanelShell title="SPICe+ Filing">
          {deliveredToClient && filedNotes ? (
            <>
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                SPICe+ Part B and AGILE-PRO-S have been filed with MCA.
              </p>
              <p className="text-text-tertiary">{filedNotes}</p>
            </>
          ) : (
            <p>SPICe+ filing details appear here when delivered.</p>
          )}
        </PanelShell>
      </div>
    );
  }

  return null;
}

export function Phase1Pre11Panel(props: Phase1StepPanelRoutesProps) {
  const { className, isClient, deliveredToClient, responses } = props;
  const remarks = responses.mcaRemarksSummary?.trim();
  const clarification = responses.clarificationLetterUrl?.trim();

  if (isClient) {
    return (
      <div className={className}>
        <PanelShell title="MCA Remarks">
          {deliveredToClient && remarks ? (
            <>
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Your project lead has addressed MCA remarks and resubmitted the application.
              </p>
              <p className="text-text-tertiary">{remarks}</p>
              {clarification && (
                <MilestoneFileDisplay storagePath={clarification} label="Clarification letter" />
              )}
            </>
          ) : (
            <p>
              If MCA raises remarks, your project lead will request any needed information and
              resubmit with a clarification letter. Updates appear here once delivered (typically
              5–7 working days).
            </p>
          )}
        </PanelShell>
      </div>
    );
  }

  return null;
}

export function Phase1Pre12Panel(props: Phase1StepPanelRoutesProps) {
  const { className, isClient, deliveredToClient, responses } = props;
  const cert = responses.certificateOfIncorporationFinalUrl?.trim();
  const cin = responses.cin?.trim();
  const pan = responses.pan?.trim();
  const tan = responses.tan?.trim();
  const pfCode = responses.pfCode?.trim();
  const esiCode = responses.esiCode?.trim();
  const companyName = responses.incorporatedCompanyName?.trim();
  const incorporationDate = responses.dateOfIncorporation?.trim();
  const panCard = responses.panCardFinalUrl?.trim();
  const tanCard = responses.tanCardFinalUrl?.trim();
  const hasDeliveredContent = deliveredToClient && (cert || cin || pan);

  if (isClient) {
    return (
      <div className={className}>
        <PanelShell title="Certificate of Incorporation">
          {hasDeliveredContent ? (
            <>
              <p className="flex items-center gap-1.5 text-success-text">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Your company has been incorporated — MCA approval details are below.
              </p>
              <dl className="space-y-2">
                {companyName && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      Company name
                    </dt>
                    <dd className="text-ink font-medium">{companyName}</dd>
                  </div>
                )}
                {incorporationDate && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      Date of incorporation
                    </dt>
                    <dd>{formatPre1DateDisplay(incorporationDate) ?? incorporationDate}</dd>
                  </div>
                )}
                {cin && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      CIN
                    </dt>
                    <dd className="font-mono text-[11px]">{cin}</dd>
                  </div>
                )}
                {pan && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      PAN
                    </dt>
                    <dd className="font-mono text-[11px]">{pan}</dd>
                  </div>
                )}
                {tan && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      TAN
                    </dt>
                    <dd className="font-mono text-[11px]">{tan}</dd>
                  </div>
                )}
                {pfCode && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      PF Code
                    </dt>
                    <dd className="font-mono text-[11px]">{pfCode}</dd>
                  </div>
                )}
                {esiCode && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary">
                      ESI Code
                    </dt>
                    <dd className="font-mono text-[11px]">{esiCode}</dd>
                  </div>
                )}
                {(cert || panCard || tanCard) && (
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-text-tertiary mb-1">
                      Documents
                    </dt>
                    <dd className="space-y-1">
                      {cert && (
                        <MilestoneFileDisplay
                          storagePath={cert}
                          label="Certificate of Incorporation"
                        />
                      )}
                      {panCard && (
                        <MilestoneFileDisplay
                          storagePath={panCard}
                          label="PAN Card"
                        />
                      )}
                      {tanCard && (
                        <MilestoneFileDisplay
                          storagePath={tanCard}
                          label="TAN Card"
                        />
                      )}
                    </dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p>
              MCA approval typically takes 14–15 working days from filing (Phase 2 Step 6). Your
              project lead will deliver the certificate, Corporate Identification Number (CIN),
              Permanent Account Number (PAN), and related documents here.
            </p>
          )}
        </PanelShell>
      </div>
    );
  }

  return (
    <div className={className}>
      <PanelShell title="Certificate of Incorporation">
        <p>
          Enter MCA-approved company identifiers and upload the certificate of incorporation,
          Permanent Account Number (PAN) card, and Tax Deduction and Collection Account Number
          (TAN) card. Confirm whether the Certificate of Incorporation signature is verified by
          MCA. Use{' '}
          <strong>Deliver to client</strong> when ready.
        </p>
      </PanelShell>
    </div>
  );
}
