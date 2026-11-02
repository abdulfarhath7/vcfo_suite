'use client';

/**
 * TEAM (prototype body.txt TEAM + a6_rest.js renderTeam): the SBC team cards
 * with WhatsApp / Call / Email / Teams, then the company's own people.
 *
 * Real data: SBC team from the shell (`usePortal().shell.team`, incl. the help
 * desk); the company's people and pending invites from GET /api/client/team;
 * invite / resend / cancel / restore through POST /api/client/team (Primary
 * contact only); substitute (hand-off) through
 * POST /api/engagements/:id/clients/substitute — exactly the previous portal's actions.
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { signOut } from 'next-auth/react';
import type { ClientPortalContact } from '@/lib/client-portal/types';
import type { ClientTeamView } from '@/db/repositories/client-team';
import { usePortal } from '../../runtime';
import { getJson, PK, sendJson } from '../../data';
import { fmtY } from '../../dates';
import { ModalBox } from '../../overlays';
import { Btn, Icon, Pill, SecError, SecHead, SecLoading, Seg, initials } from '../../ui';
import { contactHref, makeTempPassword, prettyPhone } from './contact';
import '../../css/95-team.css';

export const TEAM_KEY = [PK, 'team'] as const;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function useClientTeam() {
  return useQuery({ queryKey: TEAM_KEY, queryFn: async () => await getJson<ClientTeamView>('/api/client/team'), staleTime: 30_000 });
}

/* ---------------------------------------------------------------- SBC cards */

const BLURB: Record<ClientPortalContact['role'], string> = {
  'Project Manager': 'Owns your engagement end to end. First call for anything.',
  'Project Lead': 'Prepares and files every form. Ask about any filing.',
  'SBC help desk': 'Portal access, logins and quick questions, 9 am to 7 pm.',
};
const AV_BG: Record<ClientPortalContact['role'], string> = {
  'Project Manager': '',
  'Project Lead': 'linear-gradient(140deg,#d97706,#f2b84b)',
  'SBC help desk': 'linear-gradient(140deg,#0e9473,#34d399)',
};

