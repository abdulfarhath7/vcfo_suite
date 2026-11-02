'use client';

/**
 * Updates — pieces the pop-overs and the pages share: the announcement kind
 * mark, the announcement row (prototype mxAnnRow), who posted it, and the
 * New announcement dialog (prototype mxNewAnn, on the live compose form:
 * kind, message, optional source link; the title is the message's first
 * line unless one is typed).
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import {
  ANNOUNCEMENT_KIND_LABEL,
  ANNOUNCEMENT_KINDS,
  addAnnouncementPopupIds,
  announcementAuthorName,
  type Announcement,
  type AnnouncementKind,
} from '@/lib/notifications/announcements';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Field, LawChip, Select } from '../../ui';
import { annMark, dayTile } from './model';

export function AnnKind({ kind }: { kind: AnnouncementKind }) {
  const m = annMark(kind, ANNOUNCEMENT_KIND_LABEL[kind] ?? 'General');
  if ('law' in m) return <LawChip law={m.law} text={m.text} />;
  return (
    <span className={'pill ' + m.tone} title={m.tone === 'due' ? 'Important: Deadline and Compliance show under Important' : undefined}>
      {m.text}
    </span>
  );
}

/** "From Anita · Manager" for a post, "Official update · CBIC GST notifications" for an approved update or feed. */
export function annFrom(a: Announcement): string {
  if (a.origin === 'feed') return `Official update · ${a.sourceName || a.authorName || 'VCFOSuite'}`;
  const role = a.authorRole ? ROLE_UI_LABEL[a.authorRole as Role] : '';
  return `From ${announcementAuthorName(a)}${role ? ` · ${role}` : ''}`;
}

export function AnnRow({ a, unread, onOpen, compact }: { a: Announcement; unread: boolean; onOpen: () => void; compact?: boolean }) {
  const t = dayTile(a.publishedAt);
  const body = a.body.trim();
  return (
    <button type="button" className={'mx-ann' + (unread ? ' un' : '')} onClick={onOpen}>
      <span className="mx-dtile" aria-hidden="true">
        <b>{t.d}</b>
        <small>{t.mon}</small>
      </span>
      <span className="mx-dt">
        <span className="mx-chips">
          <AnnKind kind={a.kind} />
          <span className="small upd-ell" title={annFrom(a)}>
            {annFrom(a)}
          </span>
        </span>
        <b className="upd-clamp" title={a.title}>
          {a.title}
        </b>
        {!compact && body && body !== a.title ? <span className="upd-clamp">{body}</span> : null}
      </span>
      {unread ? <i className="mx-ud" title="Unread" /> : null}
    </button>
  );
}

function postError(code: string): string {
  if (/https|link|url/i.test(code)) return 'Use a full https:// link to the official page, or leave the link empty.';
  if (code === 'invalid_body') return 'Write the message first.';
  if (/not permitted|forbidden/i.test(code)) return 'Only managers and admins can post announcements.';
  return code.replaceAll('_', ' ');
}

export function ComposeModal() {
  const { closeModal, toast } = useConsole();
  const { user } = useApp();
  const qc = useQueryClient();
  const [kind, setKind] = useState<AnnouncementKind>('general');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const post = async () => {
    const msg = body.trim();
    if (!msg) return setErr('Write the message first.');
    if (link.trim() && !/^https:\/\//i.test(link.trim())) return setErr(postError('link_must_be_https'));
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: (title.trim() || msg.split('\n')[0] || '').slice(0, 200), body: msg, kind, sourceUrl: link.trim() || null }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; announcement?: { id: string } };
      if (!res.ok) throw new Error(data.error ?? 'create_failed');
      // The author never gets their own post as a pop-up (live).
      if (user?.id && data.announcement?.id) addAnnouncementPopupIds(user.id, [data.announcement.id]);
      await qc.invalidateQueries({ queryKey: ['announcements'] });
      await qc.invalidateQueries({ queryKey: ['announcements-head'] });
      closeModal();
      toast('Announcement posted');
    } catch (e) {
      setErr(postError(e instanceof Error ? e.message : 'create_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalBody
      eyebrow="Announcements"
      title="New announcement"
      sub="Everyone who signs in sees it: your team, the other managers and every client."
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn cls="pri" ico="mega" disabled={busy || !body.trim()} onClick={() => void post()}>
            {busy ? 'Posting…' : 'Post'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <Field label="Kind" hint="Deadline and Compliance show under Important">
          <Select<AnnouncementKind> cls="full" label="Kind" value={kind} onChange={setKind} options={ANNOUNCEMENT_KINDS.map((k) => [k, ANNOUNCEMENT_KIND_LABEL[k]] as [AnnouncementKind, string])} />
        </Field>
        <Field label="Title" hint="Optional · the first line of the message is used when this is empty">
          <input className="mx-in" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Message">
          <textarea className="mx-in" rows={5} maxLength={8000} value={body} placeholder="What changed, who it affects, and what the team should do." onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="Source link" hint="Optional · the circular or notice, as an https:// link">
          <input className="mx-in" type="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} />
        </Field>
      </div>
      {err ? (
        <p className="upd-err" role="alert">
          {err}
        </p>
      ) : null}
    </ModalBody>
  );
}
