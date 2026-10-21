/**
 * Client portal v7 — Incorporation pages: the shape of
 * `GET /api/client/incorporation` (`getClientIncorporationExtras`). Pure types,
 * shared by the repository, the route and the page components.
 */

export interface ClientFileRequestDto {
  id: string;
  stepId: string;
  fieldId: string;
  /** "NOC from property owner" */
  label: string;
  /** "No-objection certificate from the owner" */
  note?: string;
  /** yyyy-mm-dd */
  dueDate?: string;
  requestedAt: string;
  requestedByName?: string;
  fulfilledAt?: string;
  fulfilledByName?: string;
  fulfilledPath?: string;
  fileName?: string;
  sizeBytes?: number;
  contentType?: string;
}

export interface IncorporationFileMeta {
  sizeBytes?: number;
  contentType?: string;
  uploadedByName?: string;
  uploadedAt?: string;
}

export interface IncorporationBoardResolution {
  status: 'draft' | 'finalized';
  hasDocx: boolean;
  draftedAt?: string;
  finalizedAt?: string;
  finalizedByName?: string;
  signedUploadedAt?: string;
  signedUploadedByName?: string;
  signedFileName?: string;
  /** Step 3 accepted by the firm ("Received by SBC"). */
  receivedAt?: string;
  receivedByName?: string;
}

export interface ClientIncorporationExtras {
  /** Engagement db id (milestone object paths start with it). */
  engagementId: string;
  /** Who set the incorporation window ("window set by Priya Raman"). */
  windowSetByName?: string;
  fileRequests: ClientFileRequestDto[];
  /** Upload metadata by object path, for files on steps released to the client. */
  fileMeta: Record<string, IncorporationFileMeta>;
  boardResolution: IncorporationBoardResolution | null;
}
