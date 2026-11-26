'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { CardAgentContext, type CardAgentCard, type CardAgentContextValue } from './card-agent-context';

const cardKey = (c: CardAgentCard | null) => (c ? [c.engagementId, c.stepId, c.obligationId, c.instanceId].join('|') : '');

/**
 * Holds the card the page registered and whether its panel is open. Mounted inside Ask VCFO's
 * provider in the staff shell only (`AskShellMount`), so the two corner panels can close each
 * other: only one is open at a time. `enabled` is false for every role that has no card agents
 * (clients, developers); pages still call `useCardAgent`, which then does nothing.
 */
export function CardAgentProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ask = useAskOptional();
  const [card, setCard] = useState<CardAgentCard | null>(null);
  const [open, setOpenState] = useState(false);
  const askOpen = Boolean(ask?.open);
  const askSetOpen = ask?.setOpen;

  const register = useCallback((next: CardAgentCard) => {
    const token = { ...next };
    setCard(token);
    return () => setCard((cur) => (cur === token ? null : cur));
  }, []);

  const setOpen = useCallback(
    (next: boolean) => {
      setOpenState(next);
      if (next) askSetOpen?.(false);
    },
    [askSetOpen],
  );

  // Opening the Ask VCFO chat closes the card panel.
  useEffect(() => {
    if (askOpen) setOpenState(false);
  }, [askOpen]);

  // A different card (or none) closes the panel: it belonged to the page that was open.
  const key = cardKey(card);
  useEffect(() => {
    setOpenState(false);
  }, [key]);

  // Esc closes the panel unless something above it took the key first.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setOpenState(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const value = useMemo<CardAgentContextValue>(
    () => ({ card, register, open: open && Boolean(card), setOpen, toggle: () => setOpen(!open) }),
    [card, register, open, setOpen],
  );

  if (!enabled) return <>{children}</>;
  return <CardAgentContext.Provider value={value}>{children}</CardAgentContext.Provider>;
}
