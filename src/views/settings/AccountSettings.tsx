'use client';

import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, useSession } from 'next-auth/react';
import { Loader2, Pencil, Trash2, Upload } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { SEO } from '@/components/SEO';
import { AccentButton } from '@/components/noir/AccentButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { normalizeToE164 } from '@/lib/notify/phone';
import { Button } from '@/components/ui/button';
import { UserFace } from '@/components/common/UserFace';
import { useApp } from '@/context/AppContext';
import { ROLE_UI_LABEL, initialsFromName, type Role } from '@/lib/auth';
import { compressImageFile } from '@/lib/shell-appearance';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { AppearanceSettings } from '@/views/settings/AppearanceSettings';

type Props = {
  path: string;
};

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  /** WhatsApp destination in E.164. Empty when never provided. */
  phoneE164: string;
  whatsappOptIn: boolean;
  role: string;
  avatarUrl: string | null;
};

export default function AccountSettings({ path }: Props) {
  const { user, refreshAuth, signOut } = useApp();
  const { update: updateSession } = useSession();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [draftWhatsapp, setDraftWhatsapp] = useState('');
  const [draftWhatsappOptIn, setDraftWhatsappOptIn] = useState(false);
  const [emailPassword, setEmailPassword] = useState('');
  const [outlookConnected, setOutlookConnected] = useState(false);


  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [editingSecurity, setEditingSecurity] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/account/profile');
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || 'Could not load profile');
        if (cancelled) return;
        const p = body.profile as {
          name: string;
          email: string;
          phone: string | null;
          phoneE164?: string | null;
          whatsappOptIn?: boolean;
          role: string;
          avatarUrl?: string | null;
        };
        const next = {
          name: p.name,
          email: p.email,
          phone: p.phone ?? '',
          phoneE164: p.phoneE164 ?? '',
          whatsappOptIn: Boolean(p.whatsappOptIn),
          role: p.role,
          avatarUrl: p.avatarUrl ?? null,
        };
        setProfile(next);
        setDraftName(next.name);
        setDraftEmail(next.email);
        setDraftPhone(next.phone);
        setDraftWhatsapp(next.phoneE164);
        setDraftWhatsappOptIn(next.whatsappOptIn);
      } catch (err) {
        if (!cancelled) toastError(errorMessage(err, 'Could not load profile.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function startEditProfile() {
    if (!profile) return;
    setDraftName(profile.name);
    setDraftEmail(profile.email);
    setDraftPhone(profile.phone);
    setDraftWhatsapp(profile.phoneE164);
    setDraftWhatsappOptIn(profile.whatsappOptIn);
    setEmailPassword('');
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    if (!profile) return;
    setDraftName(profile.name);
    setDraftEmail(profile.email);
    setDraftPhone(profile.phone);
    setDraftWhatsapp(profile.phoneE164);
    setDraftWhatsappOptIn(profile.whatsappOptIn);
    setEmailPassword('');
    setEditingProfile(false);
  }

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const emailChanged = draftEmail.trim().toLowerCase() !== profile.email.toLowerCase();
    if (emailChanged && !emailPassword) {
      toastError('Password required', 'Confirm with your current password to change email.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim(),
          phone: draftPhone.trim() || null,
          // Normalised client-side so the API only ever sees E.164.
          phoneE164: normalizeToE164(draftWhatsapp),
          // Consent only counts with a usable number behind it.
          whatsappOptIn: draftWhatsappOptIn && Boolean(normalizeToE164(draftWhatsapp)),
          email: draftEmail.trim().toLowerCase(),
          ...(emailChanged ? { currentPassword: emailPassword } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        if (code === 'invalid_credentials') throw new Error('Current password is incorrect.');
        if (code === 'email_already_registered') throw new Error('That email is already in use.');
        throw new Error(errorMessage(body.error, 'Could not save profile.'));
      }
      const next = {
        name: body.profile.name as string,
        email: body.profile.email as string,
        phone: (body.profile.phone as string | null) ?? '',
        phoneE164: normalizeToE164(draftWhatsapp) ?? '',
        whatsappOptIn:
          draftWhatsappOptIn && Boolean(normalizeToE164(draftWhatsapp)),
        role: profile.role,
        avatarUrl: profile.avatarUrl,
      };
      setProfile(next);
      setEditingProfile(false);
      setEmailPassword('');
      toastSuccess('Profile updated');
      await updateSession();
      await getSession();
      await refreshAuth();
    } catch (err) {
      toastError("Couldn't save profile", errorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  }

  async function onPasswordSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toastError('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError("Passwords don't match", 'Re-enter the same new password in both fields.');
      return;
    }
    setSubmittingPassword(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        if (code === 'invalid_credentials') {
          throw new Error('Current password is incorrect.');
        }
        throw new Error(errorMessage(body.error, 'Could not update password.'));
      }
      toastSuccess('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setEditingSecurity(false);
    } catch (err) {
      toastError("Couldn't update password", errorMessage(err));
    } finally {
      setSubmittingPassword(false);
    }
  }

  const display = profile ?? {
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    phoneE164: '',
    whatsappOptIn: false,
    role: user?.role ?? '',
    avatarUrl: user?.imageUrl ?? null,
  };
  const initials = initialsFromName(display.name || display.email || 'U');
  const roleLabel = display.role
    ? ROLE_UI_LABEL[display.role as Role] ?? display.role
    : '—';
  const isStaff =
    display.role === 'super_admin' ||
    display.role === 'admin' ||
    display.role === 'manager' ||
    display.role === 'intern';
  const emailChanging =
    editingProfile && draftEmail.trim().toLowerCase() !== (profile?.email ?? '').toLowerCase();

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

            <div className="overflow-hidden rounded-lg border border-border bg-panel">
              <section className="px-5 py-5">
                <SectionHead
                  title="Profile"
                  action={
                    !editingProfile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
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
                      <span className="inline-block h-3.5 w-32 animate-pulse rounded bg-muted" />
                    </SettingsRow>
                    <SettingsRow label="Email">
                      <span className="inline-block h-3.5 w-44 animate-pulse rounded bg-muted" />
                    </SettingsRow>
                    <SettingsRow label="Phone">
                      <span className="inline-block h-3.5 w-20 animate-pulse rounded bg-muted" />
                    </SettingsRow>
                    <SettingsRow label="Role" last>
                      <span className="inline-block h-3.5 w-24 animate-pulse rounded bg-muted" />
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
                        <span className="text-[12px] leading-snug text-muted-foreground">
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
                      <span className="text-muted-foreground">{roleLabel}</span>
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
                        className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
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
                      <span className="tracking-[0.18em] text-muted-foreground">••••••••</span>
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

        <footer className="mt-10 flex justify-end border-t border-border/70 pt-6">
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

async function jpegFileFromDataUrl(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

function IdentityCard({
  name,
  email,
  roleLabel,
  initials,
  avatarUrl,
  loading,
  isStaff,
  outlookConnected,
  onAvatarUrl,
  onAvatarSaved,
}: {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
  avatarUrl: string | null;
  loading: boolean;
  isStaff: boolean;
  outlookConnected: boolean;
  onAvatarUrl: (url: string | null) => void;
  onAvatarSaved: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'outlook' | 'remove' | null>(null);

  const src = previewUrl || avatarUrl;
  const hasPhoto = Boolean(src);

  async function persistFile(file: File, preview: string | null) {
    if (preview) setPreviewUrl(preview);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof body.error === 'string' ? body.error : '';
      if (code === 'file_too_large') throw new Error('That image is too large. Try a smaller photo.');
      if (code === 'unsupported_type') throw new Error('Use a JPEG, PNG, WebP, or GIF.');
      throw new Error(errorMessage(body.error, 'Could not save photo.'));
    }
    onAvatarUrl((body.avatarUrl as string | null) ?? null);
    setPreviewUrl(null);
    await onAvatarSaved();
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setBusy('upload');
    try {
      const dataUrl = await compressImageFile(file, 512, 0.82);
      const jpeg = await jpegFileFromDataUrl(dataUrl);
      await persistFile(jpeg, dataUrl);
      toastSuccess('Photo updated');
    } catch (err) {
      setPreviewUrl(null);
      toastError('Could not update photo', errorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyOutlookPhoto() {
    setBusy('outlook');
    try {
      const res = await fetch('/api/account/avatar/outlook', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        if (code === 'outlook_not_connected') throw new Error('Connect Outlook below, then try again.');
        if (code === 'outlook_photo_missing') throw new Error('No photo on this Microsoft account.');
        throw new Error(errorMessage(body.error, 'Could not fetch Outlook photo.'));
      }
      onAvatarUrl((body.avatarUrl as string | null) ?? null);
      setPreviewUrl(null);
      await onAvatarSaved();
      toastSuccess('Outlook photo added');
    } catch (err) {
      toastError('Could not use Outlook photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    setBusy('remove');
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(body.error, 'Could not remove photo.'));
      onAvatarUrl(null);
      setPreviewUrl(null);
      await onAvatarSaved();
      toastSuccess('Photo removed');
    } catch (err) {
      toastError('Could not remove photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-panel px-5 py-5">
      <div className="flex items-center gap-4 sm:gap-5">
        <UserFace
          src={src}
          initials={loading ? '' : initials}
          alt=""
          className="h-[4.5rem] w-[4.5rem] bg-primary-light text-[1.05rem] font-semibold tracking-tight text-primary ring-1 ring-primary/20 sm:h-20 sm:w-20 sm:text-[1.15rem]"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <PageBackButton className="-ml-1.5" />
            <h1 className="truncate font-serif text-[1.5rem] leading-none tracking-tight text-foreground sm:text-[1.75rem]">
              {name}
            </h1>
          </div>
          <p className="mt-2 truncate font-mono text-[13px] text-muted-foreground">{email}</p>
          <span className="mt-3 inline-flex rounded-md bg-primary-light px-2 py-0.5 text-[11px] font-semibold text-primary">
            {roleLabel}
          </span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="sr-only"
        onChange={(e) => void onPickFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={loading || busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === 'upload' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          Upload
        </Button>
        {isStaff ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading || busy !== null || !outlookConnected}
            title={
              outlookConnected ? undefined : 'Connect Outlook below to use your Microsoft photo'
            }
            onClick={() => void applyOutlookPhoto()}
          >
            {busy === 'outlook' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            Use Outlook photo
          </Button>
        ) : null}
        {hasPhoto ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-muted-foreground hover:text-foreground"
            disabled={loading || busy !== null}
            onClick={() => void removePhoto()}
          >
            {busy === 'remove' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function OutlookMailboxCard({
  onConnectedChange,
}: {
  onConnectedChange?: (connected: boolean) => void;
}) {
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/outlook');
        const json = (await res.json()) as {
          configured?: boolean;
          connected?: boolean;
          msEmail?: string;
        };
        if (cancelled) return;
        setConfigured(json.configured !== false);
        setConnected(Boolean(json.connected));
        onConnectedChange?.(Boolean(json.connected));
        setMsEmail(json.msEmail);
      } catch {
        if (!cancelled) {
          setConnected(false);
          onConnectedChange?.(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onConnectedChange]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outlook = params.get('outlook');
    if (!outlook) return;
    if (outlook === 'connected') {
      toastSuccess('Outlook connected', 'Client emails will send from this mailbox.');
    } else {
      const reason = params.get('reason')?.trim();
      toastError('Outlook did not connect', reason || 'Try Connect Outlook again.');
    }
    params.delete('outlook');
    params.delete('reason');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState({}, '', next);
  }, []);

  async function disconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/outlook/disconnect', { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || 'disconnect_failed');
      setConnected(false);
      setMsEmail(undefined);
      onConnectedChange?.(false);
      toastSuccess('Outlook disconnected');
    } catch (err) {
      toastError('Could not disconnect Outlook', errorMessage(err));
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <section className="px-5 py-5">
      <SectionHead title="Outlook" />

      {loading ? (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <span className="text-muted-foreground">Checking…</span>
          </SettingsRow>
        </div>
      ) : !configured ? (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <span className="text-muted-foreground">Not configured yet. Ask an admin.</span>
          </SettingsRow>
        </div>
      ) : (
        <div className="mt-1">
          <SettingsRow label="Mailbox" last>
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              {connected && msEmail ? (
                <span className="flex min-w-0 items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                  <span className="truncate font-mono text-[12px]">{msEmail}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" aria-hidden />
                  Not connected
                </span>
              )}
              {connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  disabled={disconnecting}
                  onClick={() => void disconnect()}
                >
                  {disconnecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                      Disconnecting…
                    </>
                  ) : (
                    'Disconnect'
                  )}
                </Button>
              ) : (
                <AccentButton
                  type="button"
                  size="sm"
                  className="h-8 min-h-8 shrink-0"
                  onClick={() => {
                    window.location.href = '/api/outlook/connect';
                  }}
                >
                  Connect Outlook
                </AccentButton>
              )}
            </div>
          </SettingsRow>
        </div>
      )}
    </section>
  );
}

function SectionHead({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  last,
  children,
}: {
  label: string;
  hint?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid gap-1 py-3 sm:grid-cols-[6.75rem_minmax(0,1fr)] sm:items-center sm:gap-4',
        !last && 'border-b border-border/60',
      )}
    >
      <div className="min-w-0">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </div>
      <div className="min-w-0 text-[13px] text-foreground">{children}</div>
    </div>
  );
}
