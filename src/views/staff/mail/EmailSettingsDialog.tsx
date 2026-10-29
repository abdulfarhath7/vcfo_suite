'use client';

import { useEffect, useId, useState } from 'react';
import { Loader2, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tag } from '@/components/ui/spectrum-chip';
import { errorMessage, toastError, toastSuccess } from '@/lib/toast-errors';
import {
  memberText,
  parseMemberText,
  type MailGroup,
  type MailGroupDraft,
} from '@/views/staff/mail/use-mail-groups';

/*
 * Email settings (G-23): the signature added to messages sent from the app (K-40) and the mail
 * groups offered in "To". Opened from the Email page head.
 */

export interface SignatureState {
  signatureEnabled: boolean;
  signatureText: string | null;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connected: boolean;
  signature: SignatureState;
  onSignatureSaved: (next: SignatureState) => void;
  groups: MailGroup[];
  groupsLoading: boolean;
  /** Firm-wide admins may make a group shared. */
  canShare: boolean;
  onCreateGroup: (draft: MailGroupDraft) => Promise<unknown>;
  onUpdateGroup: (id: string, draft: Partial<MailGroupDraft>) => Promise<unknown>;
  onDeleteGroup: (id: string) => Promise<void>;
};

function SectionHead({ children }: { children: string }) {
  return <h3 className="text-[13px] font-medium uppercase tracking-[.07em] text-ink-muted">{children}</h3>;
}

