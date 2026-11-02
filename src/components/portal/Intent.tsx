'use client';

/**
 * Route pages under app/app/client render <ClientRoute intent={…} />:
 *
 *  - inside the client portal (a signed-in client) it sends the intent to the
 *    portal and renders nothing — the one-page portal is already on screen
 *    (the client layout mounts it), so moving between routes never reloads it;
 *  - outside it (a super admin on the staff shell) it renders `legacy`, the
 *    staff-style view that page showed before.
 *
 * `section` intents are handled here (scroll once the shell has loaded);
 * every other kind is handled by the section that owns it (useIntent) once its
 * data is ready: step / phase / board → Incorporation (its walkthrough holds the
 * real step form), notes / anns → Updates, reader → Library, filing → Filings,
 * task → Obligations (the task view). Anything
 * no section picks up within a few seconds falls back to scrolling to the
 * closest section, so a link never leaves the client stranded.
 */
import { Suspense, useEffect, useRef, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePortal, usePortalOptional, type Intent, type SectionKey } from './runtime';

export function ClientRoute({ intent, legacy }: { intent: Intent; legacy?: ReactNode }) {
  const portal = usePortalOptional();
  if (!portal) return <>{legacy ?? null}</>;
  return (
    <Suspense fallback={null}>
      <IntentSender intent={intent} />
    </Suspense>
  );
}

function IntentSender({ intent }: { intent: Intent }) {
  const { setIntent } = usePortal();
  const params = useSearchParams();
  const key = JSON.stringify(intent);
  const step = params.get('step');
  const filing = params.get('filing') ?? params.get('open');
  useEffect(() => {
    // old email links: /app/client/incorporation?step=pre-13, /app/client/compliances/calendar?filing=<id>
    if (step) setIntent({ kind: 'step', stepId: step });
    else if (filing && /^[0-9a-f-]{36}$/i.test(filing)) setIntent({ kind: 'filing', id: filing });
    else setIntent(JSON.parse(key) as Intent);
  }, [key, step, filing, setIntent]);
  return null;
}

const FALLBACK: Record<Exclude<Intent['kind'], 'section'>, SectionKey> = {
  step: 'incorporation',
  phase: 'incorporation',
  board: 'incorporation',
  notes: 'home',
  anns: 'home',
  reader: 'library',
  filing: 'calendar',
  task: 'obligations',
};

/** Mounted once inside the portal root: runs `section` intents and the fallback for unclaimed ones. */
export function IntentRunner() {
  const { intent, consumeIntent, go, shell } = usePortal();
  const ready = Boolean(shell);
  const timer = useRef(0);
  useEffect(() => {
    if (!intent || !ready) return;
    if (intent.kind === 'section') {
      consumeIntent(intent.seq);
      const k = intent.key;
      window.setTimeout(() => go(k), 60);
      return;
    }
    window.clearTimeout(timer.current);
    const seq = intent.seq;
    const k = FALLBACK[intent.kind];
    timer.current = window.setTimeout(() => {
      consumeIntent(seq);
      go(k);
    }, 6000);
    return () => window.clearTimeout(timer.current);
  }, [intent, ready, consumeIntent, go]);
  return null;
}
