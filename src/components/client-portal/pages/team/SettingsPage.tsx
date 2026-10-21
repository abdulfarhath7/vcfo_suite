'use client';

/**
 * Settings — prototype s/team/settings_redesign.dc.html (+ settings_password,
 * settings_whatsapp). Profile / avatar: `/api/account/profile`, `/api/account/avatar`;
 * password: NEW `/api/client/account/password` (also stamps "changed …");
 * preference matrix + quiet hours: NEW `/api/client/notification-prefs`;
 * theme: `usePortal().savePrefs`; reduce motion: shell appearance (local).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import type { NotificationPrefs, NotificationPrefsPatch, WhatsAppCategory, EmailOptional } from '@/lib/client-portal/notification-prefs';
import type { ClientTeamView } from '@/db/repositories/client-team';
import { usePortal } from '../../PortalProvider';
import { Dialog, Info, P, Seg, Svg, api, initialsOf, prettyPhone, shortDate } from './common';
import { PROFILE_KEY } from './NotificationsPage';
import '../../css/team-00-contract.css';
import '../../css/team-settings.css';

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  phoneE164: string | null;
  whatsappOptIn: boolean;
  whatsappStatus: string;
  avatarUrl: string | null;
};
const PREFS_KEY = ['client-portal', 'notification-prefs'] as const;
const PW_KEY = ['client-portal', 'password-changed'] as const;

const ROWS: Array<{ k: string; t: string; locked: boolean; bg: string; icon: string; em?: EmailOptional; wa?: WhatsAppCategory }> = [
  { k: 'docs', t: 'Documents requested or sent back', locked: true, bg: 'var(--due-chip)', icon: 'M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5', wa: 'docs' },
  { k: 'steps', t: 'Step accepted or needs changes', locked: true, bg: 'var(--ok-chip)', icon: 'M5 12.5 10 17.5 19 7', wa: 'steps' },
  { k: 'dead', t: 'Deadlines and reminders', locked: true, bg: 'var(--over-chip)', icon: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M12 8v4.2l2.8 1.8', wa: 'deadlines' },
  { k: 'time', t: 'Timeline changes', locked: true, bg: 'var(--prog-chip)', icon: 'M4 7h10 M4 12h16 M4 17h7', wa: 'timeline' },
  { k: 'ann', t: 'Announcements from SBC', locked: false, bg: 'var(--navy-3)', icon: 'M4 10h3l8-4.5v13L7 14H4Z', em: 'announcements', wa: 'announcements' },
  { k: 'feed', t: 'Official feed news (MCA, GST, Tax)', locked: false, bg: 'var(--sky-chip)', icon: 'M5 19a1 1 0 1 0 0 .01 M5 12a7 7 0 0 1 7 7 M5 5a14 14 0 0 1 14 14', em: 'feed', wa: 'feed' },
  { k: 'digest', t: 'Weekly summary · Monday 9 am', locked: false, bg: 'var(--violet-chip)', icon: 'M6 5.5h12v14H6Z M9 9.5h6 M9 13h6 M9 16.5h3', em: 'weeklyDigest' },
];

function Tgl({ on, label, tip, disabled, onClick }: { on: boolean; label: string; tip: string; disabled?: boolean; onClick: () => void }) {
  return (
    <span data-tip={tip} style={{ display: 'inline-flex' }}>
      <button type="button" className={`tgl${on ? ' on' : ''}`} aria-pressed={on} aria-label={label} disabled={disabled} onClick={onClick} />
    </span>
  );
}

/** "Chrome on Windows" from this browser's user agent. */
function thisDevice(): string {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'this device';
  return `${b} on ${o}`;
}

