'use client';

/**
 * SETTINGS — /app/manager/settings and /app/intern/settings (prototype a59r +
 * a59s mxRenderers.settings: a section list beside one panel).
 *
 * Every setting saves exactly as the live Account settings
 * (src/views/settings/AccountSettings.tsx + AppearanceSettings.tsx):
 *   Profile     photo upload / Use Outlook photo (staff, Outlook linked) / remove
 *               (POST · POST outlook · DELETE /api/account/avatar); name, email
 *               (a change asks for the current password), phone, WhatsApp number
 *               and consent (PATCH /api/account/profile, same body); WhatsApp
 *               status and Send test message (POST /api/account/whatsapp-test)
 *   Security    current / new / confirm (POST /api/account/password, same checks)
 *   Outlook     status, Connect (/api/outlook/connect), Disconnect
 *               (DELETE /api/outlook/disconnect), the callback's ?outlook= toast
 *   Appearance  the console theme (useConsole().setTheme; the app's own theme
 *               store, next-themes, kept in step), animations and reduce motion
 *               (the old appearance prefs, `vcfo.shell.appearance`)
 *   Sign out    useApp().signOut() then /login, as live
 */
import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, useSession } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { initialsFromName } from '@/lib/auth';
import { normalizeToE164 } from '@/lib/notify/phone';
import { compressImageFile, MOTION_STYLES, type MotionStyle } from '@/lib/shell/shell-appearance';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import { errorMessage } from '@/lib/toast-errors';
import { useConsole, useConsolePalette, useCrumbs, type PaletteItem } from '../../runtime';
import { Btn, Field, Icon, Panel, Seg, type IconName } from '../../ui';
import {
  avatarErrorText,
  draftOf,
  emailChanging,
  isDirty,
  isStaffRole,
  outlookPhotoErrorText,
  passwordProblem,
  profileBody,
  profileErrorText,
  profileFromApi,
  readOutlookReturn,
  roleLabelOf,
  savedProfile,
  whatsappTestText,
  type ProfileData,
  type ProfileDraft,
} from './settings-model';
import { ErrorBox, useSay } from './shared';

type Section = 'profile' | 'security' | 'outlook' | 'look';
const SECTIONS: Array<{ key: Section; label: string; ico: IconName; staffOnly?: boolean }> = [
  { key: 'profile', label: 'Profile', ico: 'team' },
  { key: 'security', label: 'Security', ico: 'lock' },
  { key: 'outlook', label: 'Outlook', ico: 'mail', staffOnly: true },
  { key: 'look', label: 'Appearance', ico: 'sun' },
];
const isSection = (s: string | null | undefined): s is Section => SECTIONS.some((x) => x.key === s);

type Outlook = { configured: boolean; connected: boolean; msEmail?: string };