function SbcCard({ p }: { p: ClientPortalContact }) {
  const { toast } = usePortal();
  const support = p.support || p.role === 'SBC help desk';
  const name = support && /^customer support$/i.test(p.name.trim()) ? 'SBC help desk' : p.name;
  const act = (kind: 'wa' | 'call' | 'email' | 'teams', label: string) => {
    const href = contactHref(kind, p);
    if (!href) return toast(`${label} is not set up for ${name} yet`);
    if (kind === 'wa' || kind === 'teams') window.open(href, '_blank', 'noopener,noreferrer');
    else window.location.href = href;
  };
  const line = [p.email, prettyPhone(p.phoneE164)].filter(Boolean).join(' · ');
  return (
    <section className="glass tc">
      <div className="r1">
        <span className="av" style={AV_BG[p.role] ? { background: AV_BG[p.role] } : undefined}>
          {p.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" />
          ) : (
            p.initials || initials(name)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3>{name}</h3>
          <div className="role">{support ? 'Customer support · SBC' : `${p.role} · SBC`}</div>
        </div>
      </div>
      <div className="small">{BLURB[p.role]}</div>
      {line ? <div className="small tc-line">{line}</div> : null}
      <div className="acts">
        <button type="button" className="wa" aria-label={`WhatsApp ${name}`} title="WhatsApp" onClick={() => act('wa', 'WhatsApp')}>
          <Icon name="chat" />
        </button>
        <button type="button" aria-label={`Call ${name}`} title={prettyPhone(p.phoneE164) || 'Call'} onClick={() => act('call', 'Calling')}>
          <Icon name="phone" />
        </button>
        <button type="button" aria-label={`Email ${name}`} title={p.email || 'Email'} onClick={() => act('email', 'Email')}>
          <Icon name="mail" />
        </button>
        <button type="button" aria-label={`Teams chat with ${name}`} title="Microsoft Teams" onClick={() => act('teams', 'Teams')}>
          <Icon name="globe" />
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- the company's people */

type Row = { key: string; k: 'p' | 'm' | 'i'; name: string; email: string; when: string; you: boolean; userId?: string; inviteId?: string };
const ROLE_LABEL: Record<Row['k'], string> = { p: 'Primary', m: 'Member', i: 'Invite sent' };
const DOES: Record<Row['k'], string> = { p: 'Invites colleagues · signs off', m: 'Sees everything · cannot invite', i: 'Has not signed in yet' };

export function TeamSection() {
  const { shell, toast, openModal, closeModal } = usePortal();
  const qc = useQueryClient();
  const q = useClientTeam();
  const [tab, setTab] = useState<'all' | 'p' | 'm' | 'i'>('all');
  const [undo, setUndo] = useState<{ id: string; name: string } | null>(null);
  const company = shell?.companyShort ?? 'Your company';
  const isPrimary = q.data?.isPrimary ?? false;

  const rows = useMemo<Row[]>(() => {
    const d = q.data;
    if (!d) return [];
    return [
      ...d.people.map<Row>((p) => ({ key: p.userId, k: p.role === 'primary' ? 'p' : 'm', name: p.name, email: p.email, when: `Since ${fmtY(p.since)}`, you: p.you, userId: p.userId })),
      ...d.invites.map<Row>((i) => ({ key: i.id, k: 'i', name: i.name, email: i.email, when: `Sent ${fmtY(i.sentAt)}`, you: false, inviteId: i.id })),
    ];
  }, [q.data]);
  const shown = rows.filter((r) => tab === 'all' || r.k === tab);

  const act = useMutation({
    mutationFn: (body: Record<string, unknown>) => sendJson<{ team: ClientTeamView; email?: string; invite?: { id: string } }>('/api/client/team', 'POST', body),
    onSuccess: (d) => qc.setQueryData(TEAM_KEY, d.team),
  });

  const invite = useCallback(() => {
    if (!isPrimary) return toast('Only the Primary contact can invite');
    openModal(
      <InviteModal
        company={company}
        onSend={(name, email, pw) =>
          new Promise<void>((resolve, reject) =>
            act.mutate(
              { action: 'invite', name, email, tempPassword: pw },
              {
                onSuccess: (d) => {
                  closeModal();
                  setTab('i');
                  toast(d.email === 'attached' ? `${name} now has access to ${company}` : d.email === 'sent' ? `Invite sent to ${email}` : `Invite ready for ${email} · email not sent, share the sign-in yourself`);
                  resolve();
                },
                onError: (e) => reject(e),
              },
            ),
          )
        }
      />,
      { label: 'Invite a colleague' },
    );
  }, [act, closeModal, company, isPrimary, openModal, toast]);

  const resend = (r: Row) =>
    act.mutate(
      { action: 'resend', inviteId: r.inviteId, tempPassword: makeTempPassword() },
      {
        onSuccess: (d) => toast(d.email === 'sent' ? `Invite sent again to ${r.email}` : `New sign-in ready for ${r.email} · email not sent`),
        onError: (e) => toast(e instanceof Error ? e.message : 'Could not resend the invite'),
      },
    );
  const cancel = (r: Row) =>
    act.mutate(
      { action: 'cancel', inviteId: r.inviteId },
      {
        onSuccess: () => {
          toast(`Invite for ${r.name} cancelled`);
          setUndo({ id: r.inviteId!, name: r.name });
          window.setTimeout(() => setUndo((u) => (u?.id === r.inviteId ? null : u)), 10_000);
        },
        onError: (e) => toast(e instanceof Error ? e.message : 'Could not cancel the invite'),
      },
    );
  const substitute = (r: Row) =>
    openModal(<SubstituteModal row={r} company={company} engagementId={q.data?.engagementId ?? shell?.engagementId ?? ''} onDone={() => void qc.invalidateQueries({ queryKey: TEAM_KEY })} />, { label: r.you ? 'Hand off your seat' : `Substitute ${r.name}` });

  const team = shell?.team ?? [];
  const tabs = (['all', 'p', 'm', 'i'] as const).map((k) => ({ value: k, label: k === 'all' ? 'All' : k === 'p' ? 'Primary' : k === 'm' ? 'Members' : 'Invited', n: rows.filter((r) => k === 'all' || r.k === k).length }));

  return (
    <>
      <SecHead title="Team" />
      {team.length ? (
        <div className="team">
          {team.map((p) => (
            <SbcCard key={p.id} p={p} />
          ))}
        </div>
      ) : shell ? null : (
        <SecLoading />
      )}
      <section className="glass panel" style={{ marginTop: 14 }}>
        <div className="ph">
          <h3>{company}</h3>
          <span className="sp" />
          <Seg<'all' | 'p' | 'm' | 'i'> options={tabs} value={tab} onChange={setTab} ariaLabel="Filter people" />
          <Btn cls="sm pri" ico="team" onClick={invite} title={isPrimary ? undefined : 'Only the Primary contact can invite'} disabled={q.isPending}>
            Invite
          </Btn>
        </div>
        {undo ? (
          <div className="banner info" style={{ marginTop: 0, marginBottom: 10, alignItems: 'center' }}>
            <Icon name="alert" />
            <div style={{ flex: 1 }}>
              <b>Invite for {undo.name} cancelled</b>
            </div>
            <Btn
              cls="sm"
              ico="back"
              onClick={() => {
                act.mutate({ action: 'restore', inviteId: undo.id }, { onSuccess: () => toast('Invite restored'), onError: () => toast('Could not restore the invite') });
                setUndo(null);
              }}
            >
              Undo
            </Btn>
          </div>
        ) : null}
        <div>
          {q.isPending ? (
            <SecLoading />
          ) : q.isError ? (
            <SecError message="The team could not load." onRetry={() => void q.refetch()} />
          ) : !shown.length ? (
            <div className="sec-empty">{tab === 'i' ? 'No pending invites.' : rows.length ? 'No one in this group.' : `No one from ${company} has access yet.`}</div>
          ) : (
            shown.map((r) => (
              <div key={r.key} className="prow">
                <span className="av" style={r.k === 'i' ? { background: 'var(--hi)', color: 'var(--ink-2)', border: '1px dashed var(--line)' } : r.you ? { background: 'linear-gradient(140deg,#0e9473,#34d399)' } : undefined}>
                  {initials(r.name)}
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <b>
                    {r.name}
                    {r.you ? <span className="small"> · you</span> : null}
                  </b>
                  <span className="small">{r.when}</span>
                </div>
                <span className="em">{r.email}</span>
                <span className={'role' + (r.k === 'p' ? ' Client' : '')}>{ROLE_LABEL[r.k]}</span>
                <span className="small prow-does">{DOES[r.k]}</span>
                <span className="prow-acts">
                  {r.k === 'i' && isPrimary ? (
                    <>
                      <button type="button" className="ib" aria-label={`Resend invite to ${r.email}`} title="Resend invite" disabled={act.isPending} onClick={() => resend(r)}>
                        <Icon name="send" />
                      </button>
                      <button type="button" className="ib" aria-label={`Cancel invite for ${r.name}`} title="Cancel invite" disabled={act.isPending} onClick={() => cancel(r)}>
                        <Icon name="x" />
                      </button>
                    </>
                  ) : r.k !== 'i' && (r.you || isPrimary) ? (
                    <button type="button" className="ib" aria-label={r.you ? 'Hand off your seat' : `Substitute ${r.name}`} title={r.you ? 'Hand off your seat' : 'Substitute'} onClick={() => substitute(r)}>
                      <Icon name="ne" />
                    </button>
                  ) : null}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </>
  );
}

/* ---------------------------------------------------------------- modals */

/** Sign-in box: the set-password link is not built yet, so the one-off temporary password shows. */
function SignInBox({ pw, email, label }: { pw: string; email: string; label: string }) {
  const { toast } = usePortal();
  return (
    <div className="mf">
      <span className="mf-l">{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--hi)' }}>
        <Icon name="key" style={{ width: 16, height: 16, color: 'var(--ink-3)', flex: 'none' }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <b style={{ display: 'block', font: '600 13.5px var(--f-disp)' }}>Temporary password by email</b>
          <span className="mono small" style={{ fontFamily: 'var(--f-mono)' }}>{pw}</span>
        </span>
        <button
          type="button"
          className="ib"
          aria-label="Copy the sign-in"
          title="Copy the sign-in"
          onClick={() => {
            navigator.clipboard
              .writeText(`Sign in to VCFO Suite at ${window.location.origin}/login\nEmail: ${email || '(their work email)'}\nTemporary password: ${pw}`)
              .then(() => toast('Sign-in copied'), () => toast('Could not copy — select the password instead'));
          }}
        >
          <Icon name="copy" />
        </button>
      </div>
    </div>
  );
}

function Field({ label, children, err }: { label: string; children: ReactNode; err?: string }) {
  return (
    <label className={'mf' + (err ? ' bad' : '')}>
      <span className="mf-l">{label}</span>
      {children}
      {err ? <span className="mf-m">{err}</span> : null}
    </label>
  );
}

function InviteModal({ company, onSend }: { company: string; onSend: (name: string, email: string, pw: string) => Promise<void> }) {
  const { closeModal } = usePortal();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw] = useState(makeTempPassword);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const valid = name.trim().length > 0 && EMAIL_OK.test(email.trim());
  const send = async () => {
    if (!valid) return setErr(!name.trim() ? 'Enter a name.' : 'Enter a valid work email.');
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
    <ModalBox
      eyebrow={company}
      title="Invite a colleague"
      sub={`They see everything on ${company}. Only the Primary contact can invite.`}
      width={520}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="send" disabled={busy} onClick={() => void send()}>
            Send invite
          </Btn>
        </>
      }
    >
      <form
        className="tm-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <div className="tm-grid">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Work email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <SignInBox pw={pw} email={email.trim()} label="Sign-in" />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Pill kind="mut">Member</Pill>
          <span className="small">Sees everything on {company}. Cannot invite.</span>
        </div>
        {err ? (
          <div className="banner over" role="alert" style={{ marginTop: 0 }}>
            <Icon name="alert" />
            <div>{err}</div>
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
    </ModalBox>
  );
}

function SubstituteModal({ row, company, engagementId, onDone }: { row: Row; company: string; engagementId: string; onDone: () => void }) {
  const { closeModal, toast } = usePortal();
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
      const d = await sendJson<{ substituted?: { actorLostAccess: boolean; name: string } }>(`/api/engagements/${encodeURIComponent(engagementId)}/clients/substitute`, 'POST', {
        replaceUserId: row.userId,
        email: email.trim(),
        fullName: name.trim() || undefined,
        password: pw,
      });
      const who = d.substituted?.name || name.trim() || email.trim();
      if (d.substituted?.actorLostAccess) {
        toast(`Handed off to ${who}`);
        window.setTimeout(() => void signOut({ callbackUrl: '/login' }), 1200);
        return;
      }
      toast(`${row.name} replaced by ${who}`);
      closeModal();
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not complete the hand-off');
      setBusy(false);
    }
  };
  return (
    <ModalBox
      eyebrow={company}
      title={self ? 'Hand off your seat' : `Substitute ${row.name}`}
      sub={self ? `Your ${row.k === 'p' ? 'Primary' : 'Member'} seat moves to a colleague. You lose access to ${company} right after.` : `${row.name}'s ${row.k === 'p' ? 'Primary' : 'Member'} seat moves to a colleague.`}
      width={540}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          {self ? (
            <Btn cls="danger" ico="ne" disabled={!valid || busy} onClick={() => void submit()}>
              Hand off &amp; leave
            </Btn>
          ) : (
            <Btn cls="pri" ico="ne" disabled={!valid || busy} onClick={() => void submit()}>
              Substitute
            </Btn>
          )}
        </>
      }
    >
      <form
        className="tm-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="tm-swap">
          <div className="tm-seat">
            <span className="av">{initials(row.name)}</span>
            <div style={{ minWidth: 0 }}>
              <b>{row.name}</b>
              <span className="small">
                {ROLE_LABEL[row.k]} · {company}
              </span>
            </div>
          </div>
          <Icon name="ne" style={{ width: 20, height: 20, color: 'var(--ink-3)' }} />
          <div className="tm-seat new">
            <span className="av" style={{ background: 'var(--hi)', color: 'var(--ink-2)', border: '1px dashed var(--line)' }}>
              {name.trim() ? initials(name) : '?'}
            </span>
            <div style={{ minWidth: 0 }}>
              <b>{name.trim() || 'New person'}</b>
              <span className="small">{row.k === 'p' ? 'New Primary' : 'New Member'}</span>
            </div>
          </div>
        </div>
        <div className="tm-grid">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </Field>
          <Field label="Work email">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </Field>
        </div>
        <SignInBox pw={pw} email={email.trim()} label={`Sign-in for ${first}`} />
        {self ? (
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, font: '600 13.5px var(--f-disp)' }}>
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--ice)' }} />I understand I will be signed out
          </label>
        ) : null}
        {err ? (
          <div className="banner over" role="alert" style={{ marginTop: 0 }}>
            <Icon name="alert" />
            <div>{err}</div>
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
    </ModalBox>
  );
}
