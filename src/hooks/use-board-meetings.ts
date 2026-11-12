'use client';

/**
 * Board meetings data (docs/specs/board-meetings/PLAN.md): TanStack Query over /api/board-meetings
 * and /api/agenda-library. Every route scopes by the caller's AuthContext in its repository.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requestEmailSend, type EmailDraftView } from '@/lib/email/request-email-send';
import type { MeetingDto, MeetingListRow, DirectorDto, LibraryItemDto, TemplateDto } from '@/lib/board-meetings/wire';
import type { AgendaItem, MeetingRecipient } from '@/lib/board-meetings/model';
import type { AgendaTopic } from '@/data/board-agenda-library';

export type { MeetingDto, MeetingListRow, DirectorDto, LibraryItemDto, TemplateDto };

const ERROR_TEXT: Record<string, string> = {
  blank_fields: 'Fill the highlighted fields in the agenda first.',
  no_director_email: 'Tick at least one director with an email.',
  venue_required: 'Add the venue.',
  notice_locked: 'The notice is already sent. Reschedule instead.',
  not_draft: 'The notice is no longer a draft.',
  not_pending: 'The notice is not waiting for approval.',
  note_required: 'Write a note so the lead knows what to change.',
  not_held: 'Upload the MoM after the meeting.',
  before_meeting: 'This opens after the meeting date.',
  locked: 'This document is signed and locked.',
  meeting_locked: "The next meeting's notice is sent. Add the resolution to the next meeting.",
  pdf_only: 'Upload a PDF.',
  too_large: 'The file is over 20 MB.',
  file_required: 'Choose a file.',
  signers_required: 'Pick at least one director to sign.',
  bad_email: 'One of the email addresses is not valid.',
  bad_din: 'A DIN has 8 digits.',
  forbidden: 'You cannot do this.',
  not_found: 'This meeting is not in your clients.',
  cannot_cancel: 'This meeting cannot be cancelled.',
  not_sent: 'The notice is not sent yet.',
  held_in_future: 'A meeting that already happened needs a date of today or earlier.',
  not_incorporated: 'Board meetings and directors start after the Certificate of Incorporation.',
  before_incorporation: 'The meeting date cannot be before the date of incorporation.',
};

export class MeetingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function readJson<T>(res: Response, what: string): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const code = body.error;
    throw new MeetingApiError((code && ERROR_TEXT[code]) || code || `Could not load ${what}`, res.status, code);
  }
  return body;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const MEETINGS_KEY = ['board-meetings'] as const;

export function useMeetings(engagementId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, 'list', engagementId ?? 'all'],
    queryFn: async () =>
      (await readJson<{ meetings: MeetingListRow[] }>(await fetch(`/api/board-meetings${engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : ''}`), 'the meetings')).meetings,
    enabled,
  });
}

export function useMeetingStats(enabled = true) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, 'stats'],
    queryFn: async () =>
      readJson<{ in30: number; waiting: number; quorumAtRisk: number; momOverdue: number; limitSoon: number; attention: MeetingListRow[] }>(await fetch('/api/board-meetings/stats'), 'the meetings'),
    enabled,
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, 'one', id],
    queryFn: async () => (await readJson<{ meeting: MeetingDto }>(await fetch(`/api/board-meetings/${encodeURIComponent(id)}`), 'the meeting')).meeting,
  });
}

export interface MeetingPatch {
  meetingDate?: string;
  meetingTime?: string;
  secondZone?: { label: string; time: string } | null;
  mode?: string;
  meetingType?: string;
  venue?: string;
  agenda?: AgendaItem[];
  bodyOverride?: string[] | null;
  recipients?: MeetingRecipient[];
  signatoryDirectorId?: string | null;
  teamsLink?: string | null;
}

/** Every meeting write returns the fresh meeting; the cache takes it and the lists refresh. */
export function useMeetingActions(id: string) {
  const qc = useQueryClient();
  const done = (m: MeetingDto) => {
    qc.setQueryData([...MEETINGS_KEY, 'one', id], m);
    void qc.invalidateQueries({ queryKey: [...MEETINGS_KEY, 'list'] });
    void qc.invalidateQueries({ queryKey: [...MEETINGS_KEY, 'stats'] });
    void qc.invalidateQueries({ queryKey: ['compliance-tasks'] });
  };
  const call = async (path: string, init: RequestInit, what = 'the meeting') => {
    const body = await readJson<{ meeting: MeetingDto }>(await fetch(`/api/board-meetings${path}`, init), what);
    done(body.meeting);
    return body.meeting;
  };
  const upload = (path: string, file: File) => {
    const fd = new FormData();
    fd.set('file', file);
    return call(path, { method: 'POST', body: fd }, 'the file');
  };
  /**
   * GL-07: a card's email goes out only from the "Send email" pop-up. Resolves with the fresh
   * meeting after Send, or null on Cancel (nothing was sent, and nothing changed).
   */
  const viaEmail = async (path: string, title: string, body?: Record<string, unknown>): Promise<MeetingDto | null> => {
    const outcome = await requestEmailSend<{ meeting?: MeetingDto }>({ url: `/api/board-meetings${path}`, body, title });
    if (!outcome.sent) return null;
    if (outcome.result?.meeting) done(outcome.result.meeting);
    else void qc.invalidateQueries({ queryKey: [...MEETINGS_KEY, 'one', id] });
    return outcome.result?.meeting ?? null;
  };
  return {
    patch: useMutation({ mutationFn: (p: MeetingPatch) => call(`/${id}`, json('PATCH', p)) }),
    submit: useMutation({ mutationFn: () => call(`/${id}/submit`, json('POST')) }),
    /** Approve, then open the notice in the pop-up. `sent` is false when the approver cancels it. */
    approve: useMutation({
      mutationFn: async () => {
        await call(`/${id}/approve`, json('POST'));
        const sent = await viaEmail(`/${id}/send-notice`, 'Send the notice to the directors');
        return { sent: Boolean(sent) };
      },
    }),
    /** An approved notice that was not sent yet (the pop-up was cancelled). */
    sendNotice: useMutation({ mutationFn: async () => ({ sent: Boolean(await viaEmail(`/${id}/send-notice`, 'Send the notice to the directors')) }) }),
    sendBack: useMutation({ mutationFn: (note: string) => call(`/${id}/send-back`, json('POST', { note })) }),
    reschedule: useMutation({ mutationFn: (b: { meetingDate: string; meetingTime: string; reason: string }) => call(`/${id}/reschedule`, json('POST', b)) }),
    /** Cancel; when the notice went out, the cancellation email goes through the pop-up. Null when it was not sent. */
    cancel: useMutation({
      mutationFn: async (reason: string) => {
        const preview = await readJson<{ draft: EmailDraftView | null }>(await fetch(`/api/board-meetings/${id}/cancel`, json('POST', { reason, preview: true })), 'the meeting');
        if (!preview.draft) return call(`/${id}/cancel`, json('POST', { reason }));
        const outcome = await requestEmailSend<{ meeting?: MeetingDto }>({ url: `/api/board-meetings/${id}/cancel`, body: { reason }, draft: preview.draft, title: 'Send the cancellation' });
        if (!outcome.sent) return null;
        if (outcome.result?.meeting) done(outcome.result.meeting);
        return outcome.result?.meeting ?? null;
      },
    }),
    remind: useMutation({
      mutationFn: async () => {
        const outcome = await requestEmailSend<{ sent: number }>({ url: `/api/board-meetings/${id}/remind`, title: 'Remind the directors to reply' });
        return outcome.sent ? { sent: outcome.result?.sent ?? 0 } : null;
      },
    }),
    uploadMom: useMutation({ mutationFn: (file: File) => upload(`/${id}/mom`, file) }),
    addResolution: useMutation({ mutationFn: (b: ResolutionBody) => call(`/${id}/resolutions`, json('POST', b)) }),
    editResolution: useMutation({ mutationFn: ({ docId, body }: { docId: string; body: ResolutionBody }) => call(`/documents/${docId}`, json('PATCH', body)) }),
    sendForSignature: useMutation({
      mutationFn: ({ docId, reminder }: { docId: string; reminder?: boolean }) =>
        viaEmail(`/documents/${docId}/send${reminder ? '?reminder=1' : ''}`, reminder ? 'Remind the directors to sign' : 'Send for signature'),
    }),
    /** Upload the signed copy (it locks), then open the final-copy email in the pop-up. */
    uploadSigned: useMutation({
      mutationFn: async ({ docId, file }: { docId: string; file: File }) => {
        await upload(`/documents/${docId}/signed`, file);
        return { emailed: Boolean(await viaEmail(`/documents/${docId}/final-copy`, 'Send the signed copy')) };
      },
    }),
    /** A locked document whose signed copy was not emailed yet. */
    sendFinalCopy: useMutation({ mutationFn: (docId: string) => viaEmail(`/documents/${docId}/final-copy`, 'Send the signed copy') }),
  };
}