function useProfile() {
  const { user } = useApp();
  return useQuery({
    queryKey: ['ins-profile', user?.id],
    queryFn: async (): Promise<ProfileData> => {
      const res = await fetch('/api/account/profile');
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not load profile');
      return profileFromApi(body.profile);
    },
    enabled: Boolean(user),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

function useOutlook(enabled: boolean) {
  const { user } = useApp();
  return useQuery({
    queryKey: ['ins-outlook', user?.id],
    queryFn: async (): Promise<Outlook> => {
      try {
        const res = await fetch('/api/outlook');
        const json = (await res.json()) as { configured?: boolean; connected?: boolean; msEmail?: string };
        return { configured: json.configured !== false, connected: Boolean(json.connected), msEmail: json.msEmail };
      } catch {
        return { configured: true, connected: false };
      }
    },
    enabled: enabled && Boolean(user),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}

/** `?section=` (the search palette's links) → the open section. Inside Suspense, as Next asks. */
function SectionFromUrl({ onSection }: { onSection: (s: Section) => void }) {
  const params = useSearchParams();
  const s = params?.get('section');
  useEffect(() => {
    if (isSection(s)) onSection(s);
  }, [s, onSection]);
  return null;
}

export function SettingsPage() {
  const { user, signOut } = useApp();
  const { base, go } = useConsole();
  const router = useRouter();
  const say = useSay();
  const [section, setSection] = useState<Section>('profile');
  const profileQ = useProfile();
  const p = profileQ.data;
  const role = p?.role ?? user?.role ?? '';
  const staff = isStaffRole(role);
  const outlookQ = useOutlook(staff);
  const sections = SECTIONS.filter((s) => !s.staffOnly || staff);
  const cur = sections.some((s) => s.key === section) ? section : 'profile';
  const curLabel = sections.find((s) => s.key === cur)?.label ?? 'Profile';
  useCrumbs(['Settings', curLabel]);

  const palette = useMemo<PaletteItem[]>(
    () => sections.map((s) => ({ id: `settings:${s.key}`, label: `${s.label} settings`, kind: 'Settings', sw: 'var(--ink-3)', go: () => go(`${base}/settings?section=${s.key}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [base, go, staff],
  );
  useConsolePalette('settings-sections', palette);

  /* the Outlook callback comes back here with ?outlook=connected | error&reason= (live toasts) */
  useEffect(() => {
    const r = readOutlookReturn(window.location.search);
    if (!r.result) return;
    if (r.result === 'connected') say('Outlook connected', 'Client emails will send from this mailbox.');
    else say('Outlook did not connect', r.reason || 'Try Connect Outlook again.');
    setSection('outlook');
    window.history.replaceState({}, '', `${window.location.pathname}${r.rest ? `?${r.rest}` : ''}`);
  }, [say]);

  const name = p?.name ?? user?.name ?? '';
  const email = p?.email ?? user?.email ?? '';
  const avatar = p ? p.avatarUrl : user?.imageUrl ?? null;
  const roleText = roleLabelOf(role);

  const doSignOut = () => {
    void signOut()
      .then(() => router.push('/login'))
      .catch(() => say('Sign out failed. Please try again.'));
  };

  return (
    <>
      <Suspense fallback={null}>
        <SectionFromUrl onSection={setSection} />
      </Suspense>
      <div className="sec-h">
        <h2>Settings</h2>
        <span className="sec-count">{roleText}</span>
      </div>
      <div className="mx-set">
        <nav className="glass mx-setnav" aria-label="Settings sections">
          <div className="mx-setme">
            <Face src={avatar} name={name || email} big />
            <b className="ins-ell" title={name}>
              {profileQ.isLoading && !name ? 'Loading…' : name || 'Your profile'}
            </b>
            <span className="small ins-ell" title={`${roleText} · ${email}`}>{`${roleText} · ${email || '—'}`}</span>
          </div>
          {sections.map((s) => (
            <button key={s.key} type="button" className={cur === s.key ? 'on' : ''} aria-current={cur === s.key ? 'page' : undefined} onClick={() => setSection(s.key)}>
              <Icon name={s.ico} />
              {s.label}
            </button>
          ))}
          <button type="button" className="ins-out" onClick={doSignOut}>
            <Icon name="ext" />
            Sign out
          </button>
        </nav>
        {cur === 'profile' ? (
          <ProfilePanel q={profileQ} staff={staff} outlookConnected={Boolean(outlookQ.data?.connected)} />
        ) : cur === 'security' ? (
          <SecurityPanel />
        ) : cur === 'outlook' ? (
          <OutlookPanel q={outlookQ} />
        ) : (
          <AppearancePanel />
        )}
      </div>
    </>
  );
}

/** The person's photo (or initials) in the prototype's avatar ring. */
function Face({ src, name, big }: { src: string | null | undefined; name: string; big?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <span className={'mx-lav me ins-face' + (big ? ' big' : '')} aria-hidden="true">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin /api/account/avatar
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        initialsFromName(name || 'U')
      )}
    </span>
  );
}

function useRefreshSession() {
  const { refreshAuth } = useApp();
  const { update } = useSession();
  return async () => {
    await update();
    await getSession();
    await refreshAuth();
  };
}

/* ---------------------------------------------------------------- profile */

function ProfilePanel({ q, staff, outlookConnected }: { q: ReturnType<typeof useProfile>; staff: boolean; outlookConnected: boolean }) {
  const { user } = useApp();
  const qc = useQueryClient();
  const say = useSay();
  const refreshSession = useRefreshSession();
  const p = q.data;
  const key = ['ins-profile', user?.id];
  const setP = (next: ProfileData) => qc.setQueryData(key, next);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const d = draft ?? (p ? draftOf(p) : null);
  const edit = (patch: Partial<ProfileDraft>) => d && setDraft({ ...d, ...patch });
  const [saving, setSaving] = useState(false);

  /* photo (live IdentityCard) */
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'outlook' | 'remove' | null>(null);
  const photo = preview || p?.avatarUrl || null;
  const afterPhoto = (url: string | null) => {
    if (p) setP({ ...p, avatarUrl: url });
    setPreview(null);
  };
  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy('upload');
    try {
      const dataUrl = await compressImageFile(file, 512, 0.82);
      const blob = await (await fetch(dataUrl)).blob();
      setPreview(dataUrl);
      const form = new FormData();
      form.append('file', new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
      const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        throw new Error(avatarErrorText(code) ?? errorMessage(body.error, 'Could not save photo.'));
      }
      afterPhoto((body.avatarUrl as string | null) ?? null);
      await refreshSession();
      say('Photo updated');
    } catch (err) {
      setPreview(null);
      say('Could not update photo', errorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  const outlookPhoto = async () => {
    setBusy('outlook');
    try {
      const res = await fetch('/api/account/avatar/outlook', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        throw new Error(outlookPhotoErrorText(code) ?? errorMessage(body.error, 'Could not fetch Outlook photo.'));
      }
      afterPhoto((body.avatarUrl as string | null) ?? null);
      await refreshSession();
      say('Outlook photo added');
    } catch (err) {
      say('Could not use Outlook photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };
  const removePhoto = async () => {
    setBusy('remove');
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(body.error, 'Could not remove photo.'));
      afterPhoto(null);
      await refreshSession();
      say('Photo removed');
    } catch (err) {
      say('Could not remove photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!p || !d) return;
    if (emailChanging(p, d) && !d.password) {
      say('Password required', 'Confirm with your current password to change email.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/account/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(profileBody(p, d)) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        throw new Error(profileErrorText(code) ?? errorMessage(body.error, 'Could not save profile.'));
      }
      setP(savedProfile(p, d, body.profile));
      setDraft(null);
      say('Profile updated');
      await refreshSession();
    } catch (err) {
      say("Couldn't save profile", errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (q.isLoading || (!p && !q.isError)) {
    return (
      <Panel title="Profile">
        <div className="sec-load">Loading your profile…</div>
      </Panel>
    );
  }
  if (!p || !d) {
    return (
      <Panel title="Profile">
        <ErrorBox title="Your profile did not load" detail={errorMessage(q.error, 'Could not load profile.')} onRetry={() => void q.refetch()} />
      </Panel>
    );
  }
  const changing = emailChanging(p, d);
  const e164 = normalizeToE164(d.whatsapp);
  const badNumber = d.whatsapp.trim() !== '' && !e164;
  const dirty = isDirty(p, d);

  return (
    <Panel title="Profile" sub="Your name, sign-in email, phone and WhatsApp">
      <div className="mx-prof">
        <Face src={photo} name={p.name || p.email} big />
        <div className="mx-chips">
          <Btn cls="sm" ico="up" disabled={busy !== null} onClick={() => fileRef.current?.click()}>
            {busy === 'upload' ? 'Uploading…' : 'Upload photo'}
          </Btn>
          {staff ? (
            <Btn cls="sm" ico="mail" disabled={busy !== null || !outlookConnected} title={outlookConnected ? undefined : 'Connect Outlook in the Outlook section to use your Microsoft photo'} onClick={() => void outlookPhoto()}>
              {busy === 'outlook' ? 'Fetching…' : 'Use Outlook photo'}
            </Btn>
          ) : null}
          {photo ? (
            <Btn cls="sm" ico="x" disabled={busy !== null} onClick={() => void removePhoto()}>
              {busy === 'remove' ? 'Removing…' : 'Remove'}
            </Btn>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
          className="ins-file"
          aria-label="Choose a photo"
          tabIndex={-1}
          onChange={(e) => void pickFile(e.target.files?.[0])}
        />
      </div>
      <form onSubmit={(e) => void save(e)}>
        <div className="mx-form2 one">
          <Field label="Full name">
            <input className="mx-in" value={d.name} maxLength={120} required onChange={(e) => edit({ name: e.target.value })} />
          </Field>
          <Field label="Email" hint="Your sign-in · changing it asks for your current password">
            <input className="mx-in" type="email" value={d.email} maxLength={160} required onChange={(e) => edit({ email: e.target.value })} />
          </Field>
          {changing ? (
            <Field label="Current password" hint="Confirms the email change">
              <input className="mx-in" type="password" autoComplete="current-password" required placeholder="Password to change email" value={d.password} onChange={(e) => edit({ password: e.target.value })} />
            </Field>
          ) : null}
          <Field label="Phone" hint="Optional">
            <input className="mx-in" type="tel" value={d.phone} maxLength={32} placeholder="+91 …" onChange={(e) => edit({ phone: e.target.value })} />
          </Field>
          <Field label="WhatsApp number" hint={badNumber ? undefined : 'Optional · with the country code'}>
            <input className="mx-in" type="tel" inputMode="tel" value={d.whatsapp} maxLength={24} placeholder="+91 98765 43210" aria-invalid={badNumber || undefined} onChange={(e) => edit({ whatsapp: e.target.value })} />
            {badNumber ? (
              <span className="mx-fh ins-bad" role="alert">
                Include the country code, e.g. +91 98765 43210
              </span>
            ) : null}
          </Field>
          <label className={'mx-sw ins-sw' + (e164 ? '' : ' off')}>
            <input type="checkbox" checked={d.optIn} disabled={!e164} onChange={(e) => edit({ optIn: e.target.checked })} />
            <i />
            <span>
              <b>Send me WhatsApp updates about my engagement on this number.</b>
              <span className="small"> Untick to withdraw, or reply STOP on WhatsApp at any time. Email stays the record.</span>
            </span>
          </label>
          <WhatsAppStatus phoneE164={p.phoneE164} optedIn={p.whatsappOptIn} />
          <Field label="Role" hint="Set by the admin">
            <input className="mx-in" value={roleLabelOf(p.role)} disabled readOnly />
          </Field>
        </div>
        <div className="mx-mfoot">
          <span className="sp" />
          {dirty ? (
            <Btn cls="sm" disabled={saving} onClick={() => setDraft(null)}>
              Discard changes
            </Btn>
          ) : null}
          <Btn type="submit" cls="pri" ico="check" disabled={saving || !dirty}>
            {saving ? 'Saving…' : 'Save profile'}
          </Btn>
        </div>
      </form>
    </Panel>
  );
}

function WhatsAppStatus({ phoneE164, optedIn }: { phoneE164: string; optedIn: boolean }) {
  const say = useSay();
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/account/whatsapp-test', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; reason?: string; error?: string };
      if (body.ok) say('Test sent', `Check WhatsApp on ${phoneE164}.`);
      else say('WhatsApp test not delivered', whatsappTestText(body));
    } catch (err) {
      say('WhatsApp test not delivered', errorMessage(err));
    } finally {
      setSending(false);
    }
  };
  return (
    <div className="mx-qi ins-wa">
      <span className="mx-ni">
        <Icon name="phone" />
      </span>
      <span className="mx-dt">
        <b>{phoneE164 ? <span className="ins-mono">{phoneE164}</span> : 'WhatsApp not set'}</b>
        <span>{phoneE164 ? (optedIn ? 'Updates on' : 'Updates off') : 'Add your number above, then save'}</span>
      </span>
      {phoneE164 && optedIn ? (
        <Btn cls="sm" ico="send" disabled={sending} onClick={() => void send()}>
          {sending ? 'Sending…' : 'Send test message'}
        </Btn>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- security */

function SecurityPanel() {
  const say = useSay();
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const clear = () => {
    setCur('');
    setNext('');
    setConfirm('');
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const bad = passwordProblem(next, confirm);
    if (bad) {
      say(bad.title, bad.desc);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: cur, newPassword: next }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        if (code === 'invalid_credentials') throw new Error('Current password is incorrect.');
        throw new Error(errorMessage(body.error, 'Could not update password.'));
      }
      say('Password updated');
      clear();
    } catch (err) {
      say("Couldn't update password", errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Security" sub="Change your password">
      <form onSubmit={(e) => void submit(e)}>
        <div className="mx-form2 one">
          <Field label="Current password">
            <input className="mx-in" type="password" autoComplete="current-password" required value={cur} onChange={(e) => setCur(e.target.value)} />
          </Field>
          <Field label="New password" hint="8+ characters">
            <input className="mx-in" type="password" autoComplete="new-password" required minLength={8} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
          <Field label="Confirm new password">
            <input className="mx-in" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
        </div>
        <div className="mx-mfoot">
          <span className="sp" />
          {cur || next || confirm ? (
            <Btn cls="sm" disabled={busy} onClick={clear}>
              Clear
            </Btn>
          ) : null}
          <Btn type="submit" cls="pri" ico="lock" disabled={busy}>
            {busy ? 'Updating…' : 'Update password'}
          </Btn>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------------------------------------------------------- outlook */

function OutlookPanel({ q }: { q: ReturnType<typeof useOutlook> }) {
  const { user } = useApp();
  const qc = useQueryClient();
  const say = useSay();
  const [busy, setBusy] = useState(false);
  const o = q.data;
  const disconnect = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/outlook/disconnect', { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'disconnect_failed');
      qc.setQueryData(['ins-outlook', user?.id], { configured: true, connected: false });
      say('Outlook disconnected');
    } catch (err) {
      say('Could not disconnect Outlook', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  let row: ReactNode;
  if (q.isLoading || !o) row = <Row b="Mailbox" s="Checking…" />;
  else if (!o.configured) row = <Row b="Not configured yet" s="Ask an admin." />;
  else
    row = (
      <Row
        b={o.connected && o.msEmail ? 'Connected' : 'Not connected'}
        s={o.connected && o.msEmail ? o.msEmail : 'Connect to send client emails from your own mailbox'}
        right={
          <>
            <span className={'pill ' + (o.connected ? 'ok' : 'mut')} title={o.connected ? 'Client emails send from this mailbox' : 'No mailbox linked'}>
              {o.connected ? 'Sending' : 'Off'}
            </span>
            {o.connected ? (
              <Btn cls="sm" disabled={busy} onClick={() => void disconnect()}>
                {busy ? 'Disconnecting…' : 'Disconnect'}
              </Btn>
            ) : (
              <Btn
                cls="sm pri"
                ico="mail"
                onClick={() => {
                  window.location.href = '/api/outlook/connect';
                }}
              >
                Connect Outlook
              </Btn>
            )}
          </>
        }
      />
    );
  return (
    <Panel title="Outlook" sub="The mailbox your client emails send from">
      {row}
    </Panel>
  );
}

function Row({ b, s, right }: { b: string; s: string; right?: ReactNode }) {
  return (
    <div className="mx-qi">
      <span className="mx-ni">
        <Icon name="mail" />
      </span>
      <span className="mx-dt">
        <b>{b}</b>
        <span className="ins-ell" title={s}>
          {s}
        </span>
      </span>
      {right ?? null}
    </div>
  );
}

/* ---------------------------------------------------------------- appearance */

function AppearancePanel() {
  const { theme, setTheme } = useConsole();
  const { setTheme: setAppTheme } = useTheme();
  const { prefs, update } = useShellAppearance();
  const pick = (t: 'light' | 'dark') => {
    setTheme(t);
    setAppTheme(t);
  };
  return (
    <Panel title="Appearance" sub="How the portal looks in this browser">
      <div className="ins-look">
        <div className="ins-lrow">
          <span className="mx-fl">Theme</span>
          <Seg<'light' | 'dark'>
            className="sm"
            ariaLabel="Theme"
            value={theme}
            onChange={pick}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
        <div className="ins-lrow">
          <span className="mx-fl">Animations</span>
          <Seg<MotionStyle> className="sm wrap" ariaLabel="Animations" value={prefs.motion} onChange={(v) => update({ motion: v })} options={MOTION_STYLES.map((m) => ({ value: m.id, label: m.label }))} />
          <span className="mx-fh">{MOTION_STYLES.find((m) => m.id === prefs.motion)?.hint}</span>
        </div>
        <label className="mx-sw">
          <input type="checkbox" checked={prefs.reduceMotion} onChange={(e) => update({ reduceMotion: e.target.checked })} />
          <i />
          <span>
            <b>Reduce motion</b>
          </span>
        </label>
      </div>
    </Panel>
  );
}
