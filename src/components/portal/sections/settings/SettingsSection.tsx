'use client';

/**
 * SETTINGS (prototype body.txt SETTINGS + a6_rest.js renderSettings): profile
 * rows, Appearance, the Ask VCFO mascot picker and the notification matrix
 * TELL ME WHEN × EMAIL × WHATSAPP.
 *
 * Real data and actions (the previous Settings page, same routes):
 *  - profile GET/PATCH /api/account/profile (name, phone, email with password),
 *    photo POST/DELETE /api/account/avatar;
 *  - password GET/POST /api/client/account/password;
 *  - theme usePortal().setTheme (saved in the portal prefs);
 *  - mascot: per browser, localStorage 'vcfo-mascot' (sections/ask/mascot.ts);
 *  - notification preferences GET/PATCH /api/client/notification-prefs
 *    (email optional categories, WhatsApp categories, quiet hours), WhatsApp
 *    consent + number through the profile (whatsappOptIn, phoneE164).
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmailOptional, NotificationPrefs, NotificationPrefsPatch, WhatsAppCategory } from '@/lib/client-portal/notification-prefs';
import type { PortalTheme } from '@/lib/client-portal/types';
import { usePortal } from '../../runtime';
import { getJson, PK, QK, sendJson } from '../../data';
import { fmtY } from '../../dates';
import { ModalBox } from '../../overlays';
import { Btn, Icon, Pill, SecHead, SecLoading, Seg, Sym, initials } from '../../ui';
import { MASCOTS, mascotName, useMascot, writeMascot } from '../ask/mascot';
import { prettyPhone, thisDevice } from '../team/contact';
import { useClientTeam } from '../team/TeamSection';
import '../../css/95-settings.css';

type Profile = { id: string; name: string; email: string; phone: string | null; phoneE164: string | null; whatsappOptIn: boolean; whatsappStatus: string; avatarUrl: string | null };

const PROFILE_KEY = [PK, 'profile'] as const;
const PREFS_KEY = [PK, 'notification-prefs'] as const;
const PW_KEY = [PK, 'password-changed'] as const;

/** The matrix rows (owner decision: email locked on for the first four). */
const ROWS: Array<{ k: string; t: string; locked: boolean; em?: EmailOptional; wa?: WhatsAppCategory }> = [
  { k: 'docs', t: 'A paper is requested or sent back', locked: true, wa: 'docs' },
  { k: 'steps', t: 'A step is accepted or needs changes', locked: true, wa: 'steps' },
  { k: 'dead', t: 'A deadline or reminder is coming up', locked: true, wa: 'deadlines' },
  { k: 'time', t: 'The timeline changes', locked: true, wa: 'timeline' },
  { k: 'ann', t: 'Announcements from SBC', locked: false, em: 'announcements', wa: 'announcements' },
  { k: 'feed', t: 'Official updates (MCA, GST, Income tax)', locked: false, em: 'feed', wa: 'feed' },
  { k: 'digest', t: 'Weekly summary every Monday', locked: false, em: 'weeklyDigest' },
];

function useProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: async () => (await getJson<{ profile: Profile }>('/api/account/profile'))?.profile ?? null, staleTime: 30_000 });
}

function Tog({ on, label, disabled, onClick }: { on: boolean; label: string; disabled?: boolean; onClick: () => void }) {
  return <button type="button" className="tog" aria-pressed={on} aria-label={label} title={label} disabled={disabled} onClick={onClick} style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined} />;
}