export interface ResolutionBody {
  title: string;
  description: string;
  resolutionDate: string;
  changesItem?: string | null;
  reason?: string | null;
  signerIds: string[];
}

export interface CreateMeetingBody {
  engagementId: string;
  kind?: 'board' | 'agm' | 'egm';
  meetingType?: 'first' | 'quarterly' | 'annual' | 'special';
  meetingDate: string;
  meetingTime: string;
  secondZone?: { label: string; time: string } | null;
  mode?: 'vc' | 'in_person' | 'hybrid';
  venue?: string;
  postInc?: boolean;
  copyFromLast?: boolean;
  /** The meeting already happened with a notice sent outside VCFO: it starts as held. */
  alreadyHeld?: boolean;
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: CreateMeetingBody) => (await readJson<{ meeting: MeetingDto }>(await fetch('/api/board-meetings', json('POST', b)), 'the meeting')).meeting,
    onSuccess: (m) => {
      qc.setQueryData([...MEETINGS_KEY, 'one', m.id], m);
      void qc.invalidateQueries({ queryKey: MEETINGS_KEY });
      void qc.invalidateQueries({ queryKey: ['compliance-tasks'] });
    },
  });
}

/* ------------------------------------------------------------------ directors */

export function useDirectors(engagementId: string | null | undefined, includePast = false) {
  return useQuery({
    queryKey: [...MEETINGS_KEY, 'directors', engagementId, includePast],
    queryFn: async () =>
      (await readJson<{ directors: DirectorDto[] }>(await fetch(`/api/board-meetings/directors?engagementId=${encodeURIComponent(engagementId!)}${includePast ? '&includePast=1' : ''}`), 'the directors')).directors,
    enabled: Boolean(engagementId),
  });
}

