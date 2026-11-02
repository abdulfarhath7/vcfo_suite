'use client';

/**
 * "Past chats" inside the console's Ask VCFO panel (owner item F4): a fold under the greeting
 * that lists the person's earlier conversations from the server (`ask.history` is
 * `GET /api/ask/conversations` through the provider's React Query; localStorage only when the
 * server list fails), newest first. Opening one resumes it the way a stored conversation is
 * resumed (`ask.openConversation` → `/api/ask/conversations/[id]`); "New chat" is `ask.reset`.
 * Mounted once by ConsoleAsk inside `.ch-b`.
 */
import { useState } from 'react';
import { useAskOptional } from '@/components/ask/ask-context';
import { chatDate } from '@/components/portal/sections/ask/history';
import { Icon } from '../../ui';
import '../../css/96-ask.css';

export function PastChats() {
  const ask = useAskOptional();
  const [open, setOpen] = useState(false);
  if (!ask?.enabled) return null;
  const n = ask.history.length;
  const openChat = (id: string) => {
    ask.openConversation(id);
    setOpen(false);
  };
  const newChat = () => {
    ask.reset();
    setOpen(false);
  };
  return (
    <details className="upd-past" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary aria-label={`Past chats${n ? `, ${n}` : ''}`}>
        <Icon name="hist" />
        <b>Past chats</b>
        <span className="small">{n ? String(n) : 'none yet'}</span>
        <Icon name="down" className="upd-past-cv" />
      </summary>
      <div className="upd-past-b">
        <button type="button" className="btn sm" onClick={newChat} disabled={ask.busy}>
          <Icon name="chat" />
          New chat
        </button>
        {n ? (
          <ul className="mx-drows upd-past-l" aria-label="Past chats">
            {ask.history.map((h) => (
              <li key={h.id}>
                <button type="button" className="mx-drow" aria-current={h.id === ask.conversationId ? 'true' : undefined} onClick={() => openChat(h.id)}>
                  <span className="mx-dt">
                    <b className="upd-ell" title={h.title}>
                      {h.title}
                    </b>
                    <span>
                      {h.messageCount ? `${h.messageCount} message${h.messageCount === 1 ? '' : 's'} · ` : ''}
                      {chatDate(h.at)}
                    </span>
                  </span>
                  <Icon name="chev" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <span className="small">No past chats yet. Every conversation is kept here, so you can open it again.</span>
        )}
      </div>
    </details>
  );
}
