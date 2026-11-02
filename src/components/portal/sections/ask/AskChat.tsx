'use client';

/**
 * ASK VCFO (prototype a6_rest.js say / ask / openChat; body.txt `.askfab` + `#chat`),
 * with the REAL assistant of the previous portal (AskLauncher):
 *
 *  - suggested questions → POST /api/client/portal/answer (answered from the
 *    client's own overview; `answer: null` = not one of them);
 *  - anything else → Ask VCFO (`useAskOptional().ask`) when it is switched on,
 *    with its thinking status, go-there links, "Save answer" and 👍/👎
 *    (POST /api/client/portal/feedback);
 *  - when it cannot answer → hand-off to the project lead (POST /api/client/handoff).
 *
 * Driven by usePortal().chat / openChat(q) / closeChat / toggleChat: a question
 * queued in `chat.ask` is sent once. Answer buttons navigate inside the portal
 * (intents, the step walkthrough). The log is kept per tab in sessionStorage.
 * The floating button shrinks to `.mini` after 260 px of scrolling.
 *
 * Past chats (owner item F4): the clock button in the header lists the client's
 * earlier Ask VCFO conversations from the server (`ask.history`, which is
 * `GET /api/ask/conversations` through the provider, with localStorage only when
 * the server list fails). Opening one resumes it the way the provider resumes a
 * stored conversation (`openConversation` → `/api/ask/conversations/[id]`), and its
 * messages replace this tab's log. "New chat" clears the log and the conversation.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { saveToLibrary } from '@/hooks/ask/ask-api';
import { AFTER_QUESTIONS, BEFORE_QUESTIONS } from '@/lib/client-portal/answers';
import { effectiveAfter } from '@/lib/client-portal/types';
import { useFx, usePortal } from '../../runtime';
import { Btn, Icon, Sym } from '../../ui';
import { useStepActions } from '../incorporation/actions';
import { answerToLog, chatDate, threadToLog, type Act, type LogItem } from './history';
import { useMascot } from './mascot';
import '../../css/95-ask.css';

/* ---------------------------------------------------------------- log */

const LOG_KEY = 'vcfo.chat.v2';

function readLog(): LogItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(LOG_KEY) ?? '[]') as LogItem[];
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- component */

