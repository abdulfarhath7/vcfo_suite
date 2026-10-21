'use client';

/**
 * Ask VCFO launcher + chat — React port of prototype proto.js (#vp-launch, #vp-chat).
 *
 *  - The character grips the bottom edge and plays the owner's 20.5 s loop. It
 *    ducks while the page scrolls, while the chat is open, or when it would
 *    cover a control (sampled every second).
 *  - The chat: navy header with the static head, a peek over the window's top
 *    edge once per open, suggested questions, typed questions, What's this?
 *    answer cards, and hand-off to the project lead when it cannot answer.
 *  - Moods only through the antenna colour + motion: teal idle, pulsing while
 *    thinking, green + hop when answered, grey + dip when it cannot answer.
 *
 * Data: suggested questions → /api/client/portal/answer (the client's own
 * overview); anything else → Ask VCFO (`useAskOptional`, when switched on);
 * hand-off → /api/client/handoff.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAskOptional } from '@/components/ask/ask-context';
import { AFTER_QUESTIONS, BEFORE_QUESTIONS } from '@/lib/client-portal/answers';
import { usePortal, type WhatsThisAnswer } from './PortalProvider';
import { VisorCharacter, VisorHead } from './Visor';
import { activeKeyFor, stepHref } from './routes';

type LogItem =
  | { r: 'u'; t: string }
  | { r: 'a'; t: string; k?: 'ok' | 'nan'; h?: boolean; links?: { label: string; href: string }[]; q?: string; mid?: string | null; fb?: 'up' | 'down' }
  | { r: 'w'; w: WhatsThisAnswer; k: 'ok' };

const LOG_KEY = 'vcfo.chat';

function readLog(): LogItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]') as LogItem[];
  } catch {
    return [];
  }
}

const ACT =
  'a[href],button,[role=button],[role=link],[role=tab],[role=checkbox],[role=radio],[role=switch],[role=menuitem],[role=option],input,select,textarea,summary,label,[data-go],[onclick],[contenteditable=""],[contenteditable=true]';

/** Ask VCFO go-there link → a portal path. */
function destHref(dest: { to: string; stepId?: string; focusStepId?: string; slug?: string; itemId?: string }): string {
  switch (dest.to) {
    case 'step':
      return dest.stepId ? stepHref(dest.stepId) : '/app/client/incorporation';
    case 'incorporation':
      return '/app/client/incorporation';
    case 'inbox':
      return '/app/client/notifications';
    case 'compliances':
      return '/app/client/compliances/calendar';
    case 'documents':
      return '/app/client/documents';
    case 'library':
      return dest.itemId ? `/app/client/library/${dest.itemId}` : '/app/client/library';
    case 'learn':
      return dest.slug ? `/app/client/learn/${dest.slug}` : '/app/client/library';
    default:
      return '/app/client/overview';
  }
}

