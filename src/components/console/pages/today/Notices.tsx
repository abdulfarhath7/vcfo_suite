'use client';

/**
 * Today's notices, once per browser session (prototype mxNotices): a client
 * that was incorporated in the last two weeks, what is late with "Ask VCFO
 * why" (the real assistant), and — as the old dashboard's "Your step right
 * now" card did — the first step waiting on your decision. Each slides in
 * under the top bar and leaves on its own after 14 seconds.
 */
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../ui';
import { useConsole } from '../../runtime';
import { daysBetween, dShort, plural, type TodayModel } from './model';

const KEY = 'vcfo-today-notices';

interface Notice {
  id: string;
  tone: '' | 'ok' | 'over';
  ico: IconName;
  title: string;
  sub: string;
  cta: string;
  run: () => void;
}

export function Notices({ m, loading }: { m: TodayModel; loading: boolean }) {
  const { go, base, openChat } = useConsole();
  const [list, setList] = useState<Notice[]>([]);
  const [on, setOn] = useState<string[]>([]);
  const decided = useRef(false);

  useEffect(() => {
    if (loading || decided.current) return;
    decided.current = true;
    let seen = false;
    try {
      seen = Boolean(sessionStorage.getItem(KEY));
      sessionStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable: show them for this visit */
    }
    if (seen) return;
    const out: Notice[] = [];
    const fresh = m.all
      .filter((c) => c.e.incorporationDate && daysBetween(c.e.incorporationDate.slice(0, 10), m.today) >= 0 && daysBetween(c.e.incorporationDate.slice(0, 10), m.today) <= 14)
      .sort((a, b) => (b.e.incorporationDate ?? '').localeCompare(a.e.incorporationDate ?? ''))[0];
    if (fresh) {
      out.push({
        id: 'coi',
        tone: 'ok',
        ico: 'check',
        title: `${fresh.short} is incorporated`,
        sub: `COI ${dShort(fresh.e.incorporationDate!.slice(0, 10), m.today)} · it moved to Compliance`,
        cta: 'Open calendar',
        run: () => go(`${base}/compliances/calendar`),
      });
    }
    const late = m.kpi.over.filter((q) => q.source !== 'filing').length;
    const need = m.queue.filter((q) => q.source === 'filing' && (q.state === 'over' || q.state === 'due')).length;
    if (late || need) {
      out.push({
        id: 'late',
        tone: 'over',
        ico: 'alert',
        title: `${late ? `${plural(late, 'step')} ${late === 1 ? 'is' : 'are'} late` : 'No step is late'}, ${need ? `${plural(need, 'filing')} ${need === 1 ? 'needs' : 'need'} you` : 'no filing needs you'}`,
        sub: 'Start at the top of Focus on Today',
        cta: 'Ask VCFO why',
        run: () => openChat('What is late today?'),
      });
    }
    const mine = m.queue.find((q) => q.source === 'approval');
    if (mine) {
      out.push({
        id: 'mine',
        tone: '',
        ico: 'step',
        title: 'Your step right now',
        sub: `${mine.title} · ${m.byId[mine.clientId]?.short ?? ''}`,
        cta: mine.cta.label,
        run: () => go(mine.cta.href),
      });
    }
    if (out.length) setList(out);
    // once, when the book has loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const shown = list.length > 0;
  useEffect(() => {
    if (!shown) return;
    const timers = [
      ...list.map((n, i) => window.setTimeout(() => setOn((s) => (s.includes(n.id) ? s : [...s, n.id])), 700 + i * 260)),
      window.setTimeout(() => setOn([]), 14_000),
      window.setTimeout(() => setList([]), 14_600),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
    // the list is set once; dismissals only shrink it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  if (!list.length) return null;
  const dismiss = (id: string) => {
    setOn((s) => s.filter((x) => x !== id));
    window.setTimeout(() => setList((l) => l.filter((n) => n.id !== id)), 450);
  };
  return (
    <div className="mx-notices" aria-live="polite">
      {list.map((n) => (
        <div key={n.id} className={'mx-notice' + (n.tone ? ' ' + n.tone : '') + (on.includes(n.id) ? ' in' : '')} role="status">
          <span className="mx-ni">
            <Icon name={n.ico} />
          </span>
          <div className="mx-dt">
            <b>{n.title}</b>
            <span>{n.sub}</span>
            <button
              type="button"
              className="link"
              onClick={() => {
                dismiss(n.id);
                n.run();
              }}
            >
              {n.cta}
              <Icon name="chev" size={16} />
            </button>
          </div>
          <button type="button" className="ib x" aria-label="Dismiss" onClick={() => dismiss(n.id)}>
            <Icon name="x" />
          </button>
        </div>
      ))}
    </div>
  );
}
