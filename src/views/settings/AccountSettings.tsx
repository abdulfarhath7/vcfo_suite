'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Settings } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface } from '@/components/noir';
import { AccentButton } from '@/components/noir/AccentButton';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

type Props = {
  path: string;
};

export default function AccountSettings({ path }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toastError('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError("Passwords don't match", 'Re-enter the same new password in both fields.');
      return;
    }
    setSubmitting(true);
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
    } catch (err) {
      toastError("Couldn't update password", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <SEO title="Account settings — VCFO Suite" description="Update your password and account preferences." path={path} />
      <PageHeader
        accent="neutral"
        icon={Settings}
        title="Account settings"
      />

      <Surface className="max-w-lg p-6">
        <h2 className="font-serif text-xl tracking-tight text-foreground">Change password</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          Enter your current password, then choose a new one (minimum 8 characters).
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          <AccentButton type="submit" size="lg" className="mt-2" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Updating…
              </>
            ) : (
              'Update password'
            )}
          </AccentButton>
        </form>
      </Surface>
    </PageTransition>
  );
}
