'use client';

import { getSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { UserFace } from '@/components/common/UserFace';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeToE164 } from '@/lib/notify/phone';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { toastError } from '@/lib/toast-errors';
import { AppearanceSettings } from '@/views/settings/AppearanceSettings';
import { ProfileCard, SettingsRow } from './account/settings-layout';
import { IdentityCard } from './account/IdentityCard';
import { OutlookMailboxCard } from './account/OutlookMailboxCard';
import { useAccountSettings } from './account/use-account-settings';

type Props = {
  path: string;
};

/*
 * Profile (VCFO Spectrum, prototype ProfileScreen; K-16: Settings sits under Profile). One page
 * with sections and a section menu on the left. Every section stays mounted so the `#appearance`
 * link from the greeting card and the Outlook connect return (`?outlook=`) keep working.
 */
type SectionKey = 'profile' | 'security' | 'email' | 'appearance';

const SECTION_LABEL: Record<SectionKey, string> = {
  profile: 'About you',
  security: 'Sign-in and security',
  email: 'Email',
  appearance: 'Appearance',
};

/** The section in view, from the hash first and then from scrolling. */
function useActiveSection(keys: SectionKey[]) {
  const [active, setActive] = useState<SectionKey>(keys[0]);
  const joined = keys.join(',');
  useEffect(() => {
    const list = joined.split(',') as SectionKey[];
    const fromHash = window.location.hash.replace('#', '') as SectionKey;
    if (list.includes(fromHash)) setActive(fromHash);
    if (typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        const top = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) setActive(top.target.id as SectionKey);
      },
      { rootMargin: '-80px 0px -55% 0px' },
    );
    for (const k of list) {
      const el = document.getElementById(k);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [joined]);
  return [active, setActive] as const;
}