export function SettingsPage() {
  const { shell, toast, prefs, savePrefs, theme } = usePortal();
  const qc = useQueryClient();
  const prof = useQuery({ queryKey: PROFILE_KEY, queryFn: () => api<{ profile: Profile }>('/api/account/profile') });
  const team = useQuery({ queryKey: ['client-portal', 'team'], queryFn: () => api<ClientTeamView>('/api/client/team') });
  const np = useQuery({ queryKey: PREFS_KEY, queryFn: () => api<{ prefs: NotificationPrefs }>('/api/client/notification-prefs') });
  const pwq = useQuery({ queryKey: PW_KEY, queryFn: () => api<{ changedAt: string | null }>('/api/client/account/password') });
  const appearance = useShellAppearance();
  const p = prof.data?.profile;
  const company = shell?.companyName ?? '';
  const short = shell?.companyShort ?? 'you';

  /* deep-link anchors (#notifications from the Notifications page) */
  useEffect(() => {
    if (!p) return;
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [p]);

  const setProfile = (patch: Partial<Profile>) =>
    qc.setQueryData<{ profile: Profile }>(PROFILE_KEY, (o) => (o ? { profile: { ...o.profile, ...patch } } : o));

  /* ---------------- WhatsApp on / off ---------------- */
  const [waDialog, setWaDialog] = useState(false);
  const waOn = Boolean(p?.whatsappOptIn);
  const patchProfile = (body: Record<string, unknown>) =>
    api('/api/account/profile', { method: 'PATCH', json: { name: p?.name ?? shell?.me.name ?? 'Client', ...body } });
  const waOff = async () => {
    setProfile({ whatsappOptIn: false });
    try {
      await patchProfile({ whatsappOptIn: false });
      toast('WhatsApp turned off', {
        undo: () => {
          setProfile({ whatsappOptIn: true });
          patchProfile({ whatsappOptIn: true }).catch(() => {
            setProfile({ whatsappOptIn: false });
            toast('Could not turn WhatsApp back on');
          });
        },
      });
    } catch {
      setProfile({ whatsappOptIn: true });
      toast('Could not turn WhatsApp off');
    }
  };

  /* ---------------- preference matrix (optimistic) ---------------- */
  const prefsData = np.data?.prefs;
  const savePref = (patch: NotificationPrefsPatch) => {
    const prev = qc.getQueryData<{ prefs: NotificationPrefs }>(PREFS_KEY);
    if (prev)
      qc.setQueryData(PREFS_KEY, {
        prefs: {
          ...prev.prefs,
          email: { ...prev.prefs.email, ...(patch.email ?? {}) },
          whatsapp: { ...prev.prefs.whatsapp, ...(patch.whatsapp ?? {}) },
          quietHours: patch.quietHours ?? prev.prefs.quietHours,
        },
      });
    api<{ prefs: NotificationPrefs }>('/api/client/notification-prefs', { method: 'PATCH', json: patch })
      .then((r) => qc.setQueryData(PREFS_KEY, r))
      .catch(() => {
        if (prev) qc.setQueryData(PREFS_KEY, prev);
        toast('Could not save that change');
      });
  };

  /* ---------------- theme + motion ---------------- */
  const themePref = prefs?.theme ?? theme;
  const thIdx = themePref === 'dark' ? 1 : themePref === 'system' ? 2 : 0;
  const rm = appearance.prefs.reduceMotion;
  useEffect(() => {
    // app preference overrides; off → back to the OS setting the shell applies
    const os = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('.cp')?.setAttribute('data-reduce-motion', rm || os ? 'true' : 'false');
  }, [rm]);

  const isPrimary = team.data?.isPrimary;

  return (
    <div className="cp-team">
      <main className="pg tb-wrap tp-set">
        <div className="tb-g12">
          <div className="tb-s5">
            <Hero p={p} company={shell?.companyShort || company} isPrimary={isPrimary} setProfile={setProfile} />

            <ProfileCard p={p} setProfile={setProfile} />

            <SecurityCard changedAt={pwq.data?.changedAt ?? null} onChanged={(at) => qc.setQueryData(PW_KEY, { changedAt: at })} />
          </div>

          <div className="tb-s7">
            <section id="notifications" className="card t">
              <div className="ch">
                <span className="ic" style={{ background: 'var(--navy)' }}>
                  <Svg d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4.5 1.8 6.5 1.8 6.5H4.7S6.5 14.5 6.5 10Z M10 19.5a2.2 2.2 0 0 0 4 0" join={false} />
                </span>
                <h2 className="h3">Notifications</h2>
                <Info label="About notifications" about="notification settings">
                  Email is {short}’s record and stays on for anything that needs action. WhatsApp is a quick nudge on top.
                </Info>
              </div>
              <div className="tb-ch2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span className="circ" style={{ background: 'var(--prog-chip)' }}>
                    <Svg d={P.mail} size={20} sw={1.8} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rt" style={{ fontWeight: 800 }}>
                      Email
                    </div>
                    <div className="mono cap">{p?.email ?? ''}</div>
                  </div>
                  <span className="chip" style={{ background: 'var(--prog-light)', color: 'var(--prog-text)' }}>
                    Always on
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    ...(waOn ? {} : { background: 'var(--raised)' }),
                  }}
                >
                  <span className="circ" style={{ background: 'var(--ok)' }}>
                    <Svg d={P.wa} size={20} sw={1.8} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rt" style={{ fontWeight: 800 }}>
                      WhatsApp
                    </div>
                    <div className="mono cap">{p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}</div>
                  </div>
                  {waOn ? (
                    <Tgl on label="WhatsApp is on · click to turn off" tip="WhatsApp is on · click to turn off" onClick={() => void waOff()} />
                  ) : (
                    <button type="button" className="btn btn-n btn-sm" disabled={!p} onClick={() => setWaDialog(true)}>
                      Turn on
                    </button>
                  )}
                </div>
              </div>
              <div className="mx" style={{ borderTop: 0, paddingTop: 12, paddingBottom: 6 }}>
                <span />
                <span className="lbl">Tell me when</span>
                <span className="lbl" style={{ textAlign: 'center' }}>
                  Email
                </span>
                <span className="lbl" style={{ textAlign: 'center' }}>
                  WhatsApp
                </span>
              </div>
              {ROWS.map((r) => {
                const eOn = r.locked || Boolean(r.em && prefsData?.email[r.em]);
                const wOn = waOn && Boolean(r.wa && prefsData?.whatsapp[r.wa]);
                const etip = `Email ${eOn ? 'on' : 'off'} · ${r.t}`;
                const wtip = !waOn ? 'Turn on WhatsApp first' : `WhatsApp ${wOn ? 'on' : 'off'} · ${r.t}`;
                return (
                  <div key={r.k} className="mx">
                    <span className="ic" style={{ background: r.bg }}>
                      <Svg d={r.icon} size={14} />
                    </span>
                    <span className="rt">{r.t}</span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      {r.locked ? (
                        <span
                          className="chip"
                          data-tip={`Always on · email is ${short}’s record`}
                          style={{ background: 'var(--raised)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--border)' }}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                            <path d="M6 10.5h12v9.5H6Z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
                          </svg>
                          On
                        </span>
                      ) : (
                        <Tgl on={eOn} label={etip} tip={etip} disabled={!prefsData} onClick={() => r.em && savePref({ email: { [r.em]: !eOn } })} />
                      )}
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      {r.wa ? (
                        <Tgl
                          on={wOn}
                          label={wtip}
                          tip={wtip}
                          disabled={!waOn || !prefsData}
                          onClick={() => r.wa && savePref({ whatsapp: { [r.wa]: !prefsData?.whatsapp[r.wa] } })}
                        />
                      ) : (
                        <span className="cap">—</span>
                      )}
                    </span>
                  </div>
                );
              })}
              <div className="mx" style={{ background: 'var(--raised)', borderRadius: '0 0 10px 10px' }}>
                <span className="ic" style={{ background: 'var(--navy-2)' }}>
                  <Svg d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" size={14} />
                </span>
                <span className="rt">Quiet hours · no WhatsApp 9 pm – 8 am</span>
                <span />
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  {(() => {
                    const q = prefsData?.quietHours ?? true;
                    const qtip = !waOn ? 'Turn on WhatsApp first' : `Quiet hours ${q ? 'on' : 'off'}`;
                    return <Tgl on={q && waOn} label={qtip} tip={qtip} disabled={!waOn || !prefsData} onClick={() => savePref({ quietHours: !q })} />;
                  })()}
                </span>
              </div>
            </section>

            <section id="appearance" className="card">
              <div className="ch">
                <span className="ic" style={{ background: 'var(--navy)' }}>
                  <Svg d="M12 3.5a8.5 8.5 0 1 0 0 17c1 0 1.5-.7 1.5-1.5 0-1.2-1-1.6-1-2.6 0-.9.7-1.4 1.6-1.4H16a4.5 4.5 0 0 0 4.5-4.5c0-4-3.8-7-8.5-7Z M7.5 12h.01 M10 8h.01 M14.5 8h.01" />
                </span>
                <h2 className="h3">Appearance</h2>
              </div>
              <div className="tb-app">
                <div>
                  <div className="lbl" style={{ marginBottom: 8 }}>
                    Theme
                  </div>
                  <Seg
                    tabs={[{ label: 'Light' }, { label: 'Dark' }, { label: 'System' }]}
                    active={thIdx}
                    label="Theme"
                    wrap={false}
                    onPick={(i) => {
                      const v = (['light', 'dark', 'system'] as const)[i];
                      try {
                        localStorage.setItem('vcfo.theme', JSON.stringify(v));
                      } catch {
                        /* private mode */
                      }
                      savePrefs({ theme: v });
                    }}
                  />
                </div>
                <div>
                  <div className="lbl" style={{ marginBottom: 8 }}>
                    Reduce motion
                  </div>
                  <Tgl
                    on={rm}
                    label={`Reduce motion ${rm ? 'on' : 'off'}`}
                    tip={`Reduce motion ${rm ? 'on' : 'off'}`}
                    onClick={() => appearance.update({ reduceMotion: !rm })}
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {waDialog && p ? (
        <WhatsAppDialog
          p={p}
          company={short}
          onClose={() => setWaDialog(false)}
          onDone={(phoneE164) => {
            setProfile({ whatsappOptIn: true, phoneE164 });
            setWaDialog(false);
            toast('WhatsApp is on');
          }}
          patchProfile={patchProfile}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Hero({
  p,
  company,
  isPrimary,
  setProfile,
}: {
  p?: Profile;
  company: string;
  isPrimary?: boolean;
  setProfile: (x: Partial<Profile>) => void;
}) {
  const { toast } = usePortal();
  const [menu, setMenu] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const out = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setMenu(false);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  const upload = async (f: File) => {
    const fd = new FormData();
    fd.append('file', f);
    try {
      const r = await fetch('/api/account/avatar', { method: 'POST', body: fd });
      const d = (await r.json()) as { avatarUrl?: string | null; error?: string };
      if (!r.ok) throw new Error(d.error === 'file_too_large' ? 'That photo is too large' : d.error === 'unsupported_type' ? 'Use a JPG, PNG or WebP photo' : 'Upload failed');
      setProfile({ avatarUrl: d.avatarUrl ?? null });
      toast('Photo updated');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    }
  };
  const remove = async () => {
    try {
      await api('/api/account/avatar', { method: 'DELETE' });
      setProfile({ avatarUrl: null });
      toast('Photo removed');
    } catch {
      toast('Could not remove the photo');
    }
  };
  const name = p?.name ?? '';
  return (
    <section
      style={{
        position: 'relative',
        borderRadius: 10,
        padding: 18,
        background: 'linear-gradient(115deg,var(--navy-deep,var(--navy)) 0%,var(--navy-2-deep,var(--navy-2)) 60%,var(--navy-3-deep,var(--navy-3)) 100%)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ position: 'relative', flex: 'none' }} ref={wrap}>
        <span
          style={{
            width: 72,
            height: 72,
            borderRadius: 99,
            background: 'var(--primary-fill,var(--primary))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: '700 22px Space Grotesk',
            boxShadow: '0 0 0 3px oklch(100% 0 0 / .25)',
            overflow: 'hidden',
          }}
        >
          {p?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initialsOf(name || ' ')
          )}
        </span>
        <button
          type="button"
          aria-label="Change photo"
          aria-haspopup="menu"
          aria-expanded={menu}
          data-tip="Change photo"
          onClick={() => setMenu((m) => !m)}
          style={{
            position: 'absolute',
            right: -4,
            bottom: -4,
            width: 28,
            height: 28,
            borderRadius: 6,
            border: 0,
            background: 'var(--gold)',
            color: 'var(--navy)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <Svg d="M4 8h3l2-2.5h6L17 8h3v11H4Z M12 10.5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4Z" size={14} />
        </button>
        {menu ? (
          <div className="tb-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenu(false);
                file.current?.click();
              }}
            >
              Upload a photo
            </button>
            {p?.avatarUrl ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenu(false);
                  void remove();
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>
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
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="metric" style={{ fontSize: 22, color: '#fff' }}>
          {name || <span className="sk" style={{ display: 'inline-block', width: 160, height: 20, opacity: 0.3 }} />}
        </div>
        <div className="mono" style={{ fontSize: 11, opacity: 0.75, marginTop: 2, overflowWrap: 'anywhere' }}>
          {p?.email ?? ''}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {isPrimary !== undefined ? (
            <span className="chip" style={isPrimary ? { background: 'var(--gold)', color: 'var(--navy)' } : { background: 'oklch(100% 0 0 / .14)', color: '#fff' }}>
              {isPrimary ? 'Primary' : 'Member'}
            </span>
          ) : null}
          {company ? (
            <span className="chip" style={{ background: 'oklch(100% 0 0 / .14)', color: '#fff' }}>
              {company}
            </span>
          ) : null}
        </div>
      </div>
      <span style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'linear-gradient(90deg,var(--gold),oklch(78% 0.1 85 / 0) 70%)', borderRadius: '0 0 10px 10px' }} />
    </section>
  );
}

function ProfileCard({ p, setProfile }: { p?: Profile; setProfile: (x: Partial<Profile>) => void }) {
  const { toast } = usePortal();
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const start = () => {
    setName(p?.name ?? '');
    setEmail(p?.email ?? '');
    setPhone(p?.phone ?? '');
    setPw('');
    setErr('');
    setEdit(true);
  };
  const emailChanging = Boolean(p && email.trim().toLowerCase() !== p.email);
  const save = async () => {
    if (!name.trim()) return setErr('Enter your name.');
    if (emailChanging && !pw) return setErr('Enter your password to change your email.');
    setBusy(true);
    setErr('');
    try {
      await api('/api/account/profile', {
        method: 'PATCH',
        json: { name: name.trim(), phone: phone.trim() || null, ...(emailChanging ? { email: email.trim(), currentPassword: pw } : {}) },
      });
      setProfile({ name: name.trim(), phone: phone.trim() || null, ...(emailChanging ? { email: email.trim().toLowerCase() } : {}) });
      void qc.invalidateQueries({ queryKey: ['client-portal', 'shell'] });
      setEdit(false);
      toast('Profile saved');
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setErr(m === 'invalid_credentials' ? 'That password is not right.' : m === 'email_already_registered' ? 'That email is already in use.' : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };
  const waChip = p?.whatsappOptIn
    ? p.whatsappStatus === 'verified'
      ? { t: 'Verified', s: { background: 'var(--ok-light)', color: 'var(--ok-text)' } }
      : { t: 'On', s: { background: 'var(--ok-light)', color: 'var(--ok-text)' } }
    : { t: 'Off', s: { background: 'var(--raised)', color: 'var(--muted)' } };
  return (
    <section id="profile" className="card">
      <div className="ch" style={{ paddingBottom: 4 }}>
        <span className="ic" style={{ background: 'var(--navy)' }}>
          <Svg d="M12 12a4 4 0 1 0 0-8a4 4 0 1 0 0 8Z M4.5 20c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5" join={false} />
        </span>
        <h2 className="h3">Profile</h2>
        {!edit ? (
          <button type="button" className="btn btn-g btn-sm" style={{ marginLeft: 'auto' }} disabled={!p} onClick={start}>
            Edit
          </button>
        ) : null}
      </div>
      <div style={{ padding: '4px 18px 12px' }}>
        {edit ? (
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 8, background: 'var(--raised)', margin: '4px 0 8px' }}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="fl">
              Full name
              <input className="inp" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            <label className="fl">
              Email
              <input className="inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            {emailChanging ? (
              <label className="fl">
                Current password
                <input className="inp" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" />
              </label>
            ) : null}
            <label className="fl">
              Phone
              <input className="inp" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </label>
            {err ? (
              <div className="tb-err" role="alert">
                {err}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn btn-g btn-sm" onClick={() => setEdit(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-n btn-sm" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="kv">
              <span className="k">Full name</span>
              <span className="rt">{p?.name ?? ''}</span>
              <span />
            </div>
            <div className="kv">
              <span className="k">Email</span>
              <span className="rt mono" style={{ fontSize: 12 }}>
                {p?.email ?? ''}
              </span>
              <Info label="About changing email" about="changing my sign-in email" size={14} popStyle={{ left: 'auto', right: -8, transform: 'none' }}>
                Changing email needs your password. Sign-in moves to the new address.
              </Info>
            </div>
            <div className="kv">
              <span className="k">Phone</span>
              <span className="rt mono" style={{ fontSize: 12 }}>
                {p?.phone || prettyPhone(p?.phoneE164) || '—'}
              </span>
              <span />
            </div>
            <div className="kv">
              <span className="k">WhatsApp</span>
              <span className="rt mono" style={{ fontSize: 12 }}>
                {p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}
              </span>
              <span className="chip" style={waChip.s}>
                {waChip.t}
              </span>
            </div>
          </>
        )}
      </div>
    </section>
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

function SecurityCard({ changedAt, onChanged }: { changedAt: string | null; onChanged: (at: string) => void }) {
  const { toast } = usePortal();
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const s = strength(nw);
  const device = useMemo(() => thisDevice(), []);
  const barColor = s.score >= 4 ? 'var(--ok)' : s.score === 3 ? 'var(--ok)' : s.score === 2 ? 'var(--due)' : 'var(--over)';
  const save = async () => {
    if (!cur) return setErr('Enter your current password.');
    if (!s.len) return setErr('Use at least 8 characters.');
    if (nw !== cf) return setErr('The new passwords do not match.');
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ changedAt: string }>('/api/client/account/password', { method: 'POST', json: { currentPassword: cur, newPassword: nw } });
      onChanged(r.changedAt);
      setOpen(false);
      setCur('');
      setNw('');
      setCf('');
      toast('Password changed');
    } catch (e) {
      setErr(e instanceof Error && e.message === 'invalid_credentials' ? 'Your current password is not right.' : 'Could not change the password.');
    } finally {
      setBusy(false);
    }
  };
  const chipOk = (on: boolean) => (on ? { background: 'var(--ok-light)', color: 'var(--ok-text)' } : { background: 'var(--raised)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1px var(--border)' });
  return (
    <section id="security" className="card">
      <div className="ch" style={{ paddingBottom: 4 }}>
        <span className="ic" style={{ background: 'var(--navy)' }}>
          <Svg d="M6 10.5h12v9.5H6Z M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
        </span>
        <h2 className="h3">Security</h2>
      </div>
      <div style={{ padding: '4px 18px 14px' }}>
        <div className="kv">
          <span className="k">Password</span>
          <span>
            <span className="mono rt">••••••••</span>
            {changedAt ? (
              <span className="cap" style={{ marginLeft: 8, display: 'inline-block', whiteSpace: 'nowrap' }}>
                changed {shortDate(changedAt)}
              </span>
            ) : null}
          </span>
          {!open ? (
            <button type="button" className="btn btn-o btn-sm" onClick={() => setOpen(true)}>
              Change
            </button>
          ) : (
            <span />
          )}
        </div>
        {open ? (
          <form
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 8, background: 'var(--raised)', margin: '4px 0 8px' }}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="fl">
              Current password
              <input className="inp" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" />
            </label>
            <label className="fl">
              New password
              <input className="inp" type="password" value={nw} onChange={(e) => setNw(e.target.value)} autoComplete="new-password" />
            </label>
            <div style={{ display: 'flex', gap: 4 }} aria-label={`Strength: ${s.verdict ? s.verdict.toLowerCase() : 'none'}`} role="img">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} style={{ flex: 1, height: 5, borderRadius: 2, background: i < s.score ? barColor : 'var(--border)' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className="chip" style={chipOk(s.len)}>
                {s.len ? '✓ ' : ''}8+ characters
              </span>
              <span className="chip" style={chipOk(s.num)}>
                {s.num ? '✓ ' : ''}Number
              </span>
              <span className="chip" style={chipOk(s.sym)}>
                {s.sym ? '✓ ' : ''}Symbol
              </span>
              {s.verdict ? (
                <span
                  className="chip"
                  style={{
                    background: s.score >= 4 ? 'var(--ok-chip)' : s.score === 3 ? 'var(--prog-chip)' : s.score === 2 ? 'var(--due-chip)' : 'var(--over-chip)',
                    color: '#fff',
                    minWidth: 116,
                    justifyContent: 'center',
                  }}
                >
                  {s.verdict}
                </span>
              ) : null}
            </div>
            <label className="fl">
              Confirm new password
              <input
                className="inp"
                type="password"
                value={cf}
                onChange={(e) => setCf(e.target.value)}
                autoComplete="new-password"
                style={cf ? { borderColor: cf === nw ? 'var(--ok)' : 'var(--over)' } : undefined}
              />
            </label>
            {err ? (
              <div className="tb-err" role="alert">
                {err}
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="btn btn-g btn-sm"
                onClick={() => {
                  setOpen(false);
                  setErr('');
                }}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-n btn-sm" disabled={busy}>
                Save password
              </button>
            </div>
          </form>
        ) : null}
        <div className="kv">
          <span className="k">This device</span>
          <span className="rt">{device}</span>
          <span className="chip" style={{ background: 'var(--ok-light)', color: 'var(--ok-text)' }}>
            Active now
          </span>
        </div>
      </div>
    </section>
  );
}

/**
 * Turn on WhatsApp. The 6-digit code step is NOT live: the WhatsApp transport
 * has no approved verification template yet (QUESTIONS.md, area team), so the
 * pop-up records the number + consent through the existing opt-in.
 */
function WhatsAppDialog({
  p,
  company,
  onClose,
  onDone,
  patchProfile,
}: {
  p: Profile;
  company: string;
  onClose: () => void;
  onDone: (phoneE164: string) => void;
  patchProfile: (b: Record<string, unknown>) => Promise<unknown>;
}) {
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
    } catch {
      setErr('Could not turn WhatsApp on. Try again.');
      setBusy(false);
    }
  };
  return (
    <DialogShell onClose={onClose}>
      <div className="dlg-h">
        <span className="ic" style={{ background: 'var(--ok)' }}>
          <Svg d={P.waShort} />
        </span>
        <h2 id="wa-t" style={{ margin: 0, font: '700 16px Manrope', color: 'var(--navy-ink,var(--navy))' }}>
          Turn on WhatsApp
        </h2>
        <button type="button" className="ibtn" aria-label="Close" style={{ marginLeft: 'auto', border: 0 }} onClick={onClose}>
          <Svg d={P.x} size={16} join={false} />
        </button>
      </div>
      <form
        className="dlg-b"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="node" style={{ background: valid ? 'var(--ok-chip)' : 'var(--navy)', width: 24, height: 24, boxShadow: 'none', font: '700 11px Manrope' }}>
            {valid ? <Svg d={P.check} size={12} sw={3} join={false} /> : '1'}
          </span>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Number</span>
          <span style={{ flex: 1, height: 2, ...(valid ? { background: 'var(--ok)' } : { borderTop: '2px dashed var(--border)' }) }} />
          <span
            className={`node${valid ? ' pulse' : ''}`}
            style={{
              width: 24,
              height: 24,
              font: '700 11px Manrope',
              ...(valid ? { background: 'var(--navy)', boxShadow: 'none' } : { background: 'var(--panel)', color: 'var(--muted)', boxShadow: 'inset 0 0 0 1.5px var(--border)' }),
            }}
          >
            2
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, ...(valid ? {} : { color: 'var(--muted)' }) }}>Consent</span>
          <span style={{ flex: 1, height: 2, borderTop: '2px dashed var(--border)' }} />
          <span className="node" style={{ background: 'var(--panel)', color: 'var(--muted)', width: 24, height: 24, boxShadow: 'inset 0 0 0 1.5px var(--border)', font: '700 11px Manrope' }}>
            3
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Done</span>
        </div>
        <label className="fl">
          WhatsApp number
          <span style={{ display: 'flex', gap: 8 }}>
            <span className="inp mono" style={{ width: 70, display: 'flex', alignItems: 'center' }}>
              +91
            </span>
            <input className="inp mono" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} style={{ flex: 1 }} autoComplete="tel-national" />
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, fontWeight: 600, lineHeight: 1.4 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 16, height: 16, marginTop: 1, accentColor: 'var(--navy)' }} />
          Send me WhatsApp updates about {company}. Reply STOP to stop.
        </label>
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
        <button type="button" className="btn btn-n" disabled={busy} onClick={() => void submit()}>
          Turn on
        </button>
      </div>
    </DialogShell>
  );
}

function DialogShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog labelledBy="wa-t" width={460} onClose={onClose} tp="tp-set">
      {children}
    </Dialog>
  );
}