export function SettingsSection() {
  const { shell, toast, theme, setTheme, openModal } = usePortal();
  const qc = useQueryClient();
  const prof = useProfile();
  const team = useClientTeam();
  const np = useQuery({ queryKey: PREFS_KEY, queryFn: async () => (await getJson<{ prefs: NotificationPrefs }>('/api/client/notification-prefs'))?.prefs ?? null, staleTime: 60_000 });
  const pwq = useQuery({ queryKey: PW_KEY, queryFn: async () => (await getJson<{ changedAt: string | null }>('/api/client/account/password'))?.changedAt ?? null, staleTime: 60_000 });
  const mascot = useMascot();
  const device = useMemo(() => thisDevice(), []);
  const p = prof.data ?? undefined;
  const company = shell?.companyName ?? '';
  const short = shell?.companyShort ?? 'you';
  const name = p?.name ?? shell?.me.name ?? '';
  const isPrimary = team.data?.isPrimary;

  const setProfile = (patch: Partial<Profile>) => qc.setQueryData<Profile | null>(PROFILE_KEY, (o) => (o ? { ...o, ...patch } : o));
  const patchProfile = (body: Record<string, unknown>) => sendJson('/api/account/profile', 'PATCH', { name: p?.name ?? shell?.me.name ?? 'Client', ...body });

  /* ---------- WhatsApp */
  const waOn = Boolean(p?.whatsappOptIn);
  const waOff = async () => {
    setProfile({ whatsappOptIn: false });
    try {
      await patchProfile({ whatsappOptIn: false });
      toast('WhatsApp turned off');
    } catch {
      setProfile({ whatsappOptIn: true });
      toast('Could not turn WhatsApp off');
    }
  };
  const waTurnOn = () =>
    p &&
    openModal(
      <WhatsAppModal
        p={p}
        company={short}
        patchProfile={patchProfile}
        onDone={(e164) => {
          setProfile({ whatsappOptIn: true, phoneE164: e164 });
          toast('WhatsApp is on');
        }}
      />,
      { label: 'Turn on WhatsApp' },
    );

  /* ---------- preference matrix (optimistic) */
  const prefs = np.data ?? undefined;
  const savePref = (patch: NotificationPrefsPatch) => {
    const prev = qc.getQueryData<NotificationPrefs | null>(PREFS_KEY);
    if (prev) qc.setQueryData(PREFS_KEY, { ...prev, email: { ...prev.email, ...(patch.email ?? {}) }, whatsapp: { ...prev.whatsapp, ...(patch.whatsapp ?? {}) }, quietHours: patch.quietHours ?? prev.quietHours });
    sendJson<{ prefs: NotificationPrefs }>('/api/client/notification-prefs', 'PATCH', patch)
      .then((r) => {
        qc.setQueryData(PREFS_KEY, r.prefs);
        toast('Saved');
      })
      .catch(() => {
        if (prev) qc.setQueryData(PREFS_KEY, prev);
        toast('Could not save that change');
      });
  };

  /* ---------- photo */
  const file = useRef<HTMLInputElement>(null);
  const upload = async (f: File) => {
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await fetch('/api/account/avatar', { method: 'POST', body: fd });
      const d = (await r.json()) as { avatarUrl?: string | null; error?: string };
      if (!r.ok) throw new Error(d.error === 'file_too_large' ? 'That photo is too large' : d.error === 'unsupported_type' ? 'Use a JPG, PNG or WebP photo' : 'Upload failed');
      setProfile({ avatarUrl: d.avatarUrl ?? null });
      void qc.invalidateQueries({ queryKey: QK.shell });
      toast('Photo updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    }
  };
  const removePhoto = async () => {
    try {
      await sendJson('/api/account/avatar', 'DELETE');
      setProfile({ avatarUrl: null });
      toast('Photo removed');
    } catch {
      toast('Could not remove the photo');
    }
  };

  const waChip = p?.whatsappOptIn ? (p.whatsappStatus === 'verified' ? 'Verified' : 'On') : 'Off';

  return (
    <>
      <SecHead title="Settings" />
      <div className="sets">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="glass panel">
            <div className="ph">
              <span className="av st-av" style={{ width: 46, height: 46, fontSize: 15 }}>
                {p?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatarUrl} alt="" />
                ) : (
                  initials(name || ' ')
                )}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h3>{name || (prof.isPending ? '…' : 'Your account')}</h3>
                <span className="small">
                  {isPrimary === undefined ? 'Client' : isPrimary ? 'Primary contact' : 'Member'}
                  {company ? ` · ${company}` : ''}
                </span>
              </div>
              <Btn cls="sm" ico="up" onClick={() => file.current?.click()} disabled={!p}>
                Photo
              </Btn>
              {p?.avatarUrl ? (
                <Btn cls="sm" ico="x" onClick={() => void removePhoto()}>
                  Remove
                </Btn>
              ) : null}
              <input
                ref={file}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void upload(f);
                }}
              />
            </div>
            {prof.isPending ? (
              <SecLoading />
            ) : (
              <>
                <div className="kv">
                  <span className="k">Email</span>
                  <span className="v st-wrap">{p?.email ?? shell?.me.email ?? ''}</span>
                  <Btn cls="sm" onClick={() => p && openModal(<ProfileModal p={p} onSaved={(patch) => { setProfile(patch); void qc.invalidateQueries({ queryKey: QK.shell }); }} />, { label: 'Edit profile' })} disabled={!p}>
                    Edit
                  </Btn>
                </div>
                <div className="kv">
                  <span className="k">Phone</span>
                  <span className="v">{p?.phone || prettyPhone(p?.phoneE164) || '—'}</span>
                  <span />
                </div>
                <div className="kv">
                  <span className="k">WhatsApp</span>
                  <span className="v">{p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}</span>
                  <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                    <Pill kind={waOn ? 'ok' : 'mut'}>{waChip}</Pill>
                    {waOn ? (
                      <Tog on label="WhatsApp is on · click to turn off" onClick={() => void waOff()} />
                    ) : (
                      <Btn cls="sm pri" onClick={waTurnOn} disabled={!p}>
                        Turn on
                      </Btn>
                    )}
                  </span>
                </div>
                <div className="kv">
                  <span className="k">Password</span>
                  <span className="v">
                    ••••••••{pwq.data ? <span className="small"> · changed {fmtY(pwq.data)}</span> : null}
                  </span>
                  <Btn cls="sm" onClick={() => openModal(<PasswordModal onChanged={(at) => qc.setQueryData(PW_KEY, at)} />, { label: 'Change password' })}>
                    Change
                  </Btn>
                </div>
                <div className="kv">
                  <span className="k">This device</span>
                  <span className="v">{device}</span>
                  <Pill kind="ok">Active</Pill>
                </div>
              </>
            )}
          </section>

          <section className="glass panel">
            <div className="ph">
              <h3>Appearance</h3>
            </div>
            <Seg<PortalTheme>
              options={[
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
                { value: 'system', label: 'System' },
              ]}
              value={theme}
              onChange={setTheme}
              ariaLabel="Theme"
            />
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section className="glass panel">
            <div className="ph">
              <h3>Ask VCFO assistant</h3>
              <span className="sp" />
              <span className="small">{mascotName(mascot)}</span>
            </div>
            <div className="mascots">
              {MASCOTS.map(([k, n]) => (
                <button key={k} type="button" aria-pressed={mascot === k} onClick={() => writeMascot(k)}>
                  <Sym id={`m-${k}`} />
                  {n}
                </button>
              ))}
            </div>
          </section>

          {
            <section className="glass panel" id="notifications">
              <div className="ph">
                <h3>Notifications</h3>
                <span className="sp" />
                <span className="small">Email is {short}’s record · WhatsApp is a nudge on top</span>
              </div>
              <div className="ns st-head">
                <span>TELL ME WHEN</span>
                <span style={{ justifySelf: 'center' }}>EMAIL</span>
                <span style={{ justifySelf: 'center' }}>WHATSAPP</span>
              </div>
              {np.isPending ? (
                <SecLoading />
              ) : (
                <>
                  {ROWS.map((r) => {
                    const eOn = r.locked || Boolean(r.em && prefs?.email[r.em]);
                    const wOn = waOn && Boolean(r.wa && prefs?.whatsapp[r.wa]);
                    return (
                      <div key={r.k} className="ns">
                        <span>{r.t}</span>
                        {r.locked ? (
                          <span className="lockon" title={`Always on · email is ${short}’s record`}>
                            Always
                          </span>
                        ) : (
                          <Tog on={eOn} label={`${r.t} by email`} disabled={!prefs} onClick={() => r.em && savePref({ email: { [r.em]: !eOn } })} />
                        )}
                        {r.wa ? (
                          <Tog on={wOn} label={waOn ? `${r.t} by WhatsApp` : 'Turn on WhatsApp first'} disabled={!waOn || !prefs} onClick={() => r.wa && savePref({ whatsapp: { [r.wa]: !prefs?.whatsapp[r.wa] } })} />
                        ) : (
                          <span className="lockon">—</span>
                        )}
                      </div>
                    );
                  })}
                  <div className="ns">
                    <span>
                      Quiet hours · no WhatsApp {prefs?.quietStart ?? '21:00'} – {prefs?.quietEnd ?? '08:00'}
                    </span>
                    <span className="lockon">—</span>
                    <Tog on={Boolean(prefs?.quietHours) && waOn} label={waOn ? `Quiet hours ${prefs?.quietHours ? 'on' : 'off'}` : 'Turn on WhatsApp first'} disabled={!waOn || !prefs} onClick={() => savePref({ quietHours: !prefs?.quietHours })} />
                  </div>
                </>
              )}
              {!waOn ? (
                <div className="small" style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  WhatsApp is off. Turn it on to get nudges on your phone.
                  <Btn cls="sm" onClick={waTurnOn} disabled={!p}>
                    Turn on WhatsApp
                  </Btn>
                </div>
              ) : null}
            </section>
          }
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- modals */

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="mf">
      <span className="mf-l">
        {label}
        {hint ? <em>{hint}</em> : null}
      </span>
      {children}
    </label>
  );
}