export default function AccountSettings({ path }: Props) {
  const {
    refreshAuth,
    signOut,
    updateSession,
    router,
    profile,
    setProfile,
    loading,
    editingProfile,
    savingProfile,
    draftName,
    setDraftName,
    draftEmail,
    setDraftEmail,
    draftPhone,
    setDraftPhone,
    draftWhatsapp,
    setDraftWhatsapp,
    draftWhatsappOptIn,
    setDraftWhatsappOptIn,
    emailPassword,
    setEmailPassword,
    outlookConnected,
    setOutlookConnected,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    submittingPassword,
    editingSecurity,
    setEditingSecurity,
    startEditProfile,
    cancelEditProfile,
    saveProfile,
    onPasswordSubmit,
    display,
    initials,
    roleLabel,
    isStaff,
    emailChanging,
  } = useAccountSettings();

  const sections: SectionKey[] = isStaff
    ? ['profile', 'security', 'email', 'appearance']
    : ['profile', 'security', 'appearance'];
  const [active, setActive] = useActiveSection(sections);

  const pick = (k: SectionKey) => {
    setActive(k);
    document.getElementById(k)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    try {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${k}`);
    } catch {
      /* The hash is a convenience; scrolling already happened. */
    }
  };

  const savingLabel = (
    <>
      <Loader2 className="animate-spin" aria-hidden />
      Saving…
    </>
  );

  return (
    <PageTransition>
      <SEO
        title="Profile — VCFO Suite"
        description="Update your profile and password."
        path={path}
      />

      <div className="mx-auto max-w-[1080px]">
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <PageBackButton className="-ml-1.5" />
          <h1 className="text-[28px] font-medium leading-9 tracking-[-0.01em] text-ink">Profile</h1>
        </div>

        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
          <nav
            aria-label="Profile sections"
            className="rounded-md border-1.5 border-line bg-surface-raised p-2 md:sticky md:top-20"
          >
            <div className="flex items-center gap-2.5 border-b border-line-soft px-2 pb-3 pt-2">
              <UserFace
                src={display.avatarUrl}
                initials={loading ? '' : initials}
                alt=""
                className="h-9 w-9 flex-none bg-surface-sunken text-[13px] font-medium text-ink"
              />
              <span className="min-w-0">
                <b className="block truncate text-[14px] font-medium text-ink">
                  {loading ? (
                    <span className="inline-block h-3.5 w-24 animate-pulse rounded-mark bg-surface-sunken align-middle" aria-hidden />
                  ) : (
                    display.name || 'Your profile'
                  )}
                </b>
                <small className="block truncate text-[12px] text-ink-muted">{roleLabel}</small>
              </span>
            </div>
            <div className="mt-2 flex gap-1 overflow-x-auto [scrollbar-width:none] md:grid md:overflow-visible">
              {sections.map((k) => (
                <a
                  key={k}
                  href={`#${k}`}
                  aria-current={active === k ? 'true' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    pick(k);
                  }}
                  className={
                    active === k
                      ? 'flex h-[34px] flex-none items-center whitespace-nowrap rounded-md bg-brand-soft px-2.5 text-[14px] font-medium text-brand-text'
                      : 'flex h-[34px] flex-none items-center whitespace-nowrap rounded-md px-2.5 text-[14px] text-ink-2 hover:bg-surface-sunken'
                  }
                >
                  {SECTION_LABEL[k]}
                </a>
              ))}
            </div>
          </nav>

          <div className="grid min-w-0 gap-4">
            <ProfileCard
              id="profile"
              title={SECTION_LABEL.profile}
              action={
                !editingProfile ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading || !profile}
                    onClick={startEditProfile}
                  >
                    <Pencil aria-hidden />
                    Edit
                  </Button>
                ) : null
              }
            >
              <SettingsRow label="Photo">
                <IdentityCard
                  name={display.name}
                  email={display.email || '—'}
                  roleLabel={roleLabel}
                  initials={initials}
                  avatarUrl={display.avatarUrl}
                  loading={loading}
                  isStaff={isStaff}
                  outlookConnected={outlookConnected}
                  onAvatarUrl={(avatarUrl) => {
                    setProfile((prev) => (prev ? { ...prev, avatarUrl } : prev));
                  }}
                  onAvatarSaved={async () => {
                    await updateSession();
                    await getSession();
                    await refreshAuth();
                  }}
                />
              </SettingsRow>

              {loading ? (
                <div aria-hidden>
                  {['Full name', 'Email', 'Phone', 'Role'].map((label) => (
                    <SettingsRow key={label} label={label}>
                      <span className="block h-4 w-40 animate-pulse rounded-mark bg-surface-sunken" />
                    </SettingsRow>
                  ))}
                </div>
              ) : !editingProfile ? (
                <>
                  <SettingsRow label="Full name">{display.name || '—'}</SettingsRow>
                  <SettingsRow label="Email" hint="Your sign-in address">
                    {display.email || '—'}
                  </SettingsRow>
                  <SettingsRow label="Phone">
                    {display.phone || <span className="text-ink-muted">Not set</span>}
                  </SettingsRow>
                  <SettingsRow label="WhatsApp" hint="Updates about your engagement">
                    {display.phoneE164 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular-nums">{display.phoneE164}</span>
                        <Chip tone={display.whatsappOptIn ? 'ok' : 'idle'}>
                          {display.whatsappOptIn ? 'On' : 'Off'}
                        </Chip>
                      </span>
                    ) : (
                      <span className="text-ink-muted">Not set</span>
                    )}
                  </SettingsRow>
                  <SettingsRow label="Role">{roleLabel}</SettingsRow>
                </>
              ) : (
                <form onSubmit={(e) => void saveProfile(e)}>
                  <SettingsRow label="Full name">
                    <Label htmlFor="profile-name" className="sr-only">
                      Full name
                    </Label>
                    <Input
                      id="profile-name"
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      maxLength={120}
                      required
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                      autoFocus
                    />
                  </SettingsRow>
                  <SettingsRow label="Email" hint="Your sign-in address">
                    <Label htmlFor="profile-email" className="sr-only">
                      Email
                    </Label>
                    <Input
                      id="profile-email"
                      type="email"
                      value={draftEmail}
                      onChange={(e) => setDraftEmail(e.target.value)}
                      maxLength={160}
                      required
                    />
                  </SettingsRow>
                  <SettingsRow label="Phone" hint="Optional">
                    <Label htmlFor="profile-phone" className="sr-only">
                      Phone
                    </Label>
                    <Input
                      id="profile-phone"
                      type="tel"
                      value={draftPhone}
                      onChange={(e) => setDraftPhone(e.target.value)}
                      maxLength={32}
                      placeholder="+91 …"
                    />
                  </SettingsRow>
                  <SettingsRow label="WhatsApp" hint="Optional, with the country code">
                    <Label htmlFor="profile-whatsapp" className="sr-only">
                      WhatsApp number
                    </Label>
                    <Input
                      id="profile-whatsapp"
                      type="tel"
                      inputMode="tel"
                      value={draftWhatsapp}
                      onChange={(e) => setDraftWhatsapp(e.target.value)}
                      maxLength={24}
                      placeholder="+91 98765 43210"
                    />
                    {draftWhatsapp.trim() && !normalizeToE164(draftWhatsapp) ? (
                      <p role="alert" className="mt-1 text-[12.5px] text-danger">
                        Include the country code, e.g. +91 98765 43210
                      </p>
                    ) : null}
                    <label
                      htmlFor="profile-whatsapp-consent"
                      className={
                        draftWhatsappOptIn
                          ? 'mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border-1.5 border-positive-mid bg-positive-soft px-3 py-2.5'
                          : 'mt-2 flex cursor-pointer items-start gap-2.5 rounded-md border-1.5 border-line bg-surface-sunken px-3 py-2.5'
                      }
                    >
                      <Checkbox
                        id="profile-whatsapp-consent"
                        checked={draftWhatsappOptIn}
                        onCheckedChange={(v) => setDraftWhatsappOptIn(v === true)}
                        disabled={!normalizeToE164(draftWhatsapp)}
                        className="mt-0.5"
                      />
                      <span className="text-[13px] leading-snug text-ink-2">
                        Send me WhatsApp updates about my engagement on this number.
                        Untick to withdraw, or reply STOP on WhatsApp at any time.
                      </span>
                    </label>
                  </SettingsRow>
                  {emailChanging ? (
                    <SettingsRow label="Confirm" hint="Current password">
                      <Label htmlFor="profile-email-password" className="sr-only">
                        Current password to confirm email change
                      </Label>
                      <Input
                        id="profile-email-password"
                        type="password"
                        autoComplete="current-password"
                        value={emailPassword}
                        onChange={(e) => setEmailPassword(e.target.value)}
                        required
                        placeholder="Password to change email"
                      />
                    </SettingsRow>
                  ) : null}
                  <SettingsRow label="Role">
                    <span className="text-ink-muted">{roleLabel}</span>
                  </SettingsRow>
                  <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      onClick={cancelEditProfile}
                      disabled={savingProfile}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={savingProfile}>
                      {savingProfile ? savingLabel : 'Save profile'}
                    </Button>
                  </div>
                </form>
              )}
            </ProfileCard>

            <ProfileCard id="security" title={SECTION_LABEL.security}>
              {!editingSecurity ? (
                <SettingsRow label="Password">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="tracking-[0.18em] text-ink-muted" aria-label="Password set">
                      ••••••••
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setEditingSecurity(true)}
                    >
                      Change password
                    </Button>
                  </span>
                </SettingsRow>
              ) : (
                <form onSubmit={(e) => void onPasswordSubmit(e)}>
                  <SettingsRow label="Current password">
                    <Label htmlFor="current-password" className="sr-only">
                      Current password
                    </Label>
                    <Input
                      id="current-password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                      autoFocus
                    />
                  </SettingsRow>
                  <SettingsRow label="New password" hint="8 or more characters">
                    <Label htmlFor="new-password" className="sr-only">
                      New password
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </SettingsRow>
                  <SettingsRow label="Confirm password">
                    <Label htmlFor="confirm-password" className="sr-only">
                      Confirm new password
                    </Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </SettingsRow>
                  <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3 md:px-5">
                    <Button
                      type="button"
                      variant="quiet"
                      size="sm"
                      onClick={() => {
                        setEditingSecurity(false);
                        setCurrentPassword('');
                        setNewPassword('');
                        setConfirmPassword('');
                      }}
                      disabled={submittingPassword}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" size="sm" disabled={submittingPassword}>
                      {submittingPassword ? (
                        <>
                          <Loader2 className="animate-spin" aria-hidden />
                          Updating…
                        </>
                      ) : (
                        'Update password'
                      )}
                    </Button>
                  </div>
                </form>
              )}
              <SettingsRow label="Sign out" hint="On this device">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="text-danger"
                  onClick={() => {
                    void signOut()
                      .then(() => router.push('/login'))
                      .catch(() => {
                        toastError('Sign out failed. Try again.');
                      });
                  }}
                >
                  Sign out
                </Button>
              </SettingsRow>
            </ProfileCard>

            {isStaff ? <OutlookMailboxCard onConnectedChange={setOutlookConnected} /> : null}

            <AppearanceSettings />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
