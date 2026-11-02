'use client';

/**
 * CONTRACT: <ConsoleAsk /> renders the Ask VCFO button (.askfab.mx-fab), the first-visit bubble
 * (.mx-bubble) and the panel (.chat.mx-chat), driven by useConsole().chat / openChat(q?) /
 * closeChat / toggleChat, answering with the REAL assistant (useAskOptional — the AskProvider
 * ConsoleGate mounts; the server scopes a manager to their own projects).
 *
 * Kept from the live staff panel: the real suggestions (as the prototype's chips), the thread
 * (kept while moving between pages, resumed after a reload from sessionStorage, as live), the
 * status line while it works, sourced answer cards with go-there links, Simpler / More detail,
 * Open in Projects, Draft reminder (opens Email with subject and body, never sends), related
 * questions, New conversation, Ctrl J / ⌘J, "Back to Ask VCFO" after a link closed the panel,
 * the arrival pulse on the page a link opens (AskFocusHandler), and the super admin preview.
 * Ask VCFO exists only for the roles live allows (client, manager, admin, super admin): for a
 * Project Lead, or while it is switched off, the button does not show (live) and a question
 * sent from a page gets a plain sentence instead of an answer.
 *
 * Also mounts the updates' live cards (pages/updates/LiveCards), which belong on every page.
 */
import { useEffect, useRef, useState } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { useAskOptional } from '@/components/ask/ask-context';
import { AskFocusHandler } from '@/components/ask/AskFocusHandler';
import { useAskSuggestions } from '@/hooks/ask/use-ask-suggestions';
import { useApp } from '@/context/AppContext';
import { canUseAsk } from '@/lib/ask/access';
import { isAskShortcut } from '@/lib/ask/shortcut';
import { PREVIEW_CLIENT_LINE } from '@/lib/ask/preview';
import { staffBasePathForRole, type StaffBasePath } from '@/lib/auth-routes';
import { useConsole, useFx } from './runtime';
import { Icon, Sym } from './ui';
import { AnswerCard, PastChats, PreviewPicker } from './pages/updates/ask';
import { UpdatesLive } from './pages/updates/LiveCards';
import './css/96-updates.css';

const BUBBLE_KEY = 'vcfo-console-ask-bubble';
const STAFF_BASES: string[] = ['/app/manager', '/app/admin', '/app/super'];

