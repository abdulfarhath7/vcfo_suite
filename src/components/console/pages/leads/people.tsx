'use client';

/**
 * The live Team / People functions for a manager, in console dialogs:
 *
 *   Add project lead     live Team page (POST /api/admin/interns — creates the
 *                        account and sends the welcome email) or, with the
 *                        welcome email off, the live People page's create
 *                        (POST /api/admin/people, role intern, temporary
 *                        password SBC@2026 by default)
 *   Change sign-in email PATCH /api/admin/people/:profileId
 *   Delete account       DELETE /api/admin/people/:profileId (was a browser confirm)
 *   Assign a project     the live "Assign project" dialog: makes the lead the
 *                        project's primary lead (updateEngagement internId)
 *   Client accounts, removed clients, clients and their leads — the People
 *                        page's read-only lists
 * The API enforces the rules (a manager edits only leads on their roster).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { createInternBodySchema } from '@/lib/api/schemas';
import { requestCreateIntern } from '@/lib/email/request-create-intern';
import { useConsole } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, ClientAv, Empty, Icon, Panel, StageTag } from '../../ui';
import { companyInitials, plural, stageOf } from '../clients/model';
import { projectHref } from '../work/planner/bits';
import type { LeadRow } from '../work/planner/data';

const TEMP_PASSWORD = 'SBC@2026';
const KEYS = [['admin-people'], ['admin-interns'], ['interns'], ['admin-clients'], ['admin-removed-clients'], ['book-leads']];

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}
function useRefreshPeople() {
  const qc = useQueryClient();
  return () => Promise.all(KEYS.map((k) => qc.invalidateQueries({ queryKey: k })));
}

const CREATE_ERR: Record<string, string> = {
  invalid_body: 'Check the form fields and try again.',
  email_already_registered: 'An account with this email already exists.',
  rate_limited: 'Too many requests. Wait a few minutes and try again.',
  email_not_configured: 'Account created, but email is not configured on the server.',
};

export function AddLeadModal() {
  const { closeModal, toast } = useConsole();
  const refresh = useRefreshPeople();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState(TEMP_PASSWORD);
  const [showPw, setShowPw] = useState(false);
  const [welcome, setWelcome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setErr('');
    const parsed = createInternBodySchema.safeParse({ email, password, fullName: name.trim() || undefined, phone: phone.trim() || undefined });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.path[0] === 'password' ? 'The temporary password needs 8 to 128 characters.' : parsed.error.issues[0]?.path[0] === 'email' ? 'Enter a valid work email.' : 'Check the form fields and try again.');
    setBusy(true);
    try {
      if (welcome) {
        const r = await requestCreateIntern(parsed.data);
        if (!r.ok) throw new Error(CREATE_ERR[r.error ?? ''] ?? r.error ?? 'Could not create the account.');
        toast(r.emailSent ? `Project lead account created · welcome email sent to ${r.email}` : r.emailSkipped ? `Project lead account created · email is off here, share the sign-in yourself` : `Project lead account created · the welcome email to ${r.email} failed`);
      } else {
        await call('/api/admin/people', { method: 'POST', body: JSON.stringify({ name: name.trim() || undefined, email: email.trim(), password, role: 'intern', phone: phone.trim() || undefined }) });
        toast(`Project lead created · ${email.trim()}`);
      }
      await refresh();
      closeModal();
    } catch (e) {
      setErr(e instanceof Error ? (CREATE_ERR[e.message] ?? e.message) : 'Could not create the account.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title="Add project lead"
      sub="They sign in with this email and the temporary password, and report to you."
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn cls="pri" ico="check" disabled={busy} onClick={() => void save()}>
            {busy ? 'Creating…' : 'Create project lead'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">Full name</span>
          <input className="mx-in" value={name} autoComplete="name" placeholder="e.g. Priya Sharma" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Work email</span>
          <input className="mx-in" type="email" value={email} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Phone (optional)</span>
          <input className="mx-in" type="tel" value={phone} autoComplete="tel" placeholder="+91 …" onChange={(e) => setPhone(e.target.value)} />
        </label>
        <div className="mx-f">
          <label className="mx-fl" htmlFor="lead-temp-pw">
            Temporary password
          </label>
          <div className="mx-addrow">
            <input id="lead-temp-pw" className="mx-in" type={showPw ? 'text' : 'password'} value={password} autoComplete="new-password" onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="ib" aria-label={showPw ? 'Hide password' : 'Show password'} onClick={() => setShowPw((v) => !v)}>
              <Icon name="eye" />
            </button>
          </div>
        </div>
        <label className="mx-sw">
          <input type="checkbox" checked={welcome} onChange={(e) => setWelcome(e.target.checked)} />
          <i />
          <span>Send a welcome email with the sign-in details</span>
        </label>
      </div>
      {err ? <p className="wk-err">{err}</p> : null}
    </ModalBody>
  );
}

export function ChangeEmailModal({ lead }: { lead: LeadRow }) {
  const { closeModal, toast } = useConsole();
  const refresh = useRefreshPeople();
  const [email, setEmail] = useState(lead.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    const next = email.trim().toLowerCase();
    if (!next.includes('@')) return setErr('Enter a valid email.');
    setBusy(true);
    try {
      await call(`/api/admin/people/${encodeURIComponent(lead.profileId ?? '')}`, { method: 'PATCH', body: JSON.stringify({ email: next }) });
      await refresh();
      closeModal();
      toast(`Email updated · ${next}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update the email.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title="Change sign-in email"
      sub={`${lead.name} will use this address the next time they sign in.`}
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <Btn cls="pri" ico="mail" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save email'}
          </Btn>
        </>
      }
    >
      <label className="mx-f">
        <span className="mx-fl">New email</span>
        <input className="mx-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void save()} />
      </label>
      {err ? <p className="wk-err">{err}</p> : null}
    </ModalBody>
  );
}

export function DeleteLeadModal({ lead, onDone }: { lead: LeadRow; onDone?: () => void }) {
  const { closeModal, toast } = useConsole();
  const refresh = useRefreshPeople();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const del = async () => {
    setBusy(true);
    try {
      await call(`/api/admin/people/${encodeURIComponent(lead.profileId ?? '')}`, { method: 'DELETE' });
      await refresh();
      closeModal();
      toast(`Account deleted · ${lead.email}`);
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete the account.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title={`Delete ${lead.name}?`}
      sub={`${lead.email}. This cannot be undone. Their tasks stay on the clients, unassigned.`}
      foot={
        <>
          <Btn onClick={closeModal} disabled={busy}>
            Cancel
          </Btn>
          <span className="sp" />
          <button type="button" className="btn danger" disabled={busy} onClick={() => void del()}>
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </>
      }
    >
      {err ? <p className="wk-err">{err}</p> : null}
    </ModalBody>
  );
}

/** Live "Assign project": attach a project to the lead (they become its primary lead). */
export function AssignProjectModal({ lead, leadName }: { lead: LeadRow; leadName: (k?: string | null) => string }) {
  const { closeModal, toast } = useConsole();
  const { engagements, updateEngagement } = useApp();
  const rows = engagements.filter((e) => e.stage !== 'Operational Readiness');
  const [pick, setPick] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    if (!pick) return;
    const p = rows.find((e) => e.id === pick);
    setBusy(true);
    try {
      await updateEngagement(pick, { internId: lead.key });
      closeModal();
      toast(`Project assigned · ${p?.companyName ?? 'Project'} → ${lead.name} (project lead)`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not assign the project.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title="Assign a project"
      sub={`Attach a project to ${lead.name} (project lead). They take over as delivery lead.`}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn cls="pri" ico="check" disabled={!pick || busy} onClick={() => void save()}>
            {busy ? 'Assigning…' : 'Assign'}
          </Btn>
        </>
      }
    >
      {rows.length ? (
        <div className="lp-pick" role="listbox" aria-label="Projects">
          {rows.map((e) => {
            const attached = e.internId === lead.key;
            return (
              <button
                key={e.id}
                type="button"
                role="option"
                aria-selected={pick === e.id}
                disabled={attached}
                className={'mx-qi lp-opt' + (pick === e.id ? ' on' : '')}
                onClick={() => setPick(pick === e.id ? null : e.id)}
              >
                <ClientAv id={e.id} label={companyInitials(e.companyName)} />
                <span className="mx-dt">
                  <b className="wk-ell">{e.companyName}</b>
                  <span className="wk-ell">{`Client ${e.clientDisplayName || e.clientEmail || 'Client'} · Lead ${leadName(e.internId)} · ${e.stage}`}</span>
                </span>
                {attached ? <span className="pill mut sm">Assigned</span> : pick === e.id ? <Icon name="check" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <Empty title="No active projects" sub="Projects in your book appear here." />
      )}
      {err ? <p className="wk-err">{err}</p> : null}
    </ModalBody>
  );
}

/* ---------------------------------------------------------------- People lists (read-only for a manager) */

interface ClientAccount {
  id: string;
  name: string;
  email: string;
  clientId: string | null;
}
interface RemovedClient extends ClientAccount {
  phone: string | null;
  removedAt: string | null;
  removedReason: string | null;
}

export function ClientsAndLeads({ leadName }: { leadName: (k?: string | null) => string }) {
  const { engagements, getStateForEngagement } = useApp();
  const { go, base } = useConsole();
  const rows = engagements.filter((e) => e.stage !== 'Operational Readiness');
  return (
    <Panel title="Clients and their leads" sub={rows.length ? `${plural(rows.length, 'active project')} · assign a lead from the lead's profile` : undefined}>
      {rows.length ? (
        rows.map((e) => (
          <button key={e.id} type="button" className="mx-qi lp-row" onClick={() => go(projectHref(base, e))}>
            <ClientAv id={e.id} label={companyInitials(e.companyName)} />
            <span className="mx-dt">
              <b className="wk-ell" title={e.companyName}>
                {e.companyName}
              </b>
              <span className="wk-ell">{`Client ${e.clientDisplayName || e.clientEmail || 'Client'} · Lead ${leadName(e.internId)}${(e.leadIds?.length ?? 0) > 1 ? ` +${(e.leadIds?.length ?? 1) - 1}` : ''}`}</span>
            </span>
            <StageTag need={stageOf(e, getStateForEngagement(e))} />
            <span className="small lp-health" title="Health set on the project">
              {e.health === 'on-track' ? 'On track' : e.health === 'at-risk' ? 'At risk' : 'Overdue'}
            </span>
            <Icon name="chev" size={14} />
          </button>
        ))
      ) : (
        <Empty title="No active projects" sub="Projects you set up, and projects an admin assigns to you, appear here." />
      )}
    </Panel>
  );
}

export function ClientAccounts() {
  const accounts = useQuery({ queryKey: ['admin-clients'], queryFn: async () => (await call<{ clients: ClientAccount[] }>('/api/admin/clients')).clients });
  const removed = useQuery({ queryKey: ['admin-removed-clients'], queryFn: async () => (await call<{ clients: RemovedClient[] }>('/api/admin/clients/removed')).clients });
  const state = (q: { isLoading: boolean; isError: boolean; refetch: () => unknown }, what: string) =>
    q.isLoading ? (
      <div className="sec-load">{`Loading ${what}…`}</div>
    ) : q.isError ? (
      <div className="lp-err">
        <span className="small">{`The ${what} could not load.`}</span>
        <Btn cls="sm" onClick={() => void q.refetch()}>
          Try again
        </Btn>
      </div>
    ) : null;
  return (
    <div className="lp-two">
      <Panel title="Client accounts" sub={accounts.data ? plural(accounts.data.length, 'client sign-in') : undefined}>
        {state(accounts, 'client accounts') ??
          (accounts.data?.length ? (
            accounts.data.map((c) => (
              <div key={c.id} className="mx-qi lp-row lp-static">
                <span className="mx-dt">
                  <b className="wk-ell">{c.name}</b>
                  <span className="wk-ell num">{c.email}</span>
                </span>
              </div>
            ))
          ) : (
            <Empty title="No client logins yet" sub="A client's sign-in is made with their project." />
          ))}
      </Panel>
      <Panel title="Removed clients" sub="Taken off their last project; their record stays">
        {state(removed, 'removed clients') ??
          (removed.data?.length ? (
            removed.data.map((c) => (
              <div key={c.id} className="mx-qi lp-row lp-static">
                <span className="mx-dt">
                  <b className="wk-ell">{c.name}</b>
                  <span className="wk-ell">{[c.email, c.phone, c.removedReason ?? 'Removed from their last project', c.removedAt ? new Date(c.removedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''].filter(Boolean).join(' · ')}</span>
                </span>
              </div>
            ))
          ) : (
            <Empty title="No removed clients" sub="Clients taken off their last project are listed here." />
          ))}
      </Panel>
    </div>
  );
}

