'use client';

/**
 * Settings — prototype s/team/settings_redesign.dc.html (+ settings_password,
 * settings_whatsapp). Profile / avatar: `/api/account/profile`, `/api/account/avatar`;
 * password: NEW `/api/client/account/password` (also stamps "changed …");
 * preference matrix + quiet hours: NEW `/api/client/notification-prefs`;
 * theme: `usePortal().savePrefs`; reduce motion: shell appearance (local).
 * VCFO Spectrum (C-0027, C-0110, R-42): white heads, underline section tabs that
 * switch in place (Profile, Notifications, Appearance, Team), and the Team section
 * shared with the Team page. `#notifications`, `#appearance` and `#team` open their tab.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useShellAppearance } from '@/hooks/use-shell-appearance';
import type { NotificationPrefs, NotificationPrefsPatch, WhatsAppCategory, EmailOptional } from '@/lib/client-portal/notification-prefs';
import { usePortal } from '../../PortalProvider';
import { CardHead, Dialog, P, SChip, STag, Seg, Svg, Tile, api, initialsOf, prettyPhone, shortDate, type TileTone } from './common';
import { PROFILE_KEY } from './NotificationsPage';
import { TeamSection, useClientTeam } from './team-sections';
import '../../css/team-00-contract.css';
import '../../css/team-settings.css';
import '../../css/team-team.css';

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

const ROWS: Array<{ k: string; t: string; locked: boolean; tone: TileTone; icon: string; em?: EmailOptional; wa?: WhatsAppCategory }> = [
  { k: 'docs', t: 'Documents requested or sent back', locked: true, tone: 'amber', icon: 'M7 3.5h7l4 4v13H7Z M14 3.5v4h4 M10 13h5 M10 16.5h5', wa: 'docs' },
  { k: 'steps', t: 'Step accepted or needs changes', locked: true, tone: 'green', icon: 'M5 12.5 10 17.5 19 7', wa: 'steps' },
  { k: 'dead', t: 'Deadlines and reminders', locked: true, tone: 'red', icon: 'M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M12 8v4.2l2.8 1.8', wa: 'deadlines' },
  { k: 'time', t: 'Timeline changes', locked: true, tone: 'teal', icon: 'M4 7h10 M4 12h16 M4 17h7', wa: 'timeline' },
  { k: 'ann', t: 'Announcements from SBC', locked: false, tone: 'amber', icon: 'M4 10h3l8-4.5v13L7 14H4Z', em: 'announcements', wa: 'announcements' },
  { k: 'feed', t: 'Official feed news (MCA, GST, Tax)', locked: false, tone: 'blue', icon: 'M5 19a1 1 0 1 0 0 .01 M5 12a7 7 0 0 1 7 7 M5 5a14 14 0 0 1 14 14', em: 'feed', wa: 'feed' },
  { k: 'digest', t: 'Weekly summary · Monday 9 am', locked: false, tone: 'violet', icon: 'M6 5.5h12v14H6Z M9 9.5h6 M9 13h6 M9 16.5h3', em: 'weeklyDigest' },
];

/** Section tabs (R-11 underline tabs, R-36 switch in place). The hash names the tab. */
const SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'team', label: 'Team' },
] as const;
type SectionId = (typeof SECTIONS)[number]['id'];
function sectionOf(hash: string): SectionId {
  const h = hash.replace(/^#/, '');
  return h === 'notifications' || h === 'appearance' || h === 'team' ? h : 'profile';
}

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
  const team = useClientTeam();
  const np = useQuery({ queryKey: PREFS_KEY, queryFn: () => api<{ prefs: NotificationPrefs }>('/api/client/notification-prefs') });
  const pwq = useQuery({ queryKey: PW_KEY, queryFn: () => api<{ changedAt: string | null }>('/api/client/account/password') });
  const appearance = useShellAppearance();
  const p = prof.data?.profile;
  const company = shell?.companyName ?? '';
  const short = shell?.companyShort ?? 'you';

  /* deep links: #notifications from the Notifications page, #team (C-0027) */
  const [sec, setSec] = useState<SectionId>('profile');
  useEffect(() => {
    const on = () => setSec(sectionOf(window.location.hash));
    on();
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const pick = (id: SectionId) => {
    setSec(id);
    try {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${id}`);
    } catch {
      /* the hash is a convenience only */
    }
  };
  useEffect(() => {
    if (!p) return;
    const id = window.location.hash.slice(1);
    if (id === 'security') document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        <div className="sx-tabs tb-sectabs" role="tablist" aria-label="Profile sections">
          {SECTIONS.map((x) => (
            <button key={x.id} type="button" role="tab" id={`set-tab-${x.id}`} aria-selected={sec === x.id} aria-controls={`set-${x.id}`} onClick={() => pick(x.id)}>
              {x.label}
            </button>
          ))}
        </div>

        {sec === 'profile' ? (
          <div className="tb-g12" role="tabpanel" id="set-profile" aria-labelledby="set-tab-profile">
            <div className="tb-s7">
              <ProfileCard p={p} setProfile={setProfile} hero={<Hero p={p} company={shell?.companyShort || company} isPrimary={isPrimary} setProfile={setProfile} />} />
            </div>
            <div className="tb-s5">
              <SecurityCard changedAt={pwq.data?.changedAt ?? null} onChanged={(at) => qc.setQueryData(PW_KEY, { changedAt: at })} />
            </div>
          </div>
        ) : null}

        {sec === 'notifications' ? (
          <div role="tabpanel" id="set-notifications" aria-labelledby="set-tab-notifications">
            <section id="notifications" className="sx-card tb-notifcard">
              <CardHead d={P.bell} tone="amber" title="Notifications" />
              <div className="tb-ch2">
                <div className="tb-chan">
                  <Tile d={P.mail} tone="blue" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rt" style={{ fontWeight: 500 }}>
                      Email
                    </div>
                    <div className="cap">{p?.email ?? ''}</div>
                  </div>
                  <STag tone="prog">Always on</STag>
                </div>
                <div className="tb-chan" data-off={waOn ? undefined : ''}>
                  <Tile d={P.waShort} tone="green" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="rt" style={{ fontWeight: 500 }}>
                      WhatsApp
                    </div>
                    <div className="cap">{p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}</div>
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
              <div className="mx mx-h">
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
                    <Tile d={r.icon} tone={r.tone} />
                    <span className="rt">{r.t}</span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      {r.locked ? (
                        <span className="chip tb-lock" data-tip={`Always on · email is ${short}’s record`}>
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
              <div className="mx">
                <Tile d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z" tone="violet" />
                <span className="rt">Quiet hours · no WhatsApp 9 pm to 8 am</span>
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
          </div>
        ) : null}

        {sec === 'appearance' ? (
          <div role="tabpanel" id="set-appearance" aria-labelledby="set-tab-appearance">
            <section id="appearance" className="sx-card">
              <CardHead d="M12 4.5a7.5 7.5 0 1 0 0 15a7.5 7.5 0 1 0 0-15Z M12 4.5v15" title="Appearance" />
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
                    grid={false}
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
        ) : null}

        {sec === 'team' ? (
          <div role="tabpanel" id="set-team" aria-labelledby="set-tab-team">
            <TeamSection />
          </div>
        ) : null}
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
  /* C-0110: a white head, no navy band. Avatar, name, email and the access chips. */
  return (
    <div className="tb-hero">
      <div style={{ position: 'relative', flex: 'none' }} ref={wrap}>
        <span className="av" style={{ width: 64, height: 64, fontSize: 20, background: 'oklch(var(--brand))', overflow: 'hidden' }}>
          {p?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            initialsOf(name || ' ')
          )}
        </span>
        <button
          type="button"
          className="ibtn tb-photo"
          aria-label="Change photo"
          aria-haspopup="menu"
          aria-expanded={menu}
          data-tip="Change photo"
          onClick={() => setMenu((m) => !m)}
        >
          <Svg d="M4 8h3l2-2.5h6L17 8h3v11H4Z M12 10.5a3.2 3.2 0 1 0 0 6.4a3.2 3.2 0 1 0 0-6.4Z" size={14} sw={1.8} />
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
        <div style={{ font: '500 18px/1.3 var(--font-sans),sans-serif', color: 'oklch(var(--ink))' }}>
          {name || <span className="sk" style={{ display: 'inline-block', width: 160, height: 18 }} />}
        </div>
        <div className="cap" style={{ marginTop: 2, overflowWrap: 'anywhere' }}>
          {p?.email ?? ''}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {isPrimary !== undefined ? <SChip tone={isPrimary ? 'prog' : 'idle'}>{isPrimary ? 'Primary' : 'Member'}</SChip> : null}
          {company ? <STag>{company}</STag> : null}
        </div>
      </div>
    </div>
  );
}

function ProfileCard({ p, setProfile, hero }: { p?: Profile; setProfile: (x: Partial<Profile>) => void; hero: ReactNode }) {
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
      ? { t: 'Verified', tone: 'ok' as const }
      : { t: 'On', tone: 'ok' as const }
    : { t: 'Off', tone: 'idle' as const };
  return (
    <section id="profile" className="sx-card">
      <CardHead d={P.users} tone="violet" title="Profile">
        {!edit ? (
          <button type="button" className="btn btn-o btn-sm" disabled={!p} onClick={start}>
            Edit
          </button>
        ) : null}
      </CardHead>
      {hero}
      <div style={{ padding: '0 16px 12px' }}>
        {edit ? (
          <form className="tb-form"
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
              <span className="rt">{p?.email ?? ''}</span>
              <span />
            </div>
            <div className="kv">
              <span className="k">Phone</span>
              <span className="rt">{p?.phone || prettyPhone(p?.phoneE164) || '—'}</span>
              <span />
            </div>
            <div className="kv">
              <span className="k">WhatsApp</span>
              <span className="rt">{p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}</span>
              <SChip tone={waChip.tone}>{waChip.t}</SChip>
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
  const barColor = s.score >= 3 ? 'oklch(var(--positive-mid))' : s.score === 2 ? 'oklch(var(--warning-mid))' : 'oklch(var(--danger-mid))';
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
  const chipOk = (on: boolean) => (on ? 'tb-req on' : 'tb-req');
  return (
    <section id="security" className="sx-card">
      <CardHead d="M12 3.5 19 6v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6Z M9 12l2 2 4-4" tone="green" title="Sign-in and security" />
      <div style={{ padding: '0 16px 12px' }}>
        <div className="kv">
          <span className="k">Password</span>
          <span>
            <span className="rt">••••••••</span>
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
            className="tb-form"
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
                <span key={i} style={{ flex: 1, height: 4, borderRadius: 3, background: i < s.score ? barColor : 'oklch(var(--line))' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <span className={`chip ${chipOk(s.len)}`}>{s.len ? '✓ ' : ''}8+ characters</span>
              <span className={`chip ${chipOk(s.num)}`}>{s.num ? '✓ ' : ''}Number</span>
              <span className={`chip ${chipOk(s.sym)}`}>{s.sym ? '✓ ' : ''}Symbol</span>
              {s.verdict ? <SChip tone={s.score >= 3 ? 'ok' : s.score === 2 ? 'warn' : 'bad'}>{s.verdict}</SChip> : null}
            </div>
            <label className="fl">
              Confirm new password
              <input
                className="inp"
                type="password"
                value={cf}
                onChange={(e) => setCf(e.target.value)}
                autoComplete="new-password"
                style={cf ? { borderColor: cf === nw ? 'oklch(var(--positive))' : 'oklch(var(--danger))' } : undefined}
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
          <SChip tone="ok">Active now</SChip>
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
        <Tile d={P.waShort} tone="green" />
        <h2 id="wa-t" style={{ margin: 0 }}>
          Turn on WhatsApp
        </h2>
        <button type="button" className="ibtn ghost" aria-label="Close" style={{ marginLeft: 'auto' }} onClick={onClose}>
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
        {/* ST5 marks (R-22): done is a green square with a tick, the live step blurple, the next one dashed */}
        <div className="tb-steps">
          <span className={`tb-mk ${valid ? 'done' : 'now'}`}>{valid ? <Svg d={P.check} size={12} sw={3} join={false} /> : '1'}</span>
          <span className="tb-mkl">Number</span>
          <span className={`tb-mkb${valid ? ' done' : ''}`} />
          <span className={`tb-mk ${valid ? 'now' : 'next'}`}>2</span>
          <span className={`tb-mkl${valid ? '' : ' off'}`}>Consent</span>
          <span className="tb-mkb" />
          <span className="tb-mk next">3</span>
          <span className="tb-mkl off">Done</span>
        </div>
        <label className="fl">
          WhatsApp number
          <span style={{ display: 'flex', gap: 8 }}>
            <span className="inp" style={{ width: 70, display: 'flex', alignItems: 'center' }}>
              +91
            </span>
            <input className="inp" inputMode="tel" value={num} onChange={(e) => setNum(e.target.value)} style={{ flex: 1 }} autoComplete="tel-national" />
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, lineHeight: 1.4 }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 0, flex: 'none' }} />
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
