'use client';

/**
 * The Settings section of the client Profile (prototype profile-settings `ClientSettingsView`,
 * settings_redesign): from 1280 px a 400 px left column (the profile head, Profile, Security)
 * and a fluid right column (Notifications, Appearance). Every change shows a toast with Undo.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlignLeft, Camera, Check, Clock, FileText, Lock, Megaphone, Moon, Rss, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import type { EmailOptional, WhatsAppCategory } from '@/lib/client-portal/notification-prefs';
import { cn } from '@/lib/utils';
import { usePortal } from '../../../PortalProvider';
import { SCard } from '../../compliances/spectrum';
import { api, initialsOf, prettyPhone, shortDate } from '../common';
import { useClientTeam } from '../team-sections';
import { PasswordForm } from './password-form';
import { MotionSwitch, PhotoInput, ThemePicker, usePhoto, useWhatsApp } from './sections';
import { clock12, thisDevice, useProfileData } from './use-profile';

type Tone = 'brand' | 'amber' | 'green' | 'red' | 'teal' | 'violet';
const TONE: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-text',
  amber: 'bg-warning-soft text-warning',
  green: 'bg-positive-soft text-positive',
  red: 'bg-danger-soft text-danger',
  teal: 'bg-waiting-soft text-waiting',
  violet: 'bg-identity-soft text-identity',
};

/** R-16: the tinted 28 px icon tile on each alert row. */
function RowTile({ Icon, tone }: { Icon: LucideIcon; tone: Tone }) {
  return (
    <span className={cn('grid h-7 w-7 flex-none place-items-center rounded-md', TONE[tone])} aria-hidden>
      <Icon size={15} strokeWidth={1.8} />
    </span>
  );
}

const ROWS: Array<{ k: string; t: string; locked: boolean; Icon: LucideIcon; tone: Tone; em?: EmailOptional; wa?: WhatsAppCategory }> = [
  { k: 'docs', t: 'Documents requested or sent back', locked: true, Icon: FileText, tone: 'amber', wa: 'docs' },
  { k: 'steps', t: 'Step accepted or needs changes', locked: true, Icon: Check, tone: 'green', wa: 'steps' },
  { k: 'dead', t: 'Deadlines and reminders', locked: true, Icon: Clock, tone: 'red', wa: 'deadlines' },
  { k: 'time', t: 'Timeline changes', locked: true, Icon: AlignLeft, tone: 'brand', wa: 'timeline' },
  { k: 'ann', t: 'Announcements from SBC', locked: false, Icon: Megaphone, tone: 'brand', em: 'announcements', wa: 'announcements' },
  { k: 'feed', t: 'Official feed news (MCA, GST, Tax)', locked: false, Icon: Rss, tone: 'teal', em: 'feed', wa: 'feed' },
  { k: 'digest', t: 'Weekly summary · Monday 9 am', locked: false, Icon: FileText, tone: 'violet', em: 'weeklyDigest' },
];

function FactLine({ k, children, end }: { k: string; children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex min-h-[44px] items-center gap-3 border-t border-line-soft px-4 py-2 text-[13.5px] text-ink first:border-t-0 md:px-5">
      <span className="w-[92px] flex-none text-[13px] font-medium text-ink-muted">{k}</span>
      <span className="min-w-0 flex-1 break-words">{children}</span>
      {end}
    </div>
  );
}

function Hero() {
  const { shell } = usePortal();
  const { p, setProfile } = useProfileData();
  const team = useClientTeam();
  const photo = useRef<HTMLInputElement>(null);
  const { upload } = usePhoto(setProfile);
  const name = p?.name ?? '';
  const isPrimary = team.data?.isPrimary;
  return (
    <section aria-label="Your profile" className="flex items-center gap-4 rounded-md border-1.5 border-line bg-surface-raised px-4 py-4 md:px-5">
      <span className="relative flex-none">
        <span className="grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full bg-brand-soft text-[22px] font-medium text-brand-text">
          {p?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            initialsOf(name || ' ')
          )}
        </span>
        <button
          type="button"
          onClick={() => photo.current?.click()}
          aria-label="Change photo"
          title="Change photo"
          disabled={!p}
          className="absolute -bottom-0.5 -right-1 grid h-7 w-7 place-items-center rounded-md border-1.5 border-line-strong bg-surface-raised text-ink-2 shadow-control hover:bg-surface-sunken"
        >
          <Camera size={14} strokeWidth={1.6} aria-hidden />
        </button>
        <PhotoInput inputRef={photo} onPick={(f) => void upload(f)} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[22px] font-medium leading-tight text-ink">
          {name || <span className="inline-block h-[22px] w-40 animate-pulse rounded-mark bg-surface-sunken" aria-hidden />}
        </span>
        <span className="block truncate text-[13px] text-ink-muted">{p?.email ?? ''}</span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {isPrimary !== undefined ? <Tag tone={isPrimary ? 'prog' : 'idle'}>{isPrimary ? 'Primary' : 'Member'}</Tag> : null}
          {shell?.companyName ? <Tag>{shell.companyName}</Tag> : null}
        </span>
      </span>
    </section>
  );
}

