'use client';

import { useEffect, useMemo, useReducer } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import { fetchBoardResolutionInDb } from '@/lib/engagements-db';
import { clientBoardResolutionPath } from '@/lib/project-step-path';

interface ClientBoardResolutionCardProps {
  engagement: Engagement;
}

type CardState = { loading: true } | { loading: false; finalized: boolean };

type CardAction =
  | { type: 'loaded'; finalized: boolean }
  | { type: 'failed' };

function cardReducer(_state: CardState, action: CardAction): CardState {
  switch (action.type) {
    case 'loaded':
      return { loading: false, finalized: action.finalized };
    case 'failed':
      return { loading: false, finalized: false };
    default:
      return _state;
  }
}

/** Shown on client incorporation/documents when board resolution is finalized. */
export function ClientBoardResolutionCard({ engagement }: ClientBoardResolutionCardProps) {
  const [state, dispatch] = useReducer(cardReducer, { loading: true });

  useEffect(() => {
    let cancelled = false;
    void fetchBoardResolutionInDb(engagement.id)
      .then((doc) => {
        if (!cancelled) {
          dispatch({
            type: 'loaded',
            finalized: doc?.status === 'finalized' && Boolean(doc.storagePath?.trim()),
          });
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [engagement.id]);

  if (state.loading || !('finalized' in state) || !state.finalized) return null;

  return (
    <Link
      href={clientBoardResolutionPath()}
      className="flex items-center gap-3 rounded-md border border-orange/30 bg-orange/5 px-4 py-3 mb-6 hover:border-orange/50 transition-colors"
    >
      <FileText className="w-5 h-5 text-orange-600 shrink-0" />
      <div>
        <p className="text-[13px] font-medium text-ink">Board resolution ready</p>
        <p className="text-[11px] text-text-tertiary">
          Download the certified Word document, sign it, and upload the signed copy
        </p>
      </div>
    </Link>
  );
}
