'use client';

/**
 * Team — prototype s/team/team_redesign.dc.html (+ team_invite, team_handoff).
 * SBC cards from the shell (`usePortal().shell.team`), Northwind's people and
 * pending invites from `/api/client/team`, hand-off / substitute through the
 * existing `/api/engagements/:id/clients/substitute`.
 */
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { usePortal } from '../../PortalProvider';
import type { ClientPortalContact } from '@/lib/client-portal/types';
import type { ClientTeamView } from '@/db/repositories/client-team';
import {
  AskWhy,
  BotBubble,
  CloseBtn,
  Dialog,
  P,
  Seg,
  Svg,
  api,
  avatarColor,
  contactHref,
  copyText,
  initialsOf,
  makeTempPassword,
  prettyPhone,
  shortDate,
  useSkeleton,
} from './common';
import '../../css/team-00-contract.css';
import '../../css/team-team.css';

const TEAM_KEY = ['client-portal', 'team'] as const;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Row = {
  key: string;
  k: 'p' | 'm' | 'i';
  name: string;
  email: string;
  when: string;
  you: boolean;
  userId?: string;
  inviteId?: string;
};

export function TeamPage() {
  const { shell, toast, openChat } = usePortal();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: TEAM_KEY, queryFn: () => api<ClientTeamView>('/api/client/team') });
  const sk = useSkeleton(q.isLoading);
  const [tab, setTab] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [subFor, setSubFor] = useState<Row | null>(null);

  const company = shell?.companyShort ?? 'your company';
  const isPrimary = q.data?.isPrimary ?? false;

  const rows: Row[] = useMemo(() => {
    const d = q.data;
    if (!d) return [];
    return [
      ...d.people.map<Row>((p) => ({
        key: p.userId,
        k: p.role === 'primary' ? 'p' : 'm',
        name: p.name,
        email: p.email,
        when: `Since ${shortDate(p.since)}`,
        you: p.you,
        userId: p.userId,
      })),
      ...d.invites.map<Row>((i) => ({
        key: i.id,
        k: 'i',
        name: i.name,
        email: i.email,
        when: `Sent ${shortDate(i.sentAt)}`,
        you: false,
        inviteId: i.id,
      })),
    ];
  }, [q.data]);

  const TABS: Array<[string, Row['k'] | null]> = [
    ['All', null],
    ['Primary', 'p'],
    ['Members', 'm'],
    ['Invited', 'i'],
  ];
  const key = TABS[tab][1];
  const shown = rows.filter((r) => !key || r.k === key);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => api<{ team: ClientTeamView; email?: string }>('/api/client/team', { method: 'POST', json: body }),
    onSuccess: (d) => qc.setQueryData(TEAM_KEY, d.team),
  });

  const openInvite = () => {
    if (!isPrimary) {
      toast('Only the Primary contact can invite');
      return;
    }
    setInviteOpen(true);
  };

  const resend = (r: Row) => {
    const pw = makeTempPassword();
    act.mutate(
      { action: 'resend', inviteId: r.inviteId, tempPassword: pw },
      {
        onSuccess: (d) => {
          toast(d.email === 'sent' ? `Invite sent again to ${r.email}` : `New sign-in ready for ${r.email} · email not sent`);
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'Could not resend the invite'),
      },
    );
  };
  const cancel = (r: Row) => {
    act.mutate(
      { action: 'cancel', inviteId: r.inviteId },
      {
        onSuccess: () =>
          toast(`Invite for ${r.name} cancelled`, {
            undo: () => act.mutate({ action: 'restore', inviteId: r.inviteId }),
          }),
        onError: (e) => toast(e instanceof Error ? e.message : 'Could not cancel the invite'),
      },
    );
  };

  const team: ClientPortalContact[] = shell?.team ?? [];

  return (
    <div className="cp-team">
      <main className="pg tb-wrap stag tp-team">
        <div className="ph">
          <div className="acts">
            <button
              type="button"
              className="btn btn-n"
              data-tip={isPrimary ? undefined : 'Only the Primary contact can invite'}
              aria-disabled={!isPrimary}
              onClick={openInvite}
            >
              <Svg d={P.userPlus} join={false} />
              Invite
            </button>
          </div>
        </div>

        <section className="tb-cards">
          {team.length === 0 && !shell
            ? [0, 1, 2].map((i) => <div key={i} className="card sk" style={{ height: 150 }} />)
            : team.map((p) => <SbcCard key={p.id} p={p} />)}
        </section>

        <section className="card">
          <div className="tb-ph">
            <span className="ic" style={{ background: 'var(--violet)' }}>
              <Svg d={P.users} join={false} />
            </span>
            <h2 className="h3">People from {company}</h2>
            <Seg
              tabs={TABS.map(([l, k]) => ({ label: l, cnt: rows.filter((r) => !k || r.k === k).length }))}
              active={tab}
              onPick={(i) => {
                if (i === tab) toast(`Already showing ${TABS[i][0].toLowerCase()}`);
                setTab(i);
              }}
              label="Filter people"
            />
          </div>
          <div style={{ borderTop: '1px solid var(--hair)' }}>
            {q.isLoading ? (
              sk ? (
                [0, 1, 2].map((i) => (
                  <div key={i} className="row" style={{ padding: '12px 16px' }}>
                    <span className="sk" style={{ width: 36, height: 36, borderRadius: 99 }} />
                    <div style={{ flex: 1 }}>
                      <div className="sk" style={{ width: '40%', height: 12 }} />
                      <div className="sk" style={{ width: '60%', height: 10, marginTop: 6 }} />
                    </div>
                  </div>
                ))
              ) : null
            ) : q.isError ? (
              <BotBubble padding="32px 16px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  Could not load the team.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn btn-o btn-sm" onClick={() => void q.refetch()}>
                    Try again
                  </button>
                </div>
              </BotBubble>
            ) : shown.length === 0 ? (
              <BotBubble padding="32px 16px">
                <div className="rt" style={{ fontWeight: 700 }}>
                  {tab === 3 ? 'No pending invites.' : 'No one here yet.'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button type="button" className="btn btn-o btn-sm" onClick={openInvite} aria-disabled={!isPrimary}>
                    Invite
                  </button>
                  <AskWhy q={tab === 3 ? 'Why are there no pending invites?' : 'Who can see our project?'} />
                </div>
              </BotBubble>
            ) : (
              shown.map((r) => {
                const roleStyle =
                  r.k === 'p'
                    ? { background: 'var(--navy)', color: '#fff' }
                    : r.k === 'i'
                      ? { background: 'var(--due-light)', color: 'var(--due-text)' }
                      : { background: 'var(--raised)', color: 'var(--muted)' };
                const role = r.k === 'p' ? 'Primary' : r.k === 'i' ? 'Invite sent' : 'Member';
                const av =
                  r.k === 'i'
                    ? { background: 'var(--up)', color: 'var(--fg)' }
                    : r.you
                      ? { background: 'var(--primary-fill,var(--primary))' }
                      : { background: avatarColor(r.key) };
                return (
                  <div key={r.key} className="row" style={{ padding: '12px 16px' }}>
                    <span className="av" style={{ width: 36, height: 36, fontSize: 12, ...av }}>
                      {initialsOf(r.name)}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="rt">{r.name}</span>
                        {r.you ? (
                          <span className="chip" style={{ background: 'var(--gold-soft)', color: 'var(--gold-text)' }}>
                            {company}
                          </span>
                        ) : null}
                        <span className="chip tb-m tb-iflex" style={roleStyle}>
                          {role}
                        </span>
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.email}
                      </div>
                      <div className="mono tb-m" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                        {r.when}
                      </div>
                    </div>
                    <span className="chip tb-d" style={roleStyle}>
                      {role}
                    </span>
                    <span className="mono tb-d" style={{ width: 110, fontSize: 11.5, color: 'var(--muted)', textAlign: 'right', flex: 'none' }}>
                      {r.when}
                    </span>
                    <div style={{ display: 'flex', gap: 6, minWidth: 76, flex: 'none', justifyContent: 'flex-end' }}>
                      {r.k === 'i' ? (
                        isPrimary ? (
                          <>
                            <button
                              type="button"
                              className="ibtn"
                              aria-label={`Resend invite to ${r.email}`}
                              data-tip={`Resend invite to ${r.email}`}
                              disabled={act.isPending}
                              onClick={() => resend(r)}
                            >
                              <Svg d={P.resend} sw={1.8} />
                            </button>
                            <button
                              type="button"
                              className="ibtn"
                              aria-label="Cancel invite"
                              data-tip="Cancel invite"
                              disabled={act.isPending}
                              onClick={() => cancel(r)}
                            >
                              <Svg d={P.x} sw={1.8} join={false} />
                            </button>
                          </>
                        ) : null
                      ) : r.you || isPrimary ? (
                        <button
                          type="button"
                          className="ibtn"
                          aria-label={`Substitute ${r.name}`}
                          data-tip={`Substitute ${r.name}`}
                          onClick={() => setSubFor(r)}
                        >
                          <Svg d={P.swap} sw={1.8} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {inviteOpen ? (
        <InviteDialog
          company={company}
          onClose={() => setInviteOpen(false)}
          onSend={(name, email, pw) =>
            new Promise<void>((resolve, reject) => {
              act.mutate(
                { action: 'invite', name, email, tempPassword: pw },
                {
                  onSuccess: (d) => {
                    const inv = (d as unknown as { invite?: { id: string } }).invite;
                    setInviteOpen(false);
                    setTab(3);
                    toast(
                      d.email === 'attached'
                        ? `${name} now has access to ${company}`
                        : d.email === 'sent'
                          ? `Invite sent to ${email}`
                          : `Invite ready for ${email} · email not sent, share the sign-in yourself`,
                      inv ? { undo: () => act.mutate({ action: 'cancel', inviteId: inv.id }) } : undefined,
                    );
                    resolve();
                  },
                  onError: (e) => reject(e),
                },
              );
            })
          }
        />
      ) : null}
      {subFor ? (
        <SubstituteDialog
          row={subFor}
          company={company}
          engagementId={q.data?.engagementId ?? shell?.engagementId ?? ''}
          onClose={() => setSubFor(null)}
          onDone={() => {
            setSubFor(null);
            void qc.invalidateQueries({ queryKey: TEAM_KEY });
          }}
          openChat={openChat}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SbcCard({ p }: { p: ClientPortalContact }) {
  const { toast } = usePortal();
  const support = p.support || p.role === 'SBC help desk';
  const role = support ? 'Customer support' : p.role;
  /* The help desk name/email/phone come from CLIENT_SUPPORT_* env; when those are
     unset the card still reads as a person card (no repeated "Customer support",
     no missing contact line) so it keeps the height of the other two. */
  const name = support && /^customer support$/i.test(p.name.trim()) ? 'SBC help desk' : p.name;
  const line = support
    ? [p.email, prettyPhone(p.phoneE164)].filter(Boolean).join(' · ') || 'Contact details coming soon'
    : (p.email ?? '');
  const bg = support ? 'var(--navy-3)' : avatarColor(p.id);
  const chip = support
    ? { background: 'var(--prog-light)', color: 'var(--prog-text)' }
    : { background: 'var(--navy)', color: '#fff' };
  const btn = (kind: 'wa' | 'call' | 'email' | 'teams', label: string) => {
    const href = contactHref(kind, p);
    return {
      href: href ?? '#',
      target: href && (kind === 'wa' || kind === 'teams') ? '_blank' : undefined,
      rel: 'noopener noreferrer',
      'aria-label': `${label} ${p.name}`,
      onClick: (e: React.MouseEvent) => {
        if (!href) {
          e.preventDefault();
          toast(`${label} is not set up for ${p.name} yet`);
        }
      },
    };
  };
  return (
    <article className="card t" style={{ padding: 18, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          aria-label={`${p.name} photo`}
          role="img"
          style={{
            width: 60,
            height: 60,
            borderRadius: 99,
            flex: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            font: '700 18px Space Grotesk',
            boxShadow: `0 0 0 3px var(--panel),0 0 0 5px ${support ? 'var(--border)' : 'var(--gold)'}`,
            background: bg,
            overflow: 'hidden',
          }}
        >
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 99 }} />
          ) : support ? (
            initialsOf(name).slice(0, 1)
          ) : (
            p.initials
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <span className="chip" style={chip}>
            {role}
          </span>
          <div style={{ font: '700 16px Manrope', marginTop: 6, color: 'var(--navy-ink,var(--navy))' }}>{name}</div>
          <div className="mono tb-line" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
            {line}
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
        <a className="btn wa tb-cbtn" style={{ height: 38, padding: 0 }} {...btn('wa', 'WhatsApp')}>
          <Svg d={P.wa} size={17} sw={1.8} />
        </a>
        <a className="btn btn-o tb-cbtn" style={{ height: 38, padding: 0, color: 'var(--navy-ink,var(--navy))' }} {...btn('call', 'Call')}>
          <Svg d={P.call} size={17} sw={1.8} />
        </a>
        <a className="btn btn-o tb-cbtn" style={{ height: 38, padding: 0, color: 'var(--navy-ink,var(--navy))' }} {...btn('email', 'Email')}>
          <Svg d={P.mail} size={17} sw={1.8} />
        </a>
        <a
          className="btn btn-o tb-cbtn"
          style={{ height: 38, padding: 0, color: 'light-dark(oklch(48% 0.14 280), oklch(80.8% 0.098 280))' }}
          {...btn('teams', 'Teams')}
        >
          <Svg d={P.teams} size={17} sw={1.8} />
        </a>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */

/** Sign-in box: the set-password link is not built yet, so the one-off temporary password shows (DECISIONS). */
function SignInBox({ pw, email, label }: { pw: string; email: string; label: string }) {
  const { toast } = usePortal();
  return (
    <div className="fl">
      <span>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)' }}>
        <span className="ic" style={{ background: 'var(--navy)' }}>
          <Svg d={P.link} size={14} />
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="rt" style={{ display: 'block' }}>
            Temporary password by email
          </span>
          <span className="cap mono">{pw}</span>
        </span>
        <button
          type="button"
          className="ibtn"
          aria-label="Copy the sign-in"
          data-tip="Copy the sign-in"
          onClick={async () => {
            const ok = await copyText(
              `Sign in to VCFO Suite at ${window.location.origin}/login\nEmail: ${email || '(their work email)'}\nTemporary password: ${pw}`,
            );
            toast(ok ? 'Sign-in copied' : 'Could not copy — select the password instead');
          }}
        >
          <Svg d={P.copy} sw={1.8} />
        </button>
      </div>
    </div>
  );
}

function InviteDialog({
  company,
  onClose,
  onSend,
}: {
  company: string;
  onClose: () => void;
  onSend: (name: string, email: string, pw: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw] = useState(makeTempPassword);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && EMAIL_OK.test(email.trim());
  const send = async () => {
    if (!valid) {
      setErr(!name.trim() ? 'Enter a name.' : 'Enter a valid work email.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await onSend(name.trim(), email.trim(), pw);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not send the invite');
      setBusy(false);
    }
  };
  return (
    <Dialog labelledBy="inv-t" onClose={onClose} tp="tp-team">
      <div className="dlg-h">
        <span className="ic" style={{ background: 'var(--navy)' }}>
          <Svg d={P.userPlus} join={false} />
        </span>
        <h2 id="inv-t" style={{ margin: 0, font: '700 16px Manrope', color: 'var(--navy-ink,var(--navy))' }}>
          Invite a colleague
        </h2>
        <CloseBtn onClick={onClose} />
      </div>
      <form
        className="dlg-b"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          <label className="fl">
            Name
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <label className="fl">
            Work email
            <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
        </div>
        <SignInBox pw={pw} email={email.trim()} label="Sign-in" />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, background: 'var(--raised)' }}>
          <span className="chip" style={{ background: 'var(--raised)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
            Member
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Sees everything on {company}. Cannot invite.</span>
        </div>
        {err ? (
          <div className="tb-err" role="alert">
            {err}
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
      <div className="dlg-f">
        <button type="button" className="btn btn-g" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-n" disabled={busy} onClick={() => void send()}>
          <Svg d={P.send} />
          Send invite
        </button>
      </div>
    </Dialog>
  );
}

function SubstituteDialog({
  row,
  company,
  engagementId,
  onClose,
  onDone,
}: {
  row: Row;
  company: string;
  engagementId: string;
  onClose: () => void;
  onDone: () => void;
  openChat: (q?: string) => void;
}) {
  const { toast } = usePortal();
  const { signOut } = useApp();
  const self = row.you;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const [pw] = useState(makeTempPassword);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const first = name.trim().split(/\s+/)[0] || 'them';
  const valid = EMAIL_OK.test(email.trim()) && (!self || ok);
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setErr('');
    try {
      const d = await api<{ substituted?: { actorLostAccess: boolean; name: string } }>(
        `/api/engagements/${encodeURIComponent(engagementId)}/clients/substitute`,
        {
          method: 'POST',
          json: { replaceUserId: row.userId, email: email.trim(), fullName: name.trim() || undefined, password: pw },
        },
      );
      const who = d.substituted?.name || name.trim() || email.trim();
      if (d.substituted?.actorLostAccess) {
        toast(`Handed off to ${who}`);
        setTimeout(() => void signOut(), 1200);
        return;
      }
      toast(`${row.name} replaced by ${who}`);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not complete the hand-off');
      setBusy(false);
    }
  };
  const titleId = 'ho-t';
  return (
    <Dialog labelledBy={titleId} width={500} onClose={onClose} tp="tp-team">
      <div className="dlg-h">
        <span className="ic" style={{ background: self ? 'var(--over-chip)' : 'var(--navy)' }}>
          <Svg d={P.swap} />
        </span>
        <h2 id={titleId} style={{ margin: 0, font: '700 16px Manrope', color: 'var(--navy-ink,var(--navy))' }}>
          {self ? 'Hand off your seat' : `Substitute ${row.name}`}
        </h2>
        <CloseBtn onClick={onClose} />
      </div>
      <form
        className="dlg-b"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 28px 1fr', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
            <span className="av" style={{ width: 34, height: 34, fontSize: 11, background: self ? 'var(--primary-fill,var(--primary))' : avatarColor(row.key) }}>
              {initialsOf(row.name)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.name}</div>
              <div className="cap" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {row.k === 'p' ? 'Primary' : 'Member'} · {company}
              </div>
            </div>
          </div>
          <span style={{ color: 'var(--over)' }}>
            <Svg d={P.arrowR} size={24} />
          </span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: 10,
              border: '1.5px dashed var(--navy-3)',
              borderRadius: 8,
              background: 'var(--primary-light)',
            }}
          >
            <span className="av" style={{ width: 34, height: 34, fontSize: 11, background: 'var(--navy)' }}>
              {name.trim() ? initialsOf(name) : '?'}
            </span>
            <div style={{ minWidth: 0 }}>
              <div className="rt" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.trim() || 'New person'}</div>
              <div className="cap" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.k === 'p' ? 'New Primary' : 'New Member'}</div>
            </div>
          </div>
        </div>
        {self ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--over-light)',
              color: 'var(--over-text)',
              fontWeight: 700,
              fontSize: 12.5,
            }}
          >
            <Svg d={P.warn} size={16} />
            You lose access to {company} right after this.
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 12 }}>
          <label className="fl">
            Name
            <input className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </label>
          <label className="fl">
            Work email
            <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </label>
        </div>
        <SignInBox pw={pw} email={email.trim()} label={`Sign-in for ${first}`} />
        {self ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 600 }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--navy)' }} />
            I understand I will be signed out
          </label>
        ) : null}
        {err ? (
          <div className="tb-err" role="alert">
            {err}
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
      <div className="dlg-f">
        <button type="button" className="btn btn-g" onClick={onClose}>
          Cancel
        </button>
        {self ? (
          <button
            type="button"
            className="btn"
            style={{ background: 'var(--over-chip)', color: '#fff', opacity: valid ? 1 : 0.55 }}
            disabled={!valid || busy}
            onClick={() => void submit()}
          >
            Hand off &amp; leave
          </button>
        ) : (
          <button type="button" className="btn btn-n" disabled={!valid || busy} style={{ opacity: valid ? 1 : 0.55 }} onClick={() => void submit()}>
            Substitute
          </button>
        )}
      </div>
    </Dialog>
  );
}