function ProfileModal({ p, onSaved }: { p: Profile; onSaved: (patch: Partial<Profile>) => void }) {
  const { closeModal, toast } = usePortal();
  const [name, setName] = useState(p.name);
  const [email, setEmail] = useState(p.email);
  const [phone, setPhone] = useState(p.phone ?? '');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const emailChanging = email.trim().toLowerCase() !== p.email;
  const save = async () => {
    if (!name.trim()) return setErr('Enter your name.');
    if (emailChanging && !pw) return setErr('Enter your password to change your email.');
    setBusy(true);
    setErr('');
    try {
      await sendJson('/api/account/profile', 'PATCH', { name: name.trim(), phone: phone.trim() || null, ...(emailChanging ? { email: email.trim(), currentPassword: pw } : {}) });
      onSaved({ name: name.trim(), phone: phone.trim() || null, ...(emailChanging ? { email: email.trim().toLowerCase() } : {}) });
      closeModal();
      toast('Profile saved');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setErr(m === 'invalid_credentials' ? 'That password is not right.' : m === 'email_already_registered' ? 'That email is already in use.' : 'Could not save your profile.');
      setBusy(false);
    }
  };
  return (
    <ModalBox
      title="Edit profile"
      sub="Changing your email needs your password; sign-in moves to the new address."
      width={480}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="check" disabled={busy} onClick={() => void save()}>
            Save
          </Btn>
        </>
      }
    >
      <form
        className="st-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Full name">
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        {emailChanging ? (
          <Field label="Current password" hint="needed to change the email">
            <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
          </Field>
        ) : null}
        <Field label="Phone">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
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

function strength(pw: string) {
  const len = pw.length >= 8;
  const num = /\d/.test(pw);
  const sym = /[^A-Za-z0-9]/.test(pw);
  const mixed = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const score = [len, num, sym, mixed || pw.length >= 12].filter(Boolean).length;
  const verdict = !pw ? '' : score >= 4 ? 'Strong' : score === 3 ? 'Good' : score === 2 ? 'Fair' : 'Weak';
  return { len, num, sym, score, verdict };
}

function PasswordModal({ onChanged }: { onChanged: (at: string) => void }) {
  const { closeModal, toast } = usePortal();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const s = strength(nw);
  const bar = s.score >= 3 ? 'var(--ok-green)' : s.score === 2 ? 'var(--due)' : 'var(--over)';
  const save = async () => {
    if (!cur) return setErr('Enter your current password.');
    if (!s.len) return setErr('Use at least 8 characters.');
    if (nw !== cf) return setErr('The new passwords do not match.');
    setBusy(true);
    setErr('');
    try {
      const r = await sendJson<{ changedAt: string }>('/api/client/account/password', 'POST', { currentPassword: cur, newPassword: nw });
      onChanged(r.changedAt);
      closeModal();
      toast('Password changed');
    } catch (e) {
      setErr(e instanceof Error && e.message === 'invalid_credentials' ? 'Your current password is not right.' : 'Could not change the password.');
      setBusy(false);
    }
  };
  return (
    <ModalBox
      title="Change password"
      sub="At least 8 characters. A number and a symbol make it stronger."
      width={460}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="lock" disabled={busy} onClick={() => void save()}>
            Save password
          </Btn>
        </>
      }
    >
      <form
        className="st-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Current password">
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password">
          <input type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
        </Field>
        <div style={{ display: 'flex', gap: 4 }} role="img" aria-label={`Strength: ${s.verdict || 'none'}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < s.score ? bar : 'var(--line)' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Pill kind={s.len ? 'ok' : 'mut'}>8+ characters</Pill>
          <Pill kind={s.num ? 'ok' : 'mut'}>Number</Pill>
          <Pill kind={s.sym ? 'ok' : 'mut'}>Symbol</Pill>
          {s.verdict ? <Pill kind={s.score >= 3 ? 'ok' : s.score === 2 ? 'due' : 'over'}>{s.verdict}</Pill> : null}
        </div>
        <Field label="Confirm new password">
          <input type="password" value={cf} onChange={(e) => setCf(e.target.value)} autoComplete="new-password" style={cf ? { borderColor: cf === nw ? 'var(--ok-green)' : 'var(--over)' } : undefined} />
        </Field>
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

/**
 * Turn on WhatsApp: number + consent through the existing profile opt-in
 * (the 6-digit verification step is not live: no approved template yet).
 */
function WhatsAppModal({ p, company, patchProfile, onDone }: { p: Profile; company: string; patchProfile: (b: Record<string, unknown>) => Promise<unknown>; onDone: (e164: string) => void }) {
  const { closeModal } = usePortal();
  const initial = p.phoneE164?.startsWith('+91') ? p.phoneE164.slice(3).replace(/(\d{5})(\d{5})/, '$1 $2') : '';
  const [num, setNum] = useState(initial);
  const [consent, setConsent] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const digits = num.replace(/\D/g, '');
  const valid = /^[6-9]\d{9}$/.test(digits);
  const submit = async () => {
    if (!valid) return setErr('Enter a 10-digit Indian mobile number.');
    if (!consent) return setErr('Tick the box to agree to WhatsApp updates.');
    setBusy(true);
    setErr('');
    try {
      const e164 = `+91${digits}`;
      await patchProfile({ phoneE164: e164, whatsappOptIn: true });
      onDone(e164);
      closeModal();
    } catch {
      setErr('Could not turn WhatsApp on. Try again.');
      setBusy(false);
    }
  };
  return (
    <ModalBox
      title="Turn on WhatsApp"
      sub={`Quick nudges about ${company} on your phone. Email stays the record.`}
      width={460}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <Btn cls="pri" ico="chat" disabled={busy} onClick={() => void submit()}>
            Turn on
          </Btn>
        </>
      }
    >
      <form
        className="st-form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="mf">
          <span className="mf-l">WhatsApp number</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value="+91" readOnly aria-label="Country code" style={{ width: 64, flex: 'none', textAlign: 'center' }} />
            <input inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} autoComplete="tel-national" placeholder="98765 43210" />
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, font: '600 13.5px/1.4 var(--f-disp)' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, accentColor: 'var(--ice)' }} />
          Send me WhatsApp updates about {company}. Reply STOP to stop.
        </label>
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
