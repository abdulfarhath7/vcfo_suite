'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AnswerDepth, AskShell } from '@/data/ask/schema';
import { useApp } from '@/context/AppContext';
import { findEngagementForClientUser } from '@/lib/checklist-state-key';
import { canUseAsk, defaultShellForRole } from '@/lib/ask/access';
import { fetchConversation, fetchTopicAnswer, streamChat } from '@/hooks/ask/ask-api';
import { useAskStatus } from '@/hooks/ask/use-ask-status';
import {
  AskContext,
  type AskInput,
  type AskContextValue,
  type AskPreview,
  type ThreadItem,
} from './ask-context';

/**
 * Ask VCFO state (U3): open flag, the thread and the conversation id live here,
 * above the routed page, so navigating keeps the panel as it was. The
 * conversation id is also kept in sessionStorage so a reload resumes it.
 */

let seq = 0;
const nextId = () => `a${Date.now().toString(36)}${(seq += 1)}`;

function storageKey(shell: AskShell | null, engagementId: string | null) {
  return `vcfo.ask.conv.${shell ?? 'none'}.${engagementId ?? 'firm'}`;
}

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Private mode / blocked storage: resume simply won't survive a reload.
  }
}

export function AskProvider({ children }: { children: ReactNode }) {
  const { user, engagements } = useApp();
  const role = user?.role ?? null;
  const { enabled, firmName, features } = useAskStatus(role);
  const [open, setOpenState] = useState(false);
  const [preview, setPreviewState] = useState<AskPreview | null>(null);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [handoffDraft, setHandoffDraft] = useState<string | null>(null);
  const [backPill, setBackPill] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const shell: AskShell | null = useMemo(() => {
    if (!role || !canUseAsk(role)) return null;
    if (role === 'super_admin' && preview) return 'client';
    return defaultShellForRole(role);
  }, [role, preview]);

  const engagementId = useMemo(() => {
    if (shell !== 'client') return null;
    if (preview) return preview.engagementId;
    if (!user) return null;
    return findEngagementForClientUser(engagements, user)?.id ?? engagements[0]?.id ?? null;
  }, [shell, preview, engagements, user]);

  const key = storageKey(shell, engagementId);

  // A different shell / engagement is a different conversation.
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    abortRef.current?.abort();
    setThread([]);
    setStatus(null);
    setBusy(false);
    setConversationId(readSession(key));
  }, [key]);

  useEffect(() => {
    setConversationId(readSession(key));
    try {
      setOpenState(window.sessionStorage.getItem('vcfo.ask.open') === '1');
    } catch {
      // Storage blocked — the panel just starts closed.
    }
    // Only on mount; the key effect above handles later changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resume a stored conversation the first time the panel shows it.
  const hydrated = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !enabled || !conversationId || thread.length > 0 || hydrated.current === conversationId) return;
    hydrated.current = conversationId;
    fetchConversation(conversationId)
      .then(({ messages }) => {
        setThread(
          messages.map((m) =>
            m.sender === 'user' || !m.answer
              ? { id: m.id, kind: 'user' as const, text: m.text }
              : { id: m.id, kind: 'assistant' as const, messageId: m.id, answer: m.answer },
          ),
        );
      })
      .catch(() => {
        // Gone or not ours: start fresh.
        writeSession(key, null);
        setConversationId(null);
      });
  }, [open, enabled, conversationId, thread.length, key]);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (next) setBackPill(false);
    try {
      window.sessionStorage.setItem('vcfo.ask.open', next ? '1' : '0');
    } catch {
      // Storage blocked — open state is per page load only.
    }
  }, []);

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  const setPreview = useCallback((next: AskPreview | null) => setPreviewState(next), []);

  const ask = useCallback(
    async (input: AskInput) => {
      if (!shell || busy) return;
      if (shell === 'client' && !engagementId) return;
      const text = input.message ?? input.label ?? (input.context ? `What's this: ${input.context.label}?` : '');
      if (!text) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setThread((t) => [...t, { id: nextId(), kind: 'user', text }]);
      setBusy(true);
      setStatus(null);
      try {
        await streamChat(
          {
            conversationId: conversationId ?? undefined,
            shell,
            engagementId: engagementId ?? undefined,
            message: input.message,
            suggestionId: input.suggestionId,
            context: input.context,
            depth: input.depth,
          },
          (event) => {
            if (event.type === 'status') setStatus(event.label);
            else if (event.type === 'answer') {
              setConversationId(event.conversationId);
              writeSession(key, event.conversationId);
              hydrated.current = event.conversationId;
              setThread((t) => [
                ...t,
                { id: nextId(), kind: 'assistant', messageId: event.messageId || null, answer: event.answer },
              ]);
            } else {
              setThread((t) => [...t, { id: nextId(), kind: 'error', text: event.message }]);
            }
          },
          controller.signal,
        );
      } catch (error) {
        if ((error as Error)?.name !== 'AbortError') {
          setThread((t) => [
            ...t,
            { id: nextId(), kind: 'error', text: (error as Error)?.message || 'Ask VCFO is unavailable right now.' },
          ]);
        }
      } finally {
        if (abortRef.current === controller) {
          setBusy(false);
          setStatus(null);
        }
      }
    },
    [shell, busy, engagementId, conversationId, key],
  );

  const showTopic = useCallback(
    async (slug: string, depth?: AnswerDepth, label?: string) => {
      if (label) setThread((t) => [...t, { id: nextId(), kind: 'user', text: label }]);
      try {
        const { answer } = await fetchTopicAnswer(slug, { depth, engagementId: shell === 'client' ? engagementId : null });
        setThread((t) => [...t, { id: nextId(), kind: 'assistant', messageId: null, answer }]);
      } catch (error) {
        setThread((t) => [
          ...t,
          { id: nextId(), kind: 'error', text: (error as Error)?.message || 'Could not load this explanation.' },
        ]);
      }
    },
    [shell, engagementId],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setThread([]);
    setStatus(null);
    setBusy(false);
    setConversationId(null);
    writeSession(key, null);
  }, [key]);

  const value = useMemo<AskContextValue>(
    () => ({
      enabled: enabled && shell !== null,
      firmName,
      features: features ?? {},
      open: open && enabled,
      setOpen,
      toggle,
      shell,
      engagementId,
      preview,
      setPreview,
      thread,
      status,
      busy,
      conversationId,
      ask,
      showTopic,
      reset,
      handoffDraft,
      setHandoffDraft,
      backPill,
      setBackPill,
    }),
    [enabled, firmName, features, open, setOpen, toggle, shell, engagementId, preview, setPreview, thread, status, busy, conversationId, ask, showTopic, reset, handoffDraft, backPill],
  );

  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}