export function useDirectorActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: MEETINGS_KEY });
  return {
    add: useMutation({
      mutationFn: async (b: { engagementId: string; name: string; din?: string | null; email?: string | null; phone?: string | null; designation?: string | null; appointedOn?: string | null }) =>
        (await readJson<{ director: DirectorDto }>(await fetch('/api/board-meetings/directors', json('POST', b)), 'the director')).director,
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) =>
        (await readJson<{ director: DirectorDto }>(await fetch(`/api/board-meetings/directors/${id}`, json('PATCH', body)), 'the director')).director,
      onSuccess: refresh,
    }),
  };
}

/* ------------------------------------------------------------------ library */

export function useAgendaLibrary(all = false) {
  return useQuery({
    queryKey: ['agenda-library', all],
    queryFn: async () => readJson<{ items: LibraryItemDto[]; topics: AgendaTopic[] }>(await fetch(`/api/agenda-library${all ? '?all=1' : ''}`), 'the agenda library'),
    staleTime: 10 * 60_000,
  });
}

export function useLibraryActions() {
  const qc = useQueryClient();
  const refresh = () => void qc.invalidateQueries({ queryKey: ['agenda-library'] });
  return {
    update: useMutation({
      mutationFn: async ({ id, body }: { id: string; body: Partial<LibraryItemDto> }) =>
        (await readJson<{ item: LibraryItemDto }>(await fetch(`/api/agenda-library/${encodeURIComponent(id)}`, json('PATCH', body)), 'the item')).item,
      onSuccess: refresh,
    }),
    importItems: useMutation({
      mutationFn: async (items: Array<Omit<LibraryItemDto, 'active'>>) =>
        readJson<{ added: number; updated: number }>(await fetch('/api/agenda-library', json('POST', { items })), 'the library'),
      onSuccess: refresh,
    }),
  };
}

export function useTemplates(engagementId?: string | null) {
  return useQuery({
    queryKey: ['agenda-templates', engagementId ?? 'firm'],
    queryFn: async () =>
      (await readJson<{ templates: TemplateDto[] }>(await fetch(`/api/agenda-library/templates${engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : ''}`), 'the templates')).templates,
  });
}

export function useSaveTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: { name: string; meetingType: string; agenda: AgendaItem[]; engagementId?: string | null }) =>
      (await readJson<{ template: TemplateDto }>(await fetch('/api/agenda-library/templates', json('POST', b)), 'the template')).template,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['agenda-templates'] }),
  });
}
