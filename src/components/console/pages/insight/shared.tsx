'use client';

/**
 * Insight pages — the bits Analytics, Audit log and Settings share: seat-aware
 * links (README: every link from `useConsole().base` or the seat's nav), the
 * "book has arrived" flag, the error box with Try again, and the live toast
 * wording ("Title — description").
 */
import { useCallback } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import { stepSlugForItemId } from '@/lib/slug';
import { useConsole } from '../../runtime';
import { navLeaves, SEAT_NAV } from '../../nav';
import { Btn, Icon } from '../../ui';
import '../../css/96-insight.css';

export const clientHref = (base: string, e: Pick<Engagement, 'id' | 'slug'>): string => `${base}/projects/${e.slug ?? e.id}`;
export const stepHref = (base: string, e: Pick<Engagement, 'id' | 'slug'>, itemId: string): string => `${clientHref(base, e)}/step/${stepSlugForItemId(itemId)}`;

/** The href of one of this seat's nav pages ('clients', 'filings', 'leads' …), else `${base}${fallback}`. */
export function useNavHref(): (key: string, fallback: string) => string {
  const { seat, base } = useConsole();
  return useCallback((key: string, fallback: string) => navLeaves(SEAT_NAV[seat] ?? []).find((k) => k.key === key)?.href ?? `${base}${fallback}`, [seat, base]);
}

/** The book has arrived: engagements settled and, when there are any, their checklist index. */
export function useBookReady(): boolean {
  const { user, engagements, engagementsSettled } = useApp();
  useIsFetching({ queryKey: ['checklist-index', user?.id] });
  const qc = useQueryClient();
  const indexSettled = qc
    .getQueryCache()
    .findAll({ queryKey: ['checklist-index', user?.id] })
    .some((q) => q.state.data !== undefined || q.state.status === 'error');
  return engagementsSettled && (engagements.length === 0 || indexSettled);
}

/** The live toasts read "Title — description"; the console shows them in its own toast. */
export function useSay(): (title: string, desc?: string) => void {
  const { toast } = useConsole();
  return useCallback((title: string, desc?: string) => toast(desc ? `${title} — ${desc}` : title), [toast]);
}

export function ErrorBox({ title, detail, onRetry }: { title: string; detail?: string; onRetry?: () => void }) {
  return (
    <div className="mx-empty ins-err" role="alert">
      <Icon name="alert" />
      <b>{title}</b>
      {detail ? <span>{detail}</span> : null}
      {onRetry ? (
        <div className="mx-chips">
          <Btn cls="sm" onClick={onRetry}>
            Try again
          </Btn>
        </div>
      ) : null}
    </div>
  );
}

export function EmptyNote({ icon = 'check', title, sub }: { icon?: 'check' | 'search' | 'hist' | 'grid' | 'calc'; title: string; sub?: string }) {
  return (
    <div className="mx-empty">
      <Icon name={icon} />
      <b>{title}</b>
      {sub ? <span>{sub}</span> : null}
    </div>
  );
}