function SignatureSection({
  connected,
  signature,
  onSaved,
}: {
  connected: boolean;
  signature: SignatureState;
  onSaved: (next: SignatureState) => void;
}) {
  const [enabled, setEnabled] = useState(signature.signatureEnabled);
  const [text, setText] = useState(signature.signatureText ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(signature.signatureEnabled);
    setText(signature.signatureText ?? '');
  }, [signature.signatureEnabled, signature.signatureText]);

  const dirty = enabled !== signature.signatureEnabled || text.trim() !== (signature.signatureText ?? '').trim();

  async function save() {
    if (enabled && !text.trim()) {
      toastError('Signature is empty', 'Write the signature, or turn it off.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/outlook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureEnabled: enabled, signatureText: text }),
      });
      const json = (await res.json()) as Partial<SignatureState> & { error?: string };
      if (!res.ok) throw new Error(json.error === 'outlook_not_connected' ? 'Connect Outlook first.' : json.error);
      onSaved({ signatureEnabled: Boolean(json.signatureEnabled), signatureText: json.signatureText ?? null });
      toastSuccess('Signature saved');
    } catch (err) {
      toastError("Signature wasn't saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="grid gap-3" aria-label="Signature">
      <SectionHead>Signature</SectionHead>
      <div className="flex items-center justify-between gap-3 text-[14px] text-ink">
        <label htmlFor="mail-signature-on">Add my signature to messages sent here</label>
        <Switch id="mail-signature-on" checked={enabled} onCheckedChange={setEnabled} disabled={!connected} />
      </div>
      <Textarea
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={2000}
        disabled={!connected}
        placeholder={connected ? 'Name\nSBC · Chartered Accountants\n+91 …' : 'Connect Outlook first'}
        aria-label="Signature text"
        className="text-[13.5px]"
      />
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={() => void save()} disabled={!connected || !dirty || saving}>
          {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save signature
        </Button>
      </div>
    </section>
  );
}

function GroupForm({
  initial,
  canShare,
  onCancel,
  onSave,
}: {
  initial?: MailGroup;
  canShare: boolean;
  onCancel: () => void;
  onSave: (draft: MailGroupDraft) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [members, setMembers] = useState(initial ? memberText(initial.members) : '');
  const [shared, setShared] = useState(initial?.shared ?? false);
  const [saving, setSaving] = useState(false);
  const formId = useId();

  async function save() {
    const parsed = parseMemberText(members);
    if (!name.trim()) {
      toastError('Name required', 'Give the group a name.');
      return;
    }
    if (parsed.invalid.length > 0) {
      toastError('Check the addresses', parsed.invalid.slice(0, 3).join(', '));
      return;
    }
    if (parsed.members.length === 0) {
      toastError('Add an address', 'A group needs at least one address.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ name: name.trim(), shared, members: parsed.members });
      onCancel();
    } catch (err) {
      toastError("Group wasn't saved", errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2.5 rounded-md border-1.5 border-line bg-surface px-3 py-3">
      <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Group name" aria-label="Group name" />
      <Textarea
        rows={4}
        value={members}
        onChange={(e) => setMembers(e.target.value)}
        placeholder={'one address per line\nRohan <rohan@client.in>'}
        aria-label="Group addresses"
        className="text-[13.5px]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {canShare ? (
          <span className="flex items-center gap-2 text-[13px] text-ink">
            <Checkbox id={`${formId}-shared`} checked={shared} onCheckedChange={(v) => setShared(v === true)} />
            <label htmlFor={`${formId}-shared`}>Shared with the firm</label>
          </span>
        ) : null}
        <span className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Save group
          </Button>
        </span>
      </div>
    </div>
  );
}

function GroupsSection({
  groups,
  loading,
  canShare,
  onCreate,
  onUpdate,
  onDelete,
}: {
  groups: MailGroup[];
  loading: boolean;
  canShare: boolean;
  onCreate: Props['onCreateGroup'];
  onUpdate: Props['onUpdateGroup'];
  onDelete: Props['onDeleteGroup'];
}) {
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  async function remove(group: MailGroup) {
    try {
      await onDelete(group.id);
      setAsking(null);
      toastSuccess('Group deleted', group.name);
    } catch (err) {
      toastError("Group wasn't deleted", errorMessage(err));
    }
  }

  return (
    <section className="grid gap-3" aria-label="Groups">
      <div className="flex items-center gap-2">
        <SectionHead>Groups</SectionHead>
        {editing === null ? (
          <Button type="button" size="sm" variant="secondary" className="ml-auto" onClick={() => setEditing('new')}>
            <Plus aria-hidden /> New group
          </Button>
        ) : null}
      </div>
      {editing === 'new' ? (
        <GroupForm canShare={canShare} onCancel={() => setEditing(null)} onSave={onCreate} />
      ) : null}
      {loading ? (
        <p className="text-[13px] text-ink-muted">Loading groups…</p>
      ) : groups.length === 0 && editing !== 'new' ? (
        <p className="text-[13px] text-ink-muted">No groups yet</p>
      ) : (
        <ul className="grid divide-y divide-line-soft rounded-md border-1.5 border-line">
          {groups.map((group) =>
            editing === group.id ? (
              <li key={group.id} className="p-2">
                <GroupForm
                  initial={group}
                  canShare={canShare}
                  onCancel={() => setEditing(null)}
                  onSave={(draft) => onUpdate(group.id, draft)}
                />
              </li>
            ) : (
              <li key={group.id} className="grid gap-2 px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 flex-none text-ink-muted" strokeWidth={1.6} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-medium text-ink">{group.name}</b>
                    <span className="block truncate text-[12px] text-ink-muted" title={group.members.map((m) => m.email).join(', ')}>
                      {group.members.length} {group.members.length === 1 ? 'address' : 'addresses'}
                    </span>
                  </span>
                  {group.shared ? <Tag>Shared</Tag> : null}
                  {group.canEdit ? (
                    <>
                      <button type="button" onClick={() => setEditing(group.id)} className="text-[13px] font-medium text-brand-text hover:underline">
                        Edit
                      </button>
                      <button type="button" onClick={() => setAsking(group.id)} className="text-[13px] font-medium text-danger hover:underline">
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
                {asking === group.id ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-ink">
                    <span className="min-w-0 flex-1">Delete “{group.name}”?</span>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(null)}>
                      Cancel
                    </Button>
                    <Button type="button" size="sm" variant="destructive" onClick={() => void remove(group)}>
                      Delete
                    </Button>
                  </div>
                ) : null}
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

export function EmailSettingsDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-4rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-[18px] font-medium">Email settings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6">
          <SignatureSection connected={props.connected} signature={props.signature} onSaved={props.onSignatureSaved} />
          <GroupsSection
            groups={props.groups}
            loading={props.groupsLoading}
            canShare={props.canShare}
            onCreate={props.onCreateGroup}
            onUpdate={props.onUpdateGroup}
            onDelete={props.onDeleteGroup}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
