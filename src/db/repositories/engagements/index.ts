import 'server-only';

/**
 * ENGAGEMENTS REPOSITORY — the reference implementation of the seam.
 *
 * This is the ONLY place engagements are read/written. Everything above the
 * seam (views, domain logic) calls these functions and never touches `db`.
 *
 * >>> ACCESS CONTROL (Path A) lives HERE. <<<
 * Four-role model:
 *   admin   — unrestricted (firm-wide), like the old manager role
 *   manager — engagements where manager_id = ctx.userId
 *             (legacy fallback: manager_id IS NULL AND admin_id = ctx.userId)
 *   intern  — intern_id = ctx.internId
 *   client  — client_user_id = ctx.userId OR client_id = ctx.clientId
 */

// The repository is split by concern; this file keeps the public import path.
export {
  managerOwnsEngagement,
} from './scope';
export type {
  EngagementDbRow,
  EngagementChecklistState,
  EngagementListRow,
} from './scope';
export {
  listEngagements,
  listScopedEngagementIds,
  listChecklistIndex,
  checklistStateForViewer,
  getEngagementById,
  getEngagementBySlug,
  toAppEngagement,
  toAppEngagementsWithLeads,
  assertEngagementAccess,
  getMyEngagement,
  checklistStateFromRow,
  listDeletedEngagements,
  getEngagementIncludingDeleted,
} from './read';
export {
  updateEngagement,
  updateProgressCcEmails,
  softDeleteEngagement,
  restoreEngagement,
} from './write';
export {
  patchChecklistItem,
  submitChecklistItem,
  submitDirectFlowStep,
  reviewChecklistItem,
  requestClientFill,
  decideClientFillRequest,
  unlockChecklistFields,
} from './checklist-workflow';
export type {
  DirectSubmitOutcome,
  ClientFillRequestOutcome,
} from './checklist-workflow';
export {
  clientApproveStep,
  clientRequestStepChange,
} from './step-approval';
export type {
  StepApprovalOutcome,
} from './step-approval';
export {
  getClientProfileForEngagement,
  createProjectWithClient,
} from './client-provisioning';
export type {
  CreateProjectWithClientInput,
  CreateProjectWithClientResult,
} from './client-provisioning';
