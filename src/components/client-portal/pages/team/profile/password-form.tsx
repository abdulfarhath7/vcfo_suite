'use client';

/**
 * The change-password form (prototype `PasswordForm`, settings_password): current password,
 * new password with a four-bar strength meter and four text checks, and the confirm field.
 * Save stays off until the form is valid. Posts to `/api/client/account/password`, which
 * also stamps the "changed" date.
 */
import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { api } from '../common';

const CHECKS: Array<{ label: string; test: (v: string) => boolean }> = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: 'Number', test: (v) => /\d/.test(v) },
  { label: 'Symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
  { label: 'Upper and lower case', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
];
const STRENGTH = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];

export function PasswordForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (changedAt: string) => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const passed = CHECKS.filter((c) => c.test(next)).length;
  const match = conf.length > 0 && conf === next;
  const ok = cur.length > 0 && next.length >= 8 && passed >= 3 && match;
  const bar = passed >= 4 ? 'bg-positive' : passed === 3 ? 'bg-positive-mid' : passed === 2 ? 'bg-warning-mid' : 'bg-danger-mid';

  const save = async () => {
    if (!ok) return;
    setBusy(true);
    setErr('');
    try {
      const r = await api<{ changedAt: string }>('/api/client/account/password', { method: 'POST', json: { currentPassword: cur, newPassword: next } });
      onSaved(r.changedAt);
    } catch (e) {
      setErr(e instanceof Error && e.message === 'invalid_credentials' ? 'Your current password is not right' : 'Could not change the password');
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-3 rounded-md border-1.5 border-line bg-surface-raised p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor="pw-cur" className="grid gap-1.5 text-[13px] font-medium text-ink-2">
        Current password
        {/* eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when the form opens */}
        <Input id="pw-cur" type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" autoFocus />
      </label>
      <label htmlFor="pw-new" className="grid gap-1.5 text-[13px] font-medium text-ink-2">
        New password
        <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
      </label>
      <div className="grid gap-1.5" aria-live="polite">
        <div className="flex gap-1" role="img" aria-label={`Strength: ${STRENGTH[passed]}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn('h-[5px] flex-1 rounded-sm', i < passed ? bar : 'bg-line')} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
          {CHECKS.map((c) => {
            const on = c.test(next);
            return (
              <span key={c.label} className={cn('inline-flex items-center gap-1', on ? 'text-positive' : 'text-ink-muted')}>
                {on ? <Check size={13} strokeWidth={1.6} aria-hidden /> : <X size={13} strokeWidth={1.6} aria-hidden />}
                {c.label}
              </span>
            );
          })}
          {next ? <b className={cn('ml-auto font-medium', passed >= 3 ? 'text-positive' : 'text-warning')}>{STRENGTH[passed]}</b> : null}
        </div>
      </div>
      <label htmlFor="pw-conf" className="grid gap-1.5 text-[13px] font-medium text-ink-2">
        Confirm new password
        <Input
          id="pw-conf"
          type="password"
          value={conf}
          onChange={(e) => setConf(e.target.value)}
          autoComplete="new-password"
          className={cn(conf && match && 'border-positive-mid')}
          aria-invalid={conf.length > 0 && !match}
        />
      </label>
      {conf && !match ? <span className="-mt-1.5 text-[12px] text-danger">Passwords do not match</span> : null}
      {err ? (
        <span role="alert" className="text-[13px] font-medium text-danger">
          {err}
        </span>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!ok || busy}>
          Save password
        </Button>
      </div>
    </form>
  );
}
