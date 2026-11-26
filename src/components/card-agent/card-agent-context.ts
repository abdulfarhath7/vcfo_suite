'use client';

import { createContext, useContext } from 'react';

/** The card a page has open: a checklist step or one client's compliance obligation. */
export interface CardAgentCard {
  engagementId: string;
  stepId: string | null;
  obligationId: string | null;
  /** One filing period of the obligation, when the page shows one. */
  instanceId: string | null;
}

export interface CardAgentContextValue {
  /** The card the page registered with `useCardAgent`, or null on a page without one. */
  card: CardAgentCard | null;
  /** Registers the page's card; the returned function unregisters it. */
  register: (card: CardAgentCard) => () => void;
  /** The card agent panel. Opening it closes the Ask VCFO chat, and opening the chat closes it. */
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

export const CardAgentContext = createContext<CardAgentContextValue | null>(null);

/** Null outside the staff shell (clients, developers, tests without the shell). */
export function useCardAgentContext(): CardAgentContextValue | null {
  return useContext(CardAgentContext);
}
