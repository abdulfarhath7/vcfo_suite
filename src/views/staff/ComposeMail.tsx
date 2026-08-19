'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { ComposeRecipientPicker } from '@/components/email/ComposeRecipientPicker';
import { ComposeTemplatePanel } from '@/components/email/ComposeTemplatePanel';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface } from '@/components/noir';
import { AccentButton } from '@/components/noir/AccentButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@/context/AppContext';
import { roleSettingsPath } from '@/lib/auth-routes';
import { emailBrandingLabel, type EmailTemplateDto } from '@/lib/email/compose-branding';
import type { DirectoryPerson } from '@/lib/email/directory-filter';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

type Props = {
  path: string;
};

export default function ComposeMail({ path }: Props) {
  const { user } = useApp();
  const settingsHref = user ? roleSettingsPath(user.role) : '/login';

  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<EmailTemplateDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStatus(true);
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
        setMsEmail(json.msEmail);
      } catch {
        if (!cancelled) setConnected(false);
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPeople(true);
      try {
        const res = await fetch('/api/outlook/directory');
        const json = (await res.json()) as { people?: DirectoryPerson[]; error?: string };
        if (!res.ok) throw new Error(json.error || 'directory_failed');
        if (!cancelled) setPeople(json.people ?? []);
      } catch (err) {
        if (!cancelled) toastError('Could not load people', errorMessage(err));
      } finally {
        if (!cancelled) setLoadingPeople(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedPeople = useMemo(
    () => people.filter((p) => selected.has(p.userId)),
    [people, selected],
  );

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function applyTemplate(template: EmailTemplateDto) {
    setAppliedTemplate(template);
    setSubject(template.subject);
    setBody(template.bodyText);
  }

  async function send() {
    const to = selectedPeople.map((p) => p.email);
    if (to.length === 0) {
      toastError('Pick a recipient', 'Select at least one person in To.');
      return;
    }
    if (!subject.trim()) {
      toastError('Subject required', 'Add a subject before sending.');
      return;
    }
    if (!body.trim()) {
      toastError('Message required', 'Write a message before sending.');
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/outlook/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject: subject.trim(),
          text: body,
          branding: appliedTemplate?.branding ?? 'plain',
          templateId: appliedTemplate?.id,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; from?: string };
      if (!res.ok || json.ok === false) {
        if (res.status === 409 || json.error === 'outlook_not_connected') {
          toastError('Connect Outlook', 'Link your mailbox in Settings, then send again.');
          return;
        }
        throw new Error(json.error ?? 'send_failed');
      }
      toastSuccess('Email sent', `From ${json.from ?? 'your Outlook mailbox'} to ${to.join(', ')}`);
      setSubject('');
      setBody('');
      setSelected(new Set());
      setAppliedTemplate(null);
    } catch (err) {
      toastError("Email didn't send", errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <PageTransition>
      <SEO
        title="Send email — VCFO Suite"
        description="Write and send mail from your connected Outlook mailbox."
        path={path}
      />

      <PageHeader
        accent="cyan"
        icon={Mail}
        eyebrow="Outlook"
        title="Send email"
        subtitle="From your linked mailbox. Add people in To, and apply an SBC template on the right."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Surface className="p-5 sm:p-6">
          <div className="space-y-1">
            <Label htmlFor="mail-from">From</Label>
            <Input
              id="mail-from"
              readOnly
              value={
                loadingStatus
                  ? 'Checking Outlook…'
                  : connected && msEmail
                    ? msEmail
                    : configured
                      ? 'Outlook not connected'
                      : 'Outlook not configured (Azure app)'
              }
            />
            {!loadingStatus && configured && !connected ? (
              <p className="pt-1 text-[12.5px] text-muted-foreground">
                Connect once in{' '}
                <Link href={settingsHref} className="text-primary underline-offset-2 hover:underline">
                  Settings
                </Link>
                . Tokens stay on this account, so any device can send after that.
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <ComposeRecipientPicker
              people={people}
              loading={loadingPeople}
              selected={selected}
              onToggle={toggle}
              onApplyAutoFill={(removeIds, addIds) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  for (const id of removeIds) next.delete(id);
                  for (const id of addIds) next.add(id);
                  return next;
                });
              }}
            />
          </div>

          <div className="mt-4 space-y-1">
            <Label htmlFor="mail-subject">Subject</Label>
            <Input
              id="mail-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={500}
              placeholder="Subject"
            />
            {appliedTemplate ? (
              <p className="flex flex-wrap items-center gap-2 pt-1 text-[12.5px] text-muted-foreground">
                Using {appliedTemplate.name} ({emailBrandingLabel(appliedTemplate.branding)})
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-1 py-0 text-[12.5px]"
                  onClick={() => setAppliedTemplate(null)}
                >
                  Write without a template
                </Button>
              </p>
            ) : null}
          </div>

          <div className="mt-4 space-y-1">
            <Label htmlFor="mail-body">Message</Label>
            <Textarea
              id="mail-body"
              className="min-h-[220px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={20000}
              placeholder="Write the email…"
            />
          </div>

          <div className="mt-5 flex justify-end">
            <AccentButton
              type="button"
              onClick={() => void send()}
              disabled={sending || !connected}
            >
              {sending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending
                </>
              ) : (
                'Send'
              )}
            </AccentButton>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <ComposeTemplatePanel
            selectedId={appliedTemplate?.id ?? null}
            onApply={applyTemplate}
            onClear={() => setAppliedTemplate(null)}
          />
        </Surface>
      </div>
    </PageTransition>
  );
}
