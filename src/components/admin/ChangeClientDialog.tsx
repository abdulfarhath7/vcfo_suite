"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import type { Engagement } from '@/data/engagements';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FieldError } from '@/components/admin/create-project-form-shared';
import {
  listEngagementClientsFromDb,
  substituteClientInDb,
  createChangeRequestInDb,
  type EngagementClientRow,
} from '@/lib/project-admin-db';
import { changeRequestDiffValue } from '@/lib/project-change-request-types';
import { clientPasswordSchema, emailSchema, DEFAULT_CLIENT_TEMP_PASSWORD } from '@/lib/api/schemas';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

/**
 * Replaces one client on a project with another person. The person being
 * replaced loses portal access to this project; the replacement gets an account
 * and a welcome email if they do not already have one.
 *
 * An admin does it directly. A manager files a change request carrying the same
 * payload, which the admin executes on approval.
 */
export function ChangeClientDialog({
  engagement,
  open,
  onOpenChange,
  mode,
  onDone,
}: {
  engagement: Engagement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 'direct' applies immediately; 'request' files it for admin approval. */
  mode: 'direct' | 'request';
  onDone: () => void;
}) {
  const [replaceUserId, setReplaceUserId] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState(DEFAULT_CLIENT_TEMP_PASSWORD);
  const [reason, setReason] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ['engagement-clients', engagement.id],
    queryFn: () => listEngagementClientsFromDb(engagement.id),
    enabled: open,
    staleTime: 30_000,
  });
  const clients: EngagementClientRow[] = useMemo(
    () => clientsQuery.data ?? [],
    [clientsQuery.data],
  );

  useEffect(() => {
    if (!open) return;
    setEmail('');
    setFullName('');
    setPassword(DEFAULT_CLIENT_TEMP_PASSWORD);
    setReason('');
    setShowValidation(false);
  }, [open]);

  // Default to the primary client once the roster arrives.
  useEffect(() => {
    if (!open || replaceUserId) return;
    const owner = clients.find((c) => c.memberRole === 'owner') ?? clients[0];
    if (owner) setReplaceUserId(owner.userId);
  }, [open, clients, replaceUserId]);

  const replaced = clients.find((c) => c.userId === replaceUserId) ?? null;

  const errors = {
    replaceUserId: replaceUserId ? '' : 'Choose which client is being replaced.',
    email: emailSchema.safeParse(email).success ? '' : 'Enter a valid email address.',
    password:
      mode === 'request' || clientPasswordSchema.safeParse(password).success
        ? ''
        : 'Use at least 8 characters.',
  };
  const err = (key: keyof typeof errors) => (showValidation ? errors[key] : '');
  const valid = Object.values(errors).every((e) => !e);
  const sameAsReplaced =
    Boolean(replaced?.email) && replaced?.email.toLowerCase() === email.trim().toLowerCase();

  const submit = async () => {
    setShowValidation(true);
    if (!valid || sameAsReplaced) return;
    setSubmitting(true);
    try {
      const payload = {
        replaceUserId,
        email: email.trim().toLowerCase(),
        fullName: fullName.trim() || undefined,
        password,
      };

      if (mode === 'direct') {
        const result = await substituteClientInDb(engagement.id, payload);
        toastSuccess(
          'Client changed',
          `${engagement.companyName} is now with ${result.substituted.email}.`,
        );
      } else {
        await createChangeRequestInDb({
          engagementId: engagement.id,
          kind: 'change_client',
          payload,
          preview: {
            companyName: engagement.companyName,
            fields: [
              {
                label: 'Client',
                from: changeRequestDiffValue(replaced?.email),
                to: payload.email,
              },
              {
                label: 'Contact name',
                from: changeRequestDiffValue(replaced?.name),
                to: changeRequestDiffValue(payload.fullName),
              },
            ],
          },
          reason: reason.trim() || undefined,
        });
        toastSuccess('Sent for approval', 'An admin will review this client change.');
      }
      onDone();
      onOpenChange(false);
    } catch (e) {
      toastError(
        mode === 'direct' ? "Couldn't change the client" : "Couldn't send the request",
        errorMessage(e, 'Check the details and try again.'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'direct' ? 'Change client' : 'Request a client change'}
          </DialogTitle>
          {mode === 'direct' ? (
            <DialogDescription>
              The person you replace loses portal access to this project.
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="change-client-replace">Replace</Label>
            {clientsQuery.isLoading ? (
              <p className="text-[12.5px] text-muted-foreground">Loading the client list…</p>
            ) : clients.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">
                No client is on this project yet.
              </p>
            ) : (
              <select
                id="change-client-replace"
                value={replaceUserId}
                onChange={(e) => setReplaceUserId(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-panel px-2 text-[13px] text-ink"
              >
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name?.trim() || c.email}
                    {c.memberRole === 'owner' ? ' · primary' : ''}
                  </option>
                ))}
              </select>
            )}
            <FieldError id="change-client-replace-error" message={err('replaceUserId')} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-client-email">New client email</Label>
            <Input
              id="change-client-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="founder@company.in"
              aria-invalid={Boolean(err('email'))}
            />
            <FieldError id="change-client-email-error" message={err('email')} />
            {sameAsReplaced ? (
              <p className="text-[11px] text-danger">
                That is the same person you are replacing.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-client-name">New client name</Label>
            <Input
              id="change-client-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="change-client-password">Initial portal password</Label>
            <Input
              id="change-client-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={Boolean(err('password'))}
            />
            <FieldError id="change-client-password-error" message={err('password')} />
          </div>

          {mode === 'request' ? (
            <div className="space-y-2">
              <Label htmlFor="change-client-reason">Why is this needed?</Label>
              <Textarea
                id="change-client-reason"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Context for the admin reviewing this."
              />
            </div>
          ) : null}

          <div
            className={cn(
              'flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-light p-3',
              'text-[12px] text-warning-text',
            )}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <p>
              {replaced?.email ?? 'The current client'} will no longer be able to open{' '}
              {engagement.companyName}. Their documents and submissions stay on the project.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || clients.length === 0}>
            {submitting
              ? 'Working…'
              : mode === 'direct'
                ? 'Change client'
                : 'Send for approval'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
