'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail, Search } from 'lucide-react';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { Surface } from '@/components/noir';
import { AccentButton } from '@/components/noir/AccentButton';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@/context/AppContext';
import { ROLE_UI_LABEL, type Role } from '@/lib/auth';
import { roleSettingsPath } from '@/lib/auth-routes';
import {
  directoryKindLabel,
  directoryRoleLabel,
  filterDirectoryPeople,
  uniqueDirectoryProjects,
  type DirectoryKindFilter,
  type DirectoryPerson,
  type DirectoryRoleFilter,
} from '@/lib/email/directory-filter';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';

type Props = {
  path: string;
};

const ROLE_FILTERS: DirectoryRoleFilter[] = [
  'all',
  'admin',
  'manager',
  'intern',
  'client',
];

export default function ComposeMail({ path }: Props) {
  const { user } = useApp();
  const settingsHref = user ? roleSettingsPath(user.role) : '/login';

  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [connected, setConnected] = useState(false);
  const [msEmail, setMsEmail] = useState<string | undefined>();
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<DirectoryKindFilter>('all');
  const [role, setRole] = useState<DirectoryRoleFilter>('all');
  const [projectId, setProjectId] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

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

  const projects = useMemo(() => uniqueDirectoryProjects(people), [people]);
  const visible = useMemo(
    () => filterDirectoryPeople(people, { query, kind, role, projectId }),
    [people, query, kind, role, projectId],
  );
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

  async function send() {
    const to = selectedPeople.map((p) => p.email);
    if (to.length === 0) {
      toastError('Pick a recipient', 'Select at least one person from the list.');
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
        subtitle="From your linked mailbox to firm people or clients on your projects."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
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

          <div className="mt-4 space-y-1">
            <Label>To</Label>
            {selectedPeople.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">Nobody selected — use the filters on the right.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {selectedPeople.map((person) => (
                  <button
                    key={person.userId}
                    type="button"
                    onClick={() => toggle(person.userId)}
                    className="rounded-md border border-border bg-muted/40 px-2 py-1 text-[12px] text-foreground hover:border-primary/40"
                    title="Remove"
                  >
                    {person.name}
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">{person.email}</span>
                  </button>
                ))}
              </div>
            )}
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
          <h2 className="font-serif text-xl tracking-tight">People</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Firm = SBC staff. Client = people on your projects.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="relative sm:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, email, company"
                className="pl-9"
              />
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Who</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as DirectoryKindFilter)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="firm">Firm (SBC)</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px] text-muted-foreground">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as DirectoryRoleFilter)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_FILTERS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === 'all' ? 'All roles' : directoryRoleLabel(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[12px] text-muted-foreground">Project</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto pr-1">
            {loadingPeople ? (
              <p className="text-[13px] text-muted-foreground">Loading people…</p>
            ) : visible.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">No one matches these filters.</p>
            ) : (
              visible.map((person) => {
                const checked = selected.has(person.userId);
                return (
                  <label
                    key={person.userId}
                    className={cn(
                      'flex cursor-pointer items-start gap-2.5 rounded-lg border border-transparent px-2 py-2 hover:bg-muted/40',
                      checked && 'border-primary/25 bg-primary-light/40',
                    )}
                  >
                    <Checkbox
                      className="mt-0.5"
                      checked={checked}
                      onCheckedChange={() => toggle(person.userId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">
                        {person.name}
                      </span>
                      <span className="block truncate font-mono text-[11px] text-muted-foreground">
                        {person.email}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {directoryKindLabel(person.kind)} · {ROLE_UI_LABEL[person.role as Role]}
                        {person.projects.length > 0
                          ? ` · ${person.projects.map((p) => p.companyName).join(', ')}`
                          : ''}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {visible.length > 0 ? (
            <div className="mt-3 flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelected((prev) => {
                    const next = new Set(prev);
                    for (const person of visible) next.add(person.userId);
                    return next;
                  });
                }}
              >
                Select visible
              </Button>
            </div>
          ) : null}
        </Surface>
      </div>
    </PageTransition>
  );
}
