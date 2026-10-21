'use client';

import { getSession } from 'next-auth/react';
import { Loader2, Pencil } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { AccentButton } from '@/components/noir/AccentButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeToE164 } from '@/lib/notify/phone';
import { Button } from '@/components/ui/button';
import { toastError } from '@/lib/toast-errors';
import { AppearanceSettings } from '@/views/settings/AppearanceSettings';
import { SectionHead, SettingsRow } from './account/settings-layout';
import { IdentityCard } from './account/IdentityCard';
import { OutlookMailboxCard } from './account/OutlookMailboxCard';
import { useAccountSettings } from './account/use-account-settings';

type Props = {
  path: string;
};

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

  return (
    <PageTransition>
      <SEO
        title="Account settings — VCFO Suite"
        description="Update your profile and password."
        path={path}
      />

      <div className="mx-auto max-w-[1080px]">
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(20rem,24.5rem)_minmax(0,1fr)] lg:gap-8">
          <div className="order-2 flex flex-col gap-6 lg:order-1">
            <IdentityCard
              name={loading ? 'Loading…' : display.name || 'Your profile'}
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

            <div className="overflow-hidden rounded-lg border border-line bg-surface-raised">
              <section className="px-5 py-5">
                <SectionHead
                  title="Profile"
                  action={
                    !editingProfile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-ink-muted hover:text-ink"
                        disabled={loading || !profile}
                        onClick={startEditProfile}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null
                  }
                />

                {loading ? (
                  <div className="mt-1 space-y-0" aria-hidden>
                    <SettingsRow label="Full name">
                      <span className="inline-block h-3.5 w-32 animate-pulse rounded bg-surface-sunken" />
                    </SettingsRow>
                    <SettingsRow label="Email">
                      <span className="inline-block h-3.5 w-44 animate-pulse rounded bg-surface-sunken" />
                    </SettingsRow>
                    <SettingsRow label="Phone">
                      <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-surface-sunken" />
                    </SettingsRow>
                    <SettingsRow label="Role" last>
                      <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-surface-sunken" />
                    </SettingsRow>
                  </div>
                ) : !editingProfile ? (
                  <div className="mt-1">
                    <SettingsRow label="Full name">{display.name || '—'}</SettingsRow>
                    <SettingsRow label="Email">
                      <span className="font-mono text-[12px]">{display.email || '—'}</span>
                    </SettingsRow>
                    <SettingsRow label="Phone">{display.phone || 'Not set'}</SettingsRow>
                    <SettingsRow label="Role" last>
                      {roleLabel}
                    </SettingsRow>
                  </div>
                ) : (
                  <form onSubmit={(e) => void saveProfile(e)} className="mt-1">
                    <SettingsRow label="Full name">
                      <Label htmlFor="profile-name" className="sr-only">
                        Full name
                      </Label>
                      <Input
                        id="profile-name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        className="h-9"
                        maxLength={120}
                        required
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                        autoFocus
                      />
                    </SettingsRow>
                    <SettingsRow label="Email">
                      <Label htmlFor="profile-email" className="sr-only">
                        Email
                      </Label>
                      <Input
                        id="profile-email"
                        type="email"
                        value={draftEmail}
                        onChange={(e) => setDraftEmail(e.target.value)}
                        className="h-9"
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
                        className="h-9"
                        maxLength={32}
                        placeholder="+91 …"
                      />
                    </SettingsRow>
                    <SettingsRow label="WhatsApp" hint="Optional">
                      <Label htmlFor="profile-whatsapp" className="sr-only">
                        WhatsApp number
                      </Label>
                      <Input
                        id="profile-whatsapp"
                        type="tel"
                        inputMode="tel"
                        value={draftWhatsapp}
                        onChange={(e) => setDraftWhatsapp(e.target.value)}
                        className="h-9"
                        maxLength={24}
                        placeholder="+91 98765 43210"
                      />
                      {draftWhatsapp.trim() && !normalizeToE164(draftWhatsapp) ? (
                        <p role="alert" className="mt-1 text-[11px] text-danger">
                          Include the country code, e.g. +91 98765 43210
                        </p>
                      ) : null}
                      <label
                        htmlFor="profile-whatsapp-consent"
                        className="mt-2 flex cursor-pointer items-start gap-2.5"
                      >
                        <Checkbox
                          id="profile-whatsapp-consent"
                          checked={draftWhatsappOptIn}
                          onCheckedChange={(v) => setDraftWhatsappOptIn(v === true)}
                          disabled={!normalizeToE164(draftWhatsapp)}
                          className="mt-0.5"
                        />
                        <span className="text-[12px] leading-snug text-ink-muted">
                          Send me WhatsApp updates about my engagement on this number.
                          Untick to withdraw, or reply STOP on WhatsApp at any time.
                        </span>
                      </label>
                    </SettingsRow>
                    {emailChanging ? (
                      <SettingsRow
                        label="Confirm"
                        hint="Current password"
                      >
                        <Label htmlFor="profile-email-password" className="sr-only">
                          Current password to confirm email change
                        </Label>
                        <Input
                          id="profile-email-password"
                          type="password"
                          autoComplete="current-password"
                          value={emailPassword}
                          onChange={(e) => setEmailPassword(e.target.value)}
                          className="h-9"
                          required
                          placeholder="Password to change email"
                        />
                      </SettingsRow>
                    ) : null}
                    <SettingsRow label="Role" last>
                      <span className="text-ink-muted">{roleLabel}</span>
                    </SettingsRow>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditProfile}
                        disabled={savingProfile}
                      >
                        Cancel
                      </Button>
                      <AccentButton type="submit" size="sm" disabled={savingProfile}>
                        {savingProfile ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Saving…
                          </>
                        ) : (
                          'Save profile'
                        )}
                      </AccentButton>
                    </div>
                  </form>
                )}
              </section>

              <div className="mx-5 h-px bg-border/70" />

              <section className="px-5 py-5">
                <SectionHead
                  title="Security"
                  action={
                    !editingSecurity ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-ink-muted hover:text-ink"
                        onClick={() => setEditingSecurity(true)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : null
                  }
                />

                {!editingSecurity ? (
                  <div className="mt-1">
                    <SettingsRow label="Password" last>
                      <span className="tracking-[0.18em] text-ink-muted">••••••••</span>
                    </SettingsRow>
                  </div>
                ) : (
                  <form onSubmit={(e) => void onPasswordSubmit(e)} className="mt-1">
                    <SettingsRow label="Current">
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
                        className="h-9"
                        // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                        autoFocus
                      />
                    </SettingsRow>
                    <SettingsRow label="New" hint="8+ characters">
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
                        className="h-9"
                      />
                    </SettingsRow>
                    <SettingsRow label="Confirm" last>
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
                        className="h-9"
                      />
                    </SettingsRow>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        type="button"
                        variant="ghost"
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
                      <AccentButton type="submit" size="sm" disabled={submittingPassword}>
                        {submittingPassword ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            Updating…
                          </>
                        ) : (
                          'Update password'
                        )}
                      </AccentButton>
                    </div>
                  </form>
                )}
              </section>

              {isStaff ? (
                <>
                  <div className="mx-5 h-px bg-border/70" />
                  <OutlookMailboxCard onConnectedChange={setOutlookConnected} />
                </>
              ) : null}
            </div>
          </div>

          <div className="order-1 min-w-0 lg:order-2">
            <AppearanceSettings />
          </div>
        </div>

        <footer className="mt-10 flex justify-end border-t border-line/70 pt-6">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="w-fit"
            onClick={() => {
              void signOut()
                .then(() => router.push('/login'))
                .catch(() => {
                  toastError('Sign out failed. Please try again.');
                });
            }}
          >
            Sign out
          </Button>
        </footer>
      </div>
    </PageTransition>
  );
}