function ProfileFacts() {
  const { toast } = usePortal();
  const { p, setProfile, refreshShell } = useProfileData();
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!p) return;
    const before = { name: p.name, phone: p.phone };
    const next = { name: name.trim() || p.name, phone: phone.trim() || null };
    setBusy(true);
    try {
      await api('/api/account/profile', { method: 'PATCH', json: next });
      setProfile(next);
      refreshShell();
      setEdit(false);
      toast('Profile saved', {
        undo: () => {
          setProfile(before);
          api('/api/account/profile', { method: 'PATCH', json: before })
            .then(refreshShell)
            .catch(() => toast('Could not undo that change'));
        },
      });
    } catch {
      toast('Could not save your profile');
    } finally {
      setBusy(false);
    }
  };
  const waChip = p?.whatsappOptIn ? (p.whatsappStatus === 'verified' ? 'Verified' : 'On') : 'Off';
  return (
    <SCard
      title="Profile"
      flush
      right={
        edit ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            disabled={!p}
            onClick={() => {
              setName(p?.name ?? '');
              setPhone(p?.phone ?? '');
              setEdit(true);
            }}
          >
            Edit
          </Button>
        )
      }
    >
      <FactLine k="Full name">{edit ? <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Full name" autoComplete="name" /> : (p?.name ?? '')}</FactLine>
      <FactLine k="Email">{p?.email ?? ''}</FactLine>
      <FactLine k="Phone">
        {edit ? (
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} aria-label="Phone" autoComplete="tel" />
        ) : (
          <span className="whitespace-nowrap">{p?.phone || prettyPhone(p?.phoneE164) || '—'}</span>
        )}
      </FactLine>
      <FactLine
        k="WhatsApp"
        end={
          <Chip fixed tone={waChip === 'Off' ? 'idle' : 'ok'}>
            {waChip}
          </Chip>
        }
      >
        <span className="whitespace-nowrap">{p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Not set up'}</span>
      </FactLine>
    </SCard>
  );
}

function SecurityFacts() {
  const { toast } = usePortal();
  const { changedAt, setChangedAt } = useProfileData();
  const [pw, setPw] = useState(false);
  const device = useMemo(() => thisDevice(), []);
  // C-851: the sign-in city of this device, when the edge sent a geo header at sign-in.
  const sessions = useQuery({
    queryKey: ['account-sessions'],
    queryFn: () => api<{ sessions: Array<{ current: boolean; city?: string | null }> }>('/api/account/sessions'),
    staleTime: 60_000,
  });
  const city = sessions.data?.sessions.find((x) => x.current)?.city?.trim() || '';
  return (
    <SCard title="Security" flush>
      <FactLine
        k="Password"
        end={
          !pw ? (
            <Button size="sm" variant="secondary" onClick={() => setPw(true)}>
              Change
            </Button>
          ) : undefined
        }
      >
        <span className="whitespace-nowrap">••••••••</span>
        {changedAt ? <span className="ml-2 text-[12px] text-ink-muted">changed {shortDate(changedAt)}</span> : null}
      </FactLine>
      {pw ? (
        <div className="border-t border-line-soft px-4 py-3 md:px-5">
          <PasswordForm
            onCancel={() => setPw(false)}
            onSaved={(at) => {
              setChangedAt(at);
              setPw(false);
              toast('Password changed', { kind: 'saved' });
            }}
          />
        </div>
      ) : null}
      <FactLine
        k="This device"
        end={
          <Chip fixed tone="ok">
            Active now
          </Chip>
        }
      >
        {city ? `${device} · ${city}` : device}
      </FactLine>
    </SCard>
  );
}

