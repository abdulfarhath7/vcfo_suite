import type {
  ChecklistItemStateSlice,
  ChecklistReviewStatus,
} from '@/lib/checklist-state-key';
import { getSubmissionMeta, isClientSubmissionLocked } from '@/lib/checklist-item-lock';

export type { ChecklistReviewStatus };

type SliceLike = ChecklistItemStateSlice | null | undefined;

export function getReviewStatus(slice: SliceLike): ChecklistReviewStatus | null {
  if (!slice || typeof slice !== 'object') return null;
  const raw = slice.reviewStatus;
  if (raw === 'reviewing' || raw === 'accepted' || raw === 'rejected') return raw;
  if (isClientSubmissionLocked(slice)) return 'reviewing';
  return null;
}

export function isAwaitingReview(slice: SliceLike): boolean {
  return getReviewStatus(slice) === 'reviewing';
}

export function isReviewAccepted(slice: SliceLike): boolean {
  return getReviewStatus(slice) === 'accepted';
}

export function isReviewRejected(slice: SliceLike): boolean {
  return getReviewStatus(slice) === 'rejected';
}

export function canClientResubmit(slice: SliceLike): boolean {
  if (!isReviewRejected(slice)) return false;
  const unlocked = getSubmissionMeta(slice).unlockedFields ?? [];
  return unlocked.length > 0;
}

export interface ClientReviewBanner {
  tone: 'reviewing' | 'rejected' | 'accepted';
  title: string;
  body?: string;
}

export function getClientReviewBanner(slice: SliceLike): ClientReviewBanner | null {
  const status = getReviewStatus(slice);
  if (!status) return null;

  const { clientSubmittedAt } = getSubmissionMeta(slice);
  const submittedOn =
    clientSubmittedAt &&
    (() => {
      const date = new Date(clientSubmittedAt);
      return Number.isNaN(date.getTime())
        ? clientSubmittedAt
        : date.toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
    })();

  if (status === 'reviewing') {
    return {
      tone: 'reviewing',
      title: 'Under review',
      body: submittedOn
        ? `Submitted on ${submittedOn}. Your engagement team is reviewing your answers.`
        : 'Your engagement team is reviewing your answers.',
    };
  }

  if (status === 'accepted') {
    return {
      tone: 'accepted',
      title: 'Approved',
      body: submittedOn
        ? `Accepted after submission on ${submittedOn}.`
        : 'Your submission was approved.',
    };
  }

  const note =
    typeof slice?.rejectionNote === 'string' && slice.rejectionNote.trim()
      ? slice.rejectionNote.trim()
      : undefined;

  return {
    tone: 'rejected',
    title: 'Changes requested',
    body: note
      ? `${note} Update the fields below, then submit again.`
      : 'Your submission needs corrections. Update the fields below, then submit again.',
  };
}

export function getInternReviewLabel(slice: SliceLike): string | null {
  const status = getReviewStatus(slice);
  if (status === 'reviewing') return 'Awaiting manager / admin approval';
  if (status === 'accepted') return 'Accepted';
  if (status === 'rejected') return 'Rejected — client can resubmit';
  return null;
}