export function ConsoleAsk() {
  const { chat, openChat, closeChat, toggleChat, me, base, go } = useConsole();
  const { user, engagements } = useApp();
  const ask = useAskOptional();
  const enabled = Boolean(ask?.enabled);
  const statusLoading = useIsFetching({ queryKey: ['ask', 'status'] }) > 0;
  const sugg = useAskSuggestions(ask?.shell ?? null, ask?.engagementId ?? null, enabled);
  const suggestions = sugg.data?.suggestions ?? [];
  const { mounted, shown } = useFx(chat.open, 260);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [bubble, setBubble] = useState(false);
  const staffBase = (STAFF_BASES.includes(base) ? base : staffBasePathForRole(user?.role)) as StaffBasePath;

  /* the panel's open state lives in the console; Ask's own flag follows it (it resumes a stored conversation) */
  const lastOpen = useRef(chat.open);
  useEffect(() => {
    if (lastOpen.current === chat.open) return;
    lastOpen.current = chat.open;
    ask?.setOpen(chat.open);
    if (chat.open) {
      setBubble(false);
      try {
        sessionStorage.setItem(BUBBLE_KEY, '1');
      } catch {
        /* storage unavailable */
      }
      window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 80);
    }
  }, [chat.open, ask]);
  /* live: a panel left open stays open after a reload */
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !ask?.open) return;
    restored.current = true;
    if (!chat.open) openChat();
  }, [ask?.open, chat.open, openChat]);

  /* first-visit bubble, once per browser session (prototype) */
  useEffect(() => {
    if (!enabled || !suggestions.length) return;
    try {
      if (!sessionStorage.getItem(BUBBLE_KEY)) setBubble(true);
    } catch {
      /* storage unavailable */
    }
  }, [enabled, suggestions.length]);
  const hideBubble = () => {
    setBubble(false);
    try {
      sessionStorage.setItem(BUBBLE_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  };

  /* Ctrl J / ⌘J (live AskLauncher) */
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!isAskShortcut(e)) return;
      e.preventDefault();
      toggleChat();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, toggleChat]);

  /* a question queued with openChat(q) is asked once */
  const lastAsk = useRef(0);
  useEffect(() => {
    if (!chat.ask || chat.ask.n === lastAsk.current || !enabled || !ask) return;
    lastAsk.current = chat.ask.n;
    void ask.ask({ message: chat.ask.q });
  }, [chat.ask, enabled, ask]);

  /* mascot glows green for a moment when an answer lands; the body follows the thread */
  const count = ask?.thread.length ?? 0;
  const lastCount = useRef(count);
  useEffect(() => {
    const grew = count > lastCount.current;
    lastCount.current = count;
    if (bodyRef.current) bodyRef.current.scrollTop = 1e6;
    if (!grew || ask?.thread[count - 1]?.kind !== 'assistant') return;
    setAnswered(true);
    const t = window.setTimeout(() => setAnswered(false), 1600);
    return () => window.clearTimeout(t);
  }, [count, ask?.thread, ask?.busy, chat.open]);

  const nav = (href: string) => {
    closeChat();
    ask?.setBackPill(true);
    go(href);
  };
  const send = () => {
    const q = text.trim();
    if (!q || !ask || ask.busy) return;
    setText('');
    void ask.ask({ message: q });
  };

  const first = (me?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const manager = user?.role === 'manager';
  const n = engagements.length;
  const sub = manager ? `Answers from your ${n} client${n === 1 ? "'s" : "s'"} live data · read only` : 'Firm-wide · read only';
  const greeting = `Hello${first ? ` ${first}` : ''}. ${
    manager ? 'Ask me about your clients, steps or filings, or pick a question below.' : 'Ask me about any manager, client or filing in the firm, or pick a question below.'
  } I read data only: I never send email or change a project.`;
  const off = !canUseAsk(user?.role)
    ? 'Ask VCFO is for managers, admins and clients. Project leads do not have it.'
    : statusLoading
      ? 'Starting Ask VCFO…'
      : 'Ask VCFO is switched off for the firm right now.';

  return (
    <>
      {enabled ? (
        <button
          type="button"
          className="askfab mx-fab"
          aria-label={ask?.backPill && !chat.open ? 'Back to Ask VCFO' : 'Ask VCFO'}
          aria-expanded={chat.open}
          aria-controls="mx-chat"
          aria-keyshortcuts="Control+J Meta+J"
          title="Ask VCFO (Ctrl J)"
          onClick={toggleChat}
        >
          <Sym id="m-robot" className="bot" />
          <span className="pl">
            <i />
            {ask?.backPill && !chat.open ? 'Back to Ask VCFO' : 'Ask VCFO'}
          </span>
        </button>
      ) : null}
      {enabled && bubble && !chat.open ? (
        <div className="mx-bubble" role="group" aria-label="Suggested questions">
          <b>Ask me anything about your book</b>
          {suggestions.slice(0, 2).map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                hideBubble();
                openChat();
                void ask?.ask({ suggestionId: s.id, label: s.label });
              }}
            >
              {s.label}
            </button>
          ))}
          <button type="button" className="ib x sm" aria-label="Dismiss" onClick={hideBubble}>
            <Icon name="x" />
          </button>
        </div>
      ) : null}
      {mounted ? (
        <section
          id="mx-chat"
          className={'chat fx mx-chat' + (shown && chat.open ? ' show' : '') + (ask?.busy ? ' thinking' : '') + (answered ? ' answered' : '')}
          role="dialog"
          aria-label="Ask VCFO"
        >
          <div className="ch-h">
            <Sym id="m-robot" width={38} height={38} className="mx-mascot" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>Ask VCFO</b>
              <span className="upd-ell">{enabled ? sub : 'Not available'}</span>
            </div>
            <button type="button" className="ib" aria-label="Close" onClick={closeChat}>
              <Icon name="x" />
            </button>
          </div>
          {ask?.preview ? (
            <div className="upd-prev">
              <span className="upd-ell">Client view · {ask.preview.companyName}</span>
              <button type="button" className="link" onClick={() => ask.setPreview(null)}>
                Exit preview
              </button>
            </div>
          ) : null}
          <div className="ch-b" ref={bodyRef} aria-live="polite">
            {enabled && ask ? (
              <>
                <div className="msg bot">{greeting}</div>
                <PastChats />
                {sugg.isError ? (
                  <div className="msg bot upd-merr" role="alert">
                    Could not load the suggested questions. You can still type one.
                  </div>
                ) : null}
                {ask.thread.map((item) =>
                  item.kind === 'user' ? (
                    <div key={item.id} className="msg me">
                      {item.text}
                    </div>
                  ) : item.kind === 'error' ? (
                    <div key={item.id} className="msg bot upd-merr" role="alert">
                      {item.text}
                    </div>
                  ) : item.answer.line === PREVIEW_CLIENT_LINE && ask.shell === 'super' ? (
                    <div key={item.id} className="upd-col">
                      <div className="msg bot">{item.answer.line}</div>
                      <PreviewPicker />
                    </div>
                  ) : (
                    <AnswerCard key={item.id} answer={item.answer} staffBase={staffBase} nav={nav} />
                  ),
                )}
                {ask.busy ? (
                  <div className="upd-think">
                    <div className="msg bot mx-think" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                    <span className="small">{ask.status ?? 'Working…'}</span>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="msg bot">{off}</div>
            )}
          </div>
          {enabled && ask ? (
            <>
              <div className="ch-chips">
                {suggestions.map((s) => (
                  <button key={s.id} type="button" title={s.group} disabled={ask.busy} onClick={() => void ask.ask({ suggestionId: s.id, label: s.label })}>
                    {s.label}
                  </button>
                ))}
                {ask.thread.length ? (
                  <button type="button" title="Start a new conversation" onClick={ask.reset}>
                    New conversation
                  </button>
                ) : null}
              </div>
              <form
                className="ch-in"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <textarea
                  ref={inputRef}
                  className="upd-chin"
                  rows={1}
                  maxLength={2000}
                  value={text}
                  placeholder="Ask about a client, step, lead or filing…"
                  aria-label="Ask VCFO"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button type="submit" className="btn pri" aria-label="Send" disabled={!text.trim() || ask.busy}>
                  <Icon name="send" />
                </button>
              </form>
            </>
          ) : null}
        </section>
      ) : null}
      {enabled ? <AskFocusHandler /> : null}
      <UpdatesLive />
    </>
  );
}
