'use client';

/**
 * The new-client seat's data in one hook: the step model and the client's
 * (redacted) checklist state, the incorporation extras (file requests, board
 * resolution) and the home aggregate (activity, open requests), folded through
 * the pure helpers in ./model.
 */
import { useMemo } from 'react';
import type { ClientFileRequestDto } from '@/lib/client-portal/incorporation-types';
import type { HomeNeedRequest } from '@/lib/client/client-home';
import { validateMilestoneUploadFile } from '@/lib/documents/milestone-document-storage';
import { usePortal } from '../../runtime';
import { useClientHome, useIncorporationExtras, useMyEngagement, usePortalIncorporation } from '../../data';
import {
  boardStateOf,
  boardStepId,
  declarationsOf,
  intakeSteps,
  intakeTotals,
  newcStages,
  newcStatus,
  signBadge,
  spiceStageOf,
  type EngagementLike,
  type StateMap,
} from './model';

/**
 * The app context starts from the checklist INDEX (statuses only). The answers
 * (Part B entries, the pre-7 drafts and their share list) come with the full
 * checklist state, which PortalRoot loads on mount (data.ts useLoadFullChecklist;
 * useRefreshPortal reloads it after every save / upload).
 */
const NO_REQ: ClientFileRequestDto[] = [];
const NO_NEEDS: HomeNeedRequest[] = [];

export function useNewc() {
  const { shell } = usePortal();
  const { model, engagement, loading } = usePortalIncorporation();
  const { state } = useMyEngagement();
  const extrasQ = useIncorporationExtras();
  const homeQ = useClientHome();
  const requests = extrasQ.data?.fileRequests ?? NO_REQ;
  const needs = homeQ.data?.needs ?? NO_NEEDS;
  const eng: EngagementLike | null = useMemo(
    () =>
      engagement
        ? {
            ownershipType: engagement.ownershipType,
            parentEntityName: engagement.parentEntityName,
            parentEntityAddress: engagement.parentEntityAddress,
            parentEntityRegistrationNumber: engagement.parentEntityRegistrationNumber,
          }
        : null,
    [engagement],
  );
  const intake = useMemo(() => intakeSteps(model, state as StateMap, eng), [model, state, eng]);
  const totals = useMemo(() => intakeTotals(intake), [intake]);
  const decl = useMemo(() => declarationsOf(state as StateMap, requests, eng), [state, requests, eng]);
  const board = boardStateOf(model, extrasQ.data?.boardResolution);
  const signNeeds = useMemo(() => needs.filter((n) => n.kind === 'sign'), [needs]);
  const stages = useMemo(() => newcStages(model), [model]);
  const stage = spiceStageOf(model, Boolean(shell?.incorporated));
  const status = useMemo(
    () => newcStatus({ model, intake, totals, board, decl, signNeeds: signNeeds.length, stage }),
    [model, intake, totals, board, decl, signNeeds.length, stage],
  );
  return {
    shell,
    model,
    engagement,
    loading: loading || !shell,
    intake,
    totals,
    decl,
    board,
    boardStep: boardStepId(model),
    signNeeds,
    stages,
    status,
    /** pre / incorporated / skipped (SPICe+ not part of the project): see model.ts spiceStageOf */
    stage,
    signCount: signBadge(board, decl, needs, stage),
    activity: homeQ.data?.activity ?? [],
    homeLoading: homeQ.isPending,
    extras: extrasQ.data ?? null,
  };
}

/** Upload a file the firm asked for on a step: store it, then attach it to the request (as StepWork does). */
export async function uploadForRequest(engagementId: string, extrasEngagementId: string, r: ClientFileRequestDto, file: File): Promise<void> {
  const bad = validateMilestoneUploadFile(file);
  if (bad) throw new Error(bad);
  const fd = new FormData();
  fd.set('fieldId', r.fieldId);
  fd.set('stepId', r.stepId);
  fd.set('file', file);
  const up = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/milestone-documents`, { method: 'POST', body: fd });
  const ub = (await up.json().catch(() => ({}))) as { path?: string; error?: string };
  if (!up.ok || !ub.path) throw new Error(ub.error ?? 'Upload failed');
  const at = await fetch(`/api/client/steps/${encodeURIComponent(r.stepId)}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ engagementId: extrasEngagementId, requestId: r.id, path: ub.path, fileName: file.name, sizeBytes: file.size, contentType: file.type }),
  });
  const ab = (await at.json().catch(() => ({}))) as { error?: string };
  if (!at.ok) throw new Error(ab.error ?? 'Could not attach the file');
}

/** Answer an open document request (POST /api/client/documents/requests/:id/upload). */
export async function uploadForNeed(needId: string, file: File): Promise<void> {
  const fd = new FormData();
  fd.set('file', file);
  const res = await fetch(`/api/client/documents/requests/${encodeURIComponent(needId)}/upload`, { method: 'POST', body: fd });
  const b = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(b.error === 'file_required' ? 'Choose a file to upload' : b.error ?? 'Upload failed');
}

/** The single-draft download route (a client gets only rows SBC shared). */
export function draftHref(engagementId: string, doc: string, audience: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/incorporation-docs/download?doc=${encodeURIComponent(doc)}&director=${encodeURIComponent(audience)}`;
}

export function allDraftsHref(engagementId: string): string {
  return `/api/engagements/${encodeURIComponent(engagementId)}/incorporation-docs/download-all`;
}