function NotificationsCard() {
  const { p, prefs, savePref } = useProfileData();
  const wa = useWhatsApp();
  const company = usePortal().shell?.companyShort || 'your company';
  const quiet = prefs?.quietHours ?? true;
  return (
    <SCard title="Notifications" flush>
      <div className="grid grid-cols-1 border-b border-line-soft sm:grid-cols-2">
        <div className="flex items-center gap-3 px-4 py-3 md:px-5">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-ink">Email</span>
            <span className="block truncate text-[12.5px] text-ink-muted">{p?.email ?? ''}</span>
          </span>
          <Tag>Always on</Tag>
        </div>
        <div className="flex items-center gap-3 border-t border-line-soft px-4 py-3 sm:border-l sm:border-t-0 md:px-5">
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-ink">WhatsApp</span>
            <span className="block truncate text-[12.5px] text-ink-muted">{wa.on && p?.phoneE164 ? prettyPhone(p.phoneE164) : 'Off'}</span>
          </span>
          {wa.on ? (
            <Switch checked aria-label="WhatsApp" onCheckedChange={() => void wa.off()} />
          ) : (
            <Button size="sm" disabled={!wa.ready} onClick={wa.open}>
              Turn on
            </Button>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b-1.5 border-line">
              <th className="h-9 px-2.5 pl-4 text-left text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted md:pl-5">Tell me when</th>
              <th className="h-9 w-[76px] px-2.5 text-center text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted">Email</th>
              <th className="h-9 w-[100px] px-2.5 pr-4 text-center text-[11.5px] font-medium uppercase tracking-[.07em] text-ink-muted md:pr-5">WhatsApp</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const eOn = r.locked || Boolean(r.em && prefs?.email[r.em]);
              const wOn = wa.on && Boolean(r.wa && prefs?.whatsapp[r.wa]);
              return (
                <tr key={r.k} className="border-b border-line-soft last:border-b-0">
                  <td className="h-11 px-2.5 pl-4 text-ink md:pl-5">
                    <span className="flex items-center gap-3">
                      <RowTile Icon={r.Icon} tone={r.tone} />
                      {r.t}
                    </span>
                  </td>
                  <td className="h-11 px-2.5 text-center">
                    {r.locked ? (
                      <span className="inline-flex h-6 items-center gap-1 rounded-sm bg-surface-sunken px-2 text-[12px] font-medium text-ink-muted" title={`Always on · email is ${company}’s record`}>
                        <Lock size={11} strokeWidth={1.6} aria-hidden /> On
                      </span>
                    ) : (
                      <span className="inline-flex">
                        <Switch
                          checked={eOn}
                          disabled={!prefs}
                          aria-label={`${r.t} by email`}
                          onCheckedChange={(v) =>
                            r.em && savePref({ email: { [r.em]: v } }, { message: `${r.t} · email ${v ? 'on' : 'off'}`, undo: { email: { [r.em]: !v } } })
                          }
                        />
                      </span>
                    )}
                  </td>
                  <td className="h-11 px-2.5 pr-4 text-center md:pr-5">
                    {r.wa ? (
                      <span className={cn('inline-flex', !wa.on && 'pointer-events-none opacity-40')} aria-disabled={!wa.on} title={!wa.on ? 'Turn on WhatsApp first' : undefined}>
                        <Switch
                          checked={wOn}
                          disabled={!wa.on || !prefs}
                          aria-label={`${r.t} on WhatsApp`}
                          onCheckedChange={(v) =>
                            r.wa &&
                            savePref({ whatsapp: { [r.wa]: v } }, { message: `${r.t} · WhatsApp ${v ? 'on' : 'off'}`, undo: { whatsapp: { [r.wa]: !v } } })
                          }
                        />
                      </span>
                    ) : (
                      <span className="text-ink-faint">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex min-w-0 items-center gap-3 border-t border-line-soft px-4 py-3 text-[14px] text-ink md:px-5">
        <RowTile Icon={Moon} tone="violet" />
        <span className="flex-1">Quiet hours · no WhatsApp {clock12(prefs?.quietStart ?? '21:00')} to {clock12(prefs?.quietEnd ?? '08:00')}</span>
        <span className={cn('inline-flex', !wa.on && 'pointer-events-none opacity-40')}>
          <Switch
            checked={quiet && wa.on}
            disabled={!wa.on || !prefs}
            aria-label="Quiet hours"
            onCheckedChange={(v) => savePref({ quietHours: v }, { message: v ? 'Quiet hours on' : 'Quiet hours off', undo: { quietHours: !v } })}
          />
        </span>
      </div>
      {wa.node}
    </SCard>
  );
}

export function ClientSettingsView() {
  return (
    <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <div className="grid min-w-0 gap-4">
        <Hero />
        <ProfileFacts />
        <SecurityFacts />
      </div>
      <div className="grid min-w-0 gap-4">
        <NotificationsCard />
        <SCard title="Appearance">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid justify-items-start gap-1.5">
              <span className="text-[13px] font-medium text-ink-muted">Theme</span>
              <ThemePicker />
            </div>
            <div className="grid justify-items-start gap-1.5">
              <span className="text-[13px] font-medium text-ink-muted">Reduce motion</span>
              <MotionSwitch />
            </div>
          </div>
        </SCard>
      </div>
    </div>
  );
}
