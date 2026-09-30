'use client';

import { createContext, useContext } from 'react';
import type { AnswerDepth, AnswerEnvelope, AskShell } from '@/data/ask/schema';
import type { ChatBody } from '@/hooks/ask/ask-api';

export type ThreadItem =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; messageId: string | null; answer: AnswerEnvelope }
  | { id: string; kind: 'error'; text: string };

export type AskPreview = { engagementId: string; companyName: string };

export type AskInput = {
  message?: string;
  suggestionId?: string;
  label?: string;
  context?: ChatBody['context'];
  depth?: AnswerDepth;
};

export interface AskContextValue {
  enabled: boolean;
  firmName: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  shell: AskShell | null;
  /** Engagement answers are scoped to (client, or super admin preview). */
  engagementId: string | null;
  preview: AskPreview | null;
  setPreview: (preview: AskPreview | null) => void;
  thread: ThreadItem[];
  status: string | null;
  busy: boolean;
  conversationId: string | null;
  ask: (input: AskInput) => Promise<void>;
  /** Re-read a topic at another depth without a model call. */
  showTopic: (slug: string, depth?: AnswerDepth, label?: string) => Promise<void>;
  reset: () => void;
  /** Shown after a go-there link closed the panel (< 1440 px): "Back to Ask VCFO". */
  backPill: boolean;
  setBackPill: (show: boolean) => void;
  /** Pending hand-off draft (T5), opened from an answer's "Ask my lead". */
  handoffDraft: string | null;
  setHandoffDraft: (draft: string | null) => void;
}

export const AskContext = createContext<AskContextValue | null>(null);

/** Null outside the provider (managers, Project Leads): callers render nothing. */
export function useAskOptional(): AskContextValue | null {
  return useContext(AskContext);
}