export function AskLauncher() {
  const router = useRouter();
  const portal = usePortal();
  const { chatOpen, openChat, closeChat, pendingQuestion, after, shell, toast } = portal;
  const ask = useAskOptional();
  const launchRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLElement>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pillRef = useRef<HTMLButtonElement>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [thinking, setThinking] = useState(false);
  const [mood, setMood] = useState<'ok' | 'nan' | null>(null);
  const [moodN, setMoodN] = useState(0);
  const [yieldOn, setYield] = useState(false);
  const [lift, setLift] = useState('0px');
  const scrolling = useRef(false);
  const awaitingAsk = useRef<number | null>(null);

  useEffect(() => setLog(readLog()), []);
  const save = useCallback((l: LogItem[]) => {
    setLog(l);
    try {
      sessionStorage.setItem(LOG_KEY, JSON.stringify(l.slice(-60)));
    } catch {
      /* ignore */
    }
  }, []);

  /* first-visit bot note: once per client (client_portal_prefs.bot_note_seen_at),
     and only on Home as in the prototype — on inner pages it would cover rows */
  const pathname = usePathname();
  const onHome = activeKeyFor(pathname ?? '') === 'home';
  const showNote = Boolean(onHome && portal.prefs && !portal.prefs.botNoteSeen && !chatOpen);
  const dismissNote = () => portal.savePrefs({ botNoteSeen: true });
  useEffect(() => {
    if (chatOpen && portal.prefs && !portal.prefs.botNoteSeen) portal.savePrefs({ botNoteSeen: true });
  }, [chatOpen, portal]);

  const lead = shell?.team.find((p) => p.role === 'Project Lead') ?? shell?.team.find((p) => !p.support);
  const company = shell?.companyShort ?? 'your company';
  const questions = after ? AFTER_QUESTIONS : BEFORE_QUESTIONS;

  /* ---------- yield: duck while scrolling, open, or covering a control ---------- */
  const coversControl = useCallback(() => {
    const c = launchRef.current?.querySelector('.vpl-char');
    if (!c || !launchRef.current) return false;
    const r = c.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const seen: Element[] = [];
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 4; j++) {
        const x = r.left + r.width * (0.08 + 0.168 * i);
        const y = r.top + r.height * (0.08 + 0.28 * j);
        const st = document.elementsFromPoint(x, y);
        for (const e of st) {
          if (launchRef.current.contains(e)) continue;
          const a = e.closest(ACT);
          if (!a || seen.includes(a)) break;
          seen.push(a);
          const b = a.getBoundingClientRect();
          const ow = Math.min(b.right, r.right) - Math.max(b.left, r.left);
          const oh = Math.min(b.bottom, r.bottom) - Math.max(b.top, r.top);
          if (ow > 0 && oh > 0 && (ow * oh) / Math.max(1, b.width * b.height) > 0.2) return true;
          break;
        }
      }
    return false;
  }, []);
  const updYield = useCallback(() => {
    const sheet = document.querySelector('.cp')?.classList.contains('sheet-open') ?? false;
    setYield(scrolling.current || chatOpen || sheet || coversControl());
    const l = launchRef.current;
    if (l) setLift(`${Math.max(0, Math.round(window.innerHeight - l.getBoundingClientRect().bottom))}px`);
  }, [chatOpen, coversControl]);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (chatOpen) return;
      scrolling.current = true;
      updYield();
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        scrolling.current = false;
        updYield();
      }, 650);
    };
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', updYield);
    const iv = setInterval(() => {
      if (!document.hidden) updYield();
    }, 1000);
    const first = setTimeout(updYield, 60);
    return () => {
      window.removeEventListener('scroll', onScroll, { capture: true } as EventListenerOptions);
      window.removeEventListener('resize', updYield);
      clearInterval(iv);
      clearTimeout(first);
      if (t) clearTimeout(t);
    };
  }, [chatOpen, updYield]);

  /* ---------- open / close ---------- */
  useEffect(() => {
    document.querySelector('.cp')?.classList.toggle('vp-chat-on', chatOpen);
    if (chatOpen) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 60);
  }, [chatOpen]);
  useEffect(() => {
    if (!chatOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeChat();
        pillRef.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [chatOpen, closeChat]);
  useEffect(() => {
    if (msgsRef.current) msgsRef.current.scrollTop = 1e6;
  }, [log, thinking, chatOpen]);

  const setMoodReplay = (k: 'ok' | 'nan') => {
    setMood(null);
    requestAnimationFrame(() => {
      setMood(k);
      setMoodN((n) => n + 1);
    });
  };

  /* ---------- ask ---------- */
  const ask_ = useCallback(
    async (q: string, w?: WhatsThisAnswer) => {
      const base = [...readLog(), { r: 'u', t: q } as LogItem];
      save(base);
      setThinking(true);
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const delay = (ms: number) => new Promise((r) => setTimeout(r, reduce ? 0 : ms));
      if (w) {
        await delay(900);
        save([...base, { r: 'w', w, k: 'ok' }]);
        setThinking(false);
        setMoodReplay('ok');
        return;
      }
      try {
        const res = await fetch('/api/client/portal/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ question: q }),
        });
        const body = res.ok ? ((await res.json()) as { answer: { text: string; kind: 'ok' | 'nan' } | null }) : { answer: null };
        if (body.answer) {
          await delay(600);
          save([...base, { r: 'a', t: body.answer.text, k: body.answer.kind, q }]);
          setThinking(false);
          setMoodReplay(body.answer.kind);
          return;
        }
      } catch {
        /* fall through to Ask VCFO */
      }
      if (ask?.enabled && ask.engagementId) {
        awaitingAsk.current = ask.thread.length;
        await ask.ask({ message: q });
        return;
      }
      await delay(600);
      save([...base, { r: 'a', t: `I can’t answer that one yet. I can pass it to ${company}’s project lead.`, h: true, k: 'nan' }]);
      setThinking(false);
      setMoodReplay('nan');
    },
    [ask, company, save],
  );

  /* Ask VCFO answers land in its thread; copy the new one into the chat log */
  useEffect(() => {
    if (awaitingAsk.current == null || !ask) return;
    if (ask.busy) return;
    const fresh = ask.thread.slice(awaitingAsk.current);
    const last = [...fresh].reverse().find((i) => i.kind !== 'user');
    if (!last) return;
    awaitingAsk.current = null;
    setThinking(false);
    if (last.kind === 'assistant') {
      const refusal = last.answer.origin === 'refusal';
      const item: LogItem = {
        r: 'a',
        t: last.answer.line + (last.answer.why ? `\n${last.answer.why}` : ''),
        k: refusal ? 'nan' : 'ok',
        h: refusal,
        links: (last.answer.links ?? []).map((l) => ({ label: l.label, href: destHref(l.dest as never) })),
        mid: last.messageId,
        q: [...ask.thread].reverse().find((i) => i.kind === 'user')?.kind === 'user' ? ([...ask.thread].reverse().find((i) => i.kind === 'user') as { text: string }).text : undefined,
      };
      save([...readLog(), item]);
      setMoodReplay(refusal ? 'nan' : 'ok');
    } else {
      save([...readLog(), { r: 'a', t: `I can’t answer that one yet. I can pass it to ${company}’s project lead.`, h: true, k: 'nan' }]);
      setMoodReplay('nan');
    }
  }, [ask, ask?.thread, ask?.busy, company, save]);

  /* What's this? and "Ask VCFO about this" arrive through openChat(q, w) */
  const lastPending = useRef(0);
  useEffect(() => {
    if (!pendingQuestion || pendingQuestion.n === lastPending.current) return;
    lastPending.current = pendingQuestion.n;
    void ask_(pendingQuestion.q, pendingQuestion.w);
  }, [pendingQuestion, ask_]);

  const handoff = async () => {
    const lastQ = [...readLog()].reverse().find((m) => m.r === 'u') as { t: string } | undefined;
    if (!lastQ) return;
    const context = readLog()
      .slice(-6)
      .map((m) => (m.r === 'u' ? `Client: ${m.t}` : m.r === 'a' ? `Ask VCFO: ${m.t}` : ''))
      .filter(Boolean)
      .join('\n');
    try {
      const res = await fetch('/api/client/handoff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: lastQ.t, context, conversationId: ask?.conversationId ?? undefined }),
      });
      if (!res.ok) throw new Error();
      const who = lead?.name ?? 'your project lead';
      save([...readLog(), { r: 'a', t: `Sent to ${who}. You will get a reply by email within 1 working day.` }]);
      toast(`Handed off to ${who}`);
    } catch {
      toast('Could not send it. Please try again.');
    }
  };

  const vote = (i: number, v: 'up' | 'down') => {
    const l = readLog();
    const m = l[i];
    if (!m || m.r !== 'a' || m.fb) return;
    l[i] = { ...m, fb: v };
    save(l);
    toast(v === 'up' ? 'Thanks — glad it helped' : 'Thanks — we will use this to improve the answer');
    void fetch('/api/client/portal/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ vote: v, messageId: m.mid ?? undefined, question: m.q, answer: m.t }),
    }).catch(() => undefined);
  };

  const lastK = [...log].reverse().find((m) => 'k' in m && m.k) as { k?: 'ok' | 'nan' } | undefined;
  const moodNow = mood ?? lastK?.k ?? null;

  return (
    <>
      {/* phone: the chat is a bottom sheet over a dimmed page (s/home/mobile.html scrim) */}
      <div
        id="vp-chat-scrim"
        className={chatOpen ? 'on' : undefined}
        aria-hidden="true"
        onClick={() => {
          closeChat();
          pillRef.current?.focus({ preventScroll: true });
        }}
      />
      {/* The onClick below is not an action: it only keeps clicks inside the chat from reaching the page's outside-click listeners. */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- see above */}
      <section
        id="vp-chat"
        ref={winRef}
        role="dialog"
        aria-label="Ask VCFO chat"
        className={[chatOpen ? 'on' : '', thinking ? 'vpc-think' : '', moodNow === 'ok' ? 'vpc-ok' : '', moodNow === 'nan' ? 'vpc-nan' : ''].filter(Boolean).join(' ')}
        style={{ ['--vpl-lift' as string]: lift }}
        data-mood-n={moodN}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="vpc-pk" aria-hidden="true" key={chatOpen ? 'open' : 'closed'}>
          <VisorCharacter variant="peek" />
        </span>
        {/* phone: bottom-sheet grab handle (s/home/mobile.html .sheet .grab) */}
        <div className="vpc-grab" aria-hidden="true">
          <i />
        </div>
        <div className="vpc-h">
          <span className="vpc-av">
            <VisorHead />
          </span>
          <span>
            <b>Ask VCFO</b>
            <small>Answers from {company}’s project data</small>
          </span>
          <button
            type="button"
            aria-label="Close chat"
            data-close
            onClick={() => {
              closeChat();
              pillRef.current?.focus({ preventScroll: true });
            }}
          >
            <span className="vpc-xt">×</span>
            <svg className="vpc-xi" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="vpc-ms" aria-live="polite" ref={msgsRef}>
          <div className="vpc-m vpc-a">Hello. Ask me anything about {company}’s setup, or pick a question below.</div>
          {log.map((m, i) => {
            if (m.r === 'w') {
              const w = m.w;
              const lbl = w.goLabel ?? (w.href?.includes('/incorporation/step/') ? 'Open this step' : 'Open this page');
              return (
                <div key={i} className="vpc-card" role="group" aria-label={w.title || 'Answer'}>
                  {w.title ? <b className="vpc-ct">{w.title}</b> : null}
                  {w.text ? <p>{w.text}</p> : null}
                  {w.why ? (
                    <div className="vpc-why">
                      <b>Why it matters to {company}</b>
                      {w.why}
                    </div>
                  ) : null}
                  {w.source ? <div className="vpc-src">Source: {w.source}</div> : null}
                  {w.href ? (
                    <button type="button" onClick={() => router.push(w.href!)}>
                      {lbl}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              );
            }
            if (m.r === 'u')
              return (
                <div key={i} className="vpc-m vpc-u">
                  {m.t}
                </div>
              );
            return (
              <div key={i} className="vpc-m vpc-a" style={{ whiteSpace: 'pre-line' }}>
                {m.t}
                {m.links?.map((l) => (
                  <span key={l.href}>
                    <br />
                    <button type="button" onClick={() => router.push(l.href)}>
                      {l.label}
                    </button>
                  </span>
                ))}
                {m.h ? (
                  <>
                    <br />
                    <button type="button" data-handoff onClick={handoff}>
                      Hand off to {lead?.name ?? 'your project lead'}
                    </button>
                  </>
                ) : null}
                {m.k === 'ok' ? (
                  <span className="vpc-fb" role="group" aria-label="Was this helpful?">
                    <span>Helpful?</span>
                    {(['up', 'down'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                        aria-pressed={m.fb === v}
                        disabled={Boolean(m.fb)}
                        onClick={() => vote(i, v)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={v === 'down' ? { transform: 'rotate(180deg)' } : undefined}>
                          <path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7" />
                        </svg>
                      </button>
                    ))}
                  </span>
                ) : null}
              </div>
            );
          })}
          {thinking ? (
            <div className="vpc-m vpc-a vpc-ty">
              <i />
              <i />
              <i />
              {ask?.busy && ask.status ? <span className="vpc-st">{ask.status}</span> : null}
            </div>
          ) : null}
        </div>
        <div className="vpc-sg">
          {questions.map((q) => (
            <button key={q} type="button" data-q={q} onClick={() => void ask_(q)}>
              {q}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = inputRef.current?.value.trim() ?? '';
            if (v) {
              void ask_(v);
              if (inputRef.current) inputRef.current.value = '';
            } else {
              inputRef.current?.focus();
              toast('Type a question first, or pick one above');
            }
          }}
        >
          <input ref={inputRef} aria-label="Type a question" placeholder="Type a question" />
          <button type="submit">Send</button>
        </form>
      </section>
      {showNote ? (
        <div className="vpl-note" role="status">
          <div className="vpl-note-h">
            <span>Hello. Ask me anything about {company}’s setup, or pick a question below.</span>
            <button type="button" aria-label="Dismiss" onClick={dismissNote}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="vpl-note-q">
            {questions.slice(0, 2).map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  dismissNote();
                  openChat(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div id="vp-launch" ref={launchRef} className={[yieldOn ? 'yield' : '', chatOpen ? 'open' : ''].filter(Boolean).join(' ')}>
        <span
          className="vpl-char"
          aria-hidden="true"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (chatOpen) closeChat();
            else openChat();
          }}
        >
          <span className="vpl-lift">
            <VisorCharacter variant="loop" />
          </span>
        </span>
        <button
          ref={pillRef}
          type="button"
          className="vpl-pill"
          aria-label={chatOpen ? 'Close Ask VCFO chat' : 'Open Ask VCFO chat'}
          aria-expanded={chatOpen}
          aria-controls="vp-chat"
          data-notip
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (chatOpen) closeChat();
            else openChat();
          }}
        >
          <i className="vpl-dot" aria-hidden="true" />
          <span className="vpl-t">Ask VCFO</span>
          <span className="vpl-c" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Close
          </span>
        </button>
      </div>
    </>
  );
}
