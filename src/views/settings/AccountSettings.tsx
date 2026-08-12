'use client';

import { FormEvent, useEffect, useState } from 'react';
import { getSession, useSession } from 'next-auth/react';
import { Loader2, Lock, Pencil, UserRound } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { SEO } from '@/components/SEO';
import { Surface } from '@/components/noir';
import { AccentButton } from '@/components/noir/AccentButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useApp } from '@/context/AppContext';
import { ROLE_UI_LABEL, initialsFromName, type Role } from '@/lib/auth';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type Props = {
  path: string;
};

type ProfileData = {
  name: string;
  email: string;
  phone: string;
  role: string;
};

export default function AccountSettings({ path }: Props) {
  const { user, refreshAuth } = useApp();
  const { update: updateSession } = useSession();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');
  const [draftPhone, setDraftPhone] = useState('');
  const [emailPassword, setEmailPassword] = useState('');

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
          role: string;
        };
        const next = {
          name: p.name,
          email: p.email,
          phone: p.phone ?? '',
          role: p.role,
        };
        setProfile(next);
        setDraftName(next.name);
        setDraftEmail(next.email);
        setDraftPhone(next.phone);
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
    setEmailPassword('');
    setEditingProfile(true);
  }

  function cancelEditProfile() {
    if (!profile) return;
    setDraftName(profile.name);
    setDraftEmail(profile.email);
    setDraftPhone(profile.phone);
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
        role: profile.role,
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
      toastSuccess('Password updated', 'Use your new password next time you sign in.');
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
    role: user?.role ?? '',
  };
  const initials = initialsFromName(display.name || display.email || 'U');
  const roleLabel = display.role
    ? ROLE_UI_LABEL[display.role as Role] ?? display.role
    : '—';

  return (
    <PageTransition>
      <SEO
        title="Account settings — VCFO Suite"
        description="Update your profile and password."
        path={path}
      />

      <div className="mx-auto max-w-2xl space-y-5">
        {/* Identity header */}
        <Surface className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-50 text-[15px] font-semibold text-orange-900 ring-1 ring-orange-200/70"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-serif text-2xl tracking-tight text-foreground">
                {loading ? 'Loading…' : display.name || 'Your profile'}
              </h1>
              <p className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">
                {display.email || '—'}
              </p>
              <span className="mt-2 inline-flex rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {roleLabel}
              </span>
            </div>
          </div>
        </Surface>

        {/* Profile card — view / edit */}
        <Surface className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-foreground">
                <UserRound className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 className="font-serif text-xl tracking-tight">Profile</h2>
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Name, email, and phone used across VCFO Suite.
              </p>
            </div>
            {!editingProfile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={loading || !profile}
                onClick={startEditProfile}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>

          {!editingProfile ? (
            <dl className="mt-5 space-y-3">
              <ViewRow label="Full name" value={display.name || '—'} />
              <ViewRow label="Email" value={display.email || '—'} mono />
              <ViewRow label="Phone" value={display.phone || 'Not set'} />
              <ViewRow label="Role" value={roleLabel} />
            </dl>
          ) : (
            <form onSubmit={(e) => void saveProfile(e)} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="profile-name" className="text-[12px] text-muted-foreground">
                  Full name
                </Label>
                <Input
                  id="profile-name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="mt-1.5 h-10"
                  maxLength={120}
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="profile-email" className="text-[12px] text-muted-foreground">
                  Email
                </Label>
                <Input
                  id="profile-email"
                  type="email"
                  value={draftEmail}
                  onChange={(e) => setDraftEmail(e.target.value)}
                  className="mt-1.5 h-10"
                  maxLength={160}
                  required
                />
              </div>
              <div>
                <Label htmlFor="profile-phone" className="text-[12px] text-muted-foreground">
                  Phone <span className="font-normal">(optional)</span>
                </Label>
                <Input
                  id="profile-phone"
                  type="tel"
                  value={draftPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  className="mt-1.5 h-10"
                  maxLength={32}
                  placeholder="+91 …"
                />
              </div>
              {draftEmail.trim().toLowerCase() !== profile?.email.toLowerCase() ? (
                <div className="rounded-lg border border-border/80 bg-muted/20 p-3">
                  <Label htmlFor="profile-email-password" className="text-[12px] text-muted-foreground">
                    Current password to confirm email change
                  </Label>
                  <Input
                    id="profile-email-password"
                    type="password"
                    autoComplete="current-password"
                    value={emailPassword}
                    onChange={(e) => setEmailPassword(e.target.value)}
                    className="mt-1.5 h-10"
                    required
                  />
                </div>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
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
        </Surface>

        {/* Security card */}
        <Surface className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-foreground">
                <Lock className="h-4 w-4 text-muted-foreground" aria-hidden />
                <h2 className="font-serif text-xl tracking-tight">Security</h2>
              </div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Change the password you use to sign in.
              </p>
            </div>
            {!editingSecurity ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setEditingSecurity(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            ) : null}
          </div>

          {!editingSecurity ? (
            <p className="mt-5 text-[13px] text-muted-foreground">
              Password is set. Choose Edit to replace it.
            </p>
          ) : (
            <form onSubmit={(e) => void onPasswordSubmit(e)} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="current-password" className="text-[12px] text-muted-foreground">
                  Current password
                </Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="mt-1.5 h-10"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="new-password" className="text-[12px] text-muted-foreground">
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
                  className="mt-1.5 h-10"
                />
              </div>
              <div>
                <Label htmlFor="confirm-password" className="text-[12px] text-muted-foreground">
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
                  className="mt-1.5 h-10"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
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
        </Surface>
      </div>
    </PageTransition>
  );
}

function ViewRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-b border-border/60 py-2.5 last:border-0 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[12px] text-muted-foreground">{label}</dt>
      <dd className={cn('text-[13px] text-foreground', mono && 'font-mono text-[12px]')}>{value}</dd>
    </div>
  );
}
