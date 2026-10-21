import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, useSession } from 'next-auth/react';
import { normalizeToE164 } from '@/lib/notify/phone';
import { useApp } from '@/context/AppContext';
import { ROLE_UI_LABEL, initialsFromName, type Role } from '@/lib/auth';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

export type ProfileData = {
  name: string;
  email: string;
  phone: string;
  /** WhatsApp destination in E.164. Empty when never provided. */
  phoneE164: string;
  whatsappOptIn: boolean;
  role: string;
  avatarUrl: string | null;
};

/**
 * State and actions for the account settings page: the profile load, the
 * profile edit form (name, email, phone, WhatsApp), the password change and
 * the Outlook mailbox flag.
 */
export function useAccountSettings() {
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


  return {
    user,
    refreshAuth,
    signOut,
    updateSession,
    router,
    profile,
    setProfile,
    loading,
    setLoading,
    editingProfile,
    setEditingProfile,
    savingProfile,
    setSavingProfile,
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
    setSubmittingPassword,
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
  };
}