export function AskChat() {
  const { chat, closeChat, toggleChat, shell, toast, setIntent } = usePortal();
  const ask = useAskOptional();
  const { openStepWizard } = useStepActions();
  const mascot = useMascot();
  const { mounted, shown } = useFx(chat.open, 260);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<LogItem[]>([]);
  const [thinking, setThinking] = useState(false);
  const [mini, setMini] = useState(false);
  /** 'past' shows the list of earlier chats in place of the messages. */
  const [view, setView] = useState<'chat' | 'past'>('chat');
  /** The past chat being loaded, until its messages are in the log. */
  const [loadingPast, setLoadingPast] = useState<string | null>(null);
  const awaitingAsk = useRef<number | null>(null);
  const pastChats = ask?.enabled ? ask.history : [];

  const company = shell?.companyShort ?? 'your company';
  const first = shell?.me.name.trim().split(/\s+/)[0] ?? '';
  const lead = shell?.team.find((p) => p.role === 'Project Lead') ?? shell?.team.find((p) => !p.support);
  const chips = shell && effectiveAfter(shell) ? AFTER_QUESTIONS : BEFORE_QUESTIONS;

  useEffect(() => setLog(readLog()), []);
  const save = useCallback((l: LogItem[]) => {
    setLog(l);
    try {
      sessionStorage.setItem(LOG_KEY, JSON.stringify(l.slice(-60)));
    } catch {
      /* ignore */
    }
  }, []);

  /* the button shrinks after 260 px of scrolling (prototype spy) */
  useEffect(() => {
    let raf = 0;
    const on = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setMini(window.scrollY > 260);
      });
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('scroll', on);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    if (view === 'chat' && bodyRef.current) bodyRef.current.scrollTop = 1e6;
  }, [log, thinking, chat.open, view]);
  useEffect(() => {
    if (chat.open) window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    else setView('chat');
  }, [chat.open]);

  /* the provider's open flag follows this panel, so a stored or chosen conversation loads its messages */
  const askSetOpen = ask?.setOpen;
  useEffect(() => {
    askSetOpen?.(chat.open);
  }, [chat.open, askSetOpen]);

  /* ---------- past chats */
  const openPast = useCallback(
    (id: string) => {
      if (!ask) return;
      awaitingAsk.current = null;
      setThinking(false);
      save([]);
      setLoadingPast(id);
      setView('chat');
      ask.openConversation(id);
    },
    [ask, save],
  );

  /* the chosen chat's messages arrive in the provider thread; they become this tab's log */
  useEffect(() => {
    if (!loadingPast || !ask) return;
    if (ask.conversationId === loadingPast) {
      if (!ask.thread.length) return;
      save(threadToLog(ask.thread, Boolean(ask.preview)));
      setLoadingPast(null);
    } else if (ask.conversationId === null) {
      // the provider dropped it (gone, or not this person's)
      setLoadingPast(null);
      toast('That chat is no longer available');
    }
  }, [loadingPast, ask, ask?.conversationId, ask?.thread, save, toast]);

  const newChat = useCallback(() => {
    awaitingAsk.current = null;
    setThinking(false);
    setLoadingPast(null);
    save([]);
    ask?.reset();
    setView('chat');
    window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
  }, [ask, save]);

  /* ---------- ask */
  const send = useCallback(
    async (q: string) => {
      setView('chat');
      const base = [...readLog(), { r: 'u', t: q } as LogItem];
      save(base);
      setThinking(true);
      try {
        const res = await fetch('/api/client/portal/answer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: q }) });
        const body = res.ok ? ((await res.json()) as { answer: { text: string; kind: 'ok' | 'nan' } | null }) : { answer: null };
        if (body.answer) {
          save([...base, { r: 'a', t: body.answer.text, k: body.answer.kind, q, h: body.answer.kind === 'nan' }]);
          setThinking(false);
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
      save([...base, { r: 'a', t: `I can’t answer that one yet. I can pass it to ${company}’s project lead.`, h: true, k: 'nan' }]);
      setThinking(false);
    },
    [ask, company, save],
  );

  /* Ask VCFO answers land in its thread; copy the new one into the chat log */
  useEffect(() => {
    if (awaitingAsk.current == null || !ask || ask.busy) return;
    const fresh = ask.thread.slice(awaitingAsk.current);
    const last = [...fresh].reverse().find((i) => i.kind !== 'user');
    if (!last) return;
    awaitingAsk.current = null;
    setThinking(false);
    const lastQ = [...ask.thread].reverse().find((i) => i.kind === 'user');
    if (last.kind === 'assistant') {
      save([...readLog(), answerToLog(last.answer, last.messageId, lastQ && lastQ.kind === 'user' ? lastQ.text : undefined, Boolean(ask.preview))]);
    } else {
      save([...readLog(), { r: 'a', t: `I can’t answer that one yet. I can pass it to ${company}’s project lead.`, h: true, k: 'nan' }]);
    }
  }, [ask, ask?.thread, ask?.busy, company, save]);

  /* a question queued through openChat(q) is sent once */
  const lastAsk = useRef(0);
  useEffect(() => {
    if (!chat.ask || chat.ask.n === lastAsk.current) return;
    lastAsk.current = chat.ask.n;
    void send(chat.ask.q);
  }, [chat.ask, send]);

  const handoff = async () => {
    const all = readLog();
    const lastQ = [...all].reverse().find((m) => m.r === 'u') as { t: string } | undefined;
    if (!lastQ) return;
    const context = all
      .slice(-6)
      .map((m) => (m.r === 'u' ? `Client: ${m.t}` : `Ask VCFO: ${m.t}`))
      .join('\n');
    try {
      const res = await fetch('/api/client/handoff', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: lastQ.t, context, conversationId: ask?.conversationId ?? undefined }) });
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
    void fetch('/api/client/portal/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ vote: v, messageId: m.mid ?? undefined, question: m.q, answer: m.t }) }).catch(() => undefined);
  };

  const saveAnswer = async (i: number) => {
    const l = readLog();
    const m = l[i];
    if (!m || m.r !== 'a' || !m.save || !ask?.engagementId) return;
    try {
      await saveToLibrary({ engagementId: ask.engagementId, ...m.save });
      l[i] = { ...m, saved: true };
      save(l);
      toast('Saved to your Library');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the answer');
    }
  };

  const run = (a: Act) => {
    closeChat();
    window.setTimeout(() => {
      if (a.stepId) openStepWizard(a.stepId);
      else if (a.intent) setIntent(a.intent);
    }, 120);
  };

  const submit = () => {
    const v = inputRef.current?.value.trim() ?? '';
    if (!v) {
      inputRef.current?.focus();
      toast('Type a question first, or pick one below');
      return;
    }
    if (inputRef.current) inputRef.current.value = '';
    void send(v);
  };

  return (
    <>
      <button type="button" className={'askfab' + (mini ? ' mini' : '')} aria-label="Ask VCFO" aria-expanded={chat.open} onClick={toggleChat}>
        <Sym id={`m-${mascot}`} className="bot" />
        <span className="pl">
          <i />
          Ask VCFO
        </span>
      </button>
      {mounted ? (
        <section className={'chat fx' + (shown && chat.open ? ' show' : '')} aria-label="Ask VCFO" role="dialog">
          <div className="ch-h">
            <Sym id={`m-${mascot}`} width={38} height={38} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Ask VCFO</b>
              <span>Answers from {company}’s live data</span>
            </div>
            {ask?.enabled ? (
              <button
                type="button"
                className="ib"
                aria-label="Past chats"
                title={view === 'past' ? 'Back to the chat' : 'Past chats'}
                aria-pressed={view === 'past'}
                onClick={() => setView((v) => (v === 'past' ? 'chat' : 'past'))}
              >
                <Icon name={view === 'past' ? 'chat' : 'hist'} />
              </button>
            ) : null}
            <button type="button" className="ib" aria-label="Close" onClick={closeChat}>
              <Icon name="x" />
            </button>
          </div>
          {view === 'past' && ask ? (
            <div className="ch-b ask-past" ref={bodyRef} aria-label="Past chats">
              <div className="ask-past-h">
                <b>Past chats</b>
                <span className="sp" />
                <Btn cls="sm" ico="chat" onClick={newChat}>
                  New chat
                </Btn>
              </div>
              {pastChats.length ? (
                <ul className="ask-past-l">
                  {pastChats.map((h) => (
                    <li key={h.id}>
                      <button type="button" className="ask-past-r" aria-current={h.id === ask.conversationId ? 'true' : undefined} onClick={() => openPast(h.id)}>
                        <span className="ask-past-t" title={h.title}>
                          {h.title}
                        </span>
                        <span className="ask-past-d">
                          {h.messageCount ? `${h.messageCount} · ` : ''}
                          {chatDate(h.at)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="lede">No past chats yet. Every conversation you have here is kept, so you can open it again later.</p>
              )}
            </div>
          ) : (
          <div className="ch-b" ref={bodyRef} aria-live="polite">
            <div className="msg bot">
              Hello{first ? ` ${first}` : ''}. I keep track of {company}’s set-up, registrations and every filing. Ask me anything in plain words.
            </div>
            {loadingPast ? (
              <div className="msg bot" style={{ color: 'var(--ink-3)' }}>
                Opening that chat…
              </div>
            ) : null}
            {log.map((m, i) =>
              m.r === 'u' ? (
                <div key={i} className="msg me">
                  {m.t}
                </div>
              ) : (
                <div key={i} className="msg bot">
                  {m.t}
                  {m.acts?.length || m.h || m.save || m.k === 'ok' ? (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 9, alignItems: 'center' }}>
                      {m.acts?.map((a, j) => (
                        <Btn key={j} cls="pri sm" onClick={() => run(a)}>
                          {a.label}
                          <Icon name="chev" size={14} />
                        </Btn>
                      ))}
                      {m.h ? (
                        <Btn cls="sm" ico="send" onClick={() => void handoff()}>
                          Hand off to {lead?.name ?? 'your project lead'}
                        </Btn>
                      ) : null}
                      {m.save ? (
                        <Btn cls="sm" ico={m.saved ? 'check' : 'lib'} disabled={m.saved} onClick={() => void saveAnswer(i)}>
                          {m.saved ? 'Saved' : 'Save answer'}
                        </Btn>
                      ) : null}
                      {m.k === 'ok' ? (
                        <span className="small" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', marginLeft: 'auto' }} role="group" aria-label="Was this helpful?">
                          Helpful?
                          {(['up', 'down'] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              className="ib"
                              style={{ width: 26, height: 26, borderRadius: 8, opacity: m.fb && m.fb !== v ? 0.35 : 1, color: m.fb === v ? 'var(--ice)' : undefined }}
                              aria-label={v === 'up' ? 'Helpful' : 'Not helpful'}
                              aria-pressed={m.fb === v}
                              disabled={Boolean(m.fb)}
                              onClick={() => vote(i, v)}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={v === 'down' ? { transform: 'rotate(180deg)' } : undefined}>
                                <path d="M7 10v11H4V10Zm0 0 4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17.2 21H7" />
                              </svg>
                            </button>
                          ))}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ),
            )}
            {thinking ? (
              <div className="msg bot" style={{ color: 'var(--ink-3)' }}>
                {ask?.busy && ask.status ? ask.status : 'Thinking…'}
              </div>
            ) : null}
          </div>
          )}
          <div className="ch-chips">
            {chips.map((q) => (
              <button key={q} type="button" onClick={() => void send(q)} disabled={thinking}>
                {q}
              </button>
            ))}
            {log.length || ask?.conversationId ? (
              <button type="button" onClick={newChat} title="Start a new conversation">
                New chat
              </button>
            ) : null}
          </div>
          <form
            className="ch-in"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <input ref={inputRef} placeholder="Ask about a filing, step or paper…" aria-label="Ask VCFO" />
            <button type="submit" className="btn pri" aria-label="Send">
              <Icon name="send" />
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}
