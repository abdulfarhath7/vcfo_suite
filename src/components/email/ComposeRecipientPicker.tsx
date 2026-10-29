'use client';

import { useMemo, useRef, useState } from 'react';
import { AtSign, Users, X } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tag, type ChipTone } from '@/components/ui/spectrum-chip';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  clientRecipientsForProject,
  filterDirectoryPeople,
  uniqueDirectoryManagers,
  uniqueDirectoryProjects,
  type DirectoryPerson,
} from '@/lib/email/directory-filter';
import { isEmailAddress, resolveTypedRecipients } from '@/lib/email/recipient-input';
import { cn } from '@/lib/utils';

/* Prototype email-parts: the pop-down shows up to five client contacts and four team members. */
const CLIENT_CAP = 5;
const TEAM_CAP = 4;

/* Group chips in the pop-down: 24px, 6px corners, soft grey, 12px. */
const CHIP =
  'inline-flex h-6 max-w-[min(100%,18rem)] shrink-0 items-center gap-1.5 rounded-md bg-upcoming-soft px-2 text-[12px] font-medium text-ink-2 hover:bg-surface-sunken';

/* R-35: a client keeps one identity colour. The order matches the super admin client tile. */
const IDENTITY_TONES: ChipTone[] = ['prog', 'violet', 'teal', 'warn', 'ok', 'idle'];

function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** The identity tone of a client contact's first company; team members are grey. */
function recipientTone(person: DirectoryPerson): ChipTone {
  const project = person.kind === 'client' ? person.projects[0] : undefined;
  return project ? IDENTITY_TONES[hashOf(project.id) % IDENTITY_TONES.length]! : 'idle';
}

/** "Name · Org" for a client contact, "Name · Team" for a firm member (prototype `toLabel`). */
function personLabel(person: DirectoryPerson): string {
  if (person.kind === 'client') {
    const org = person.projects[0]?.companyName;
    return org ? `${person.name} · ${org}` : person.name;
  }
  return `${person.name} · Team`;
}

/** 24px initials circle (R-44: people avatars are circles). */
function Avatar({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
  return (
    <span className="inline-grid h-6 w-6 flex-none place-items-center rounded-full bg-surface-sunken text-[10px] font-medium text-ink-2" aria-hidden>
      {initials}
    </span>
  );
}

const FIELD =
  'box-border flex min-h-9 min-w-0 w-full flex-wrap items-center gap-1.5 rounded-md border-1.5 border-line-strong bg-surface-raised px-2 py-1 text-[13.5px] focus-within:border-brand focus-within:ring-4 focus-within:ring-brand-line';

/** The bare field sits inside a compose row that already draws the edge. */
const FIELD_BARE = 'box-border flex min-h-9 min-w-0 w-full flex-wrap items-center gap-1.5 py-1 text-[13.5px]';

function isInsideSelectPortal(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('[data-radix-select-content]'));
}

type Props = {
  people: DirectoryPerson[];
  loading: boolean;
  selected: Set<string>;
  onToggle: (userId: string) => void;
  /** Add/remove To chips without toggling one id at a time (Client auto-fill). */
  onApplyAutoFill: (removeIds: string[], addIds: string[]) => void;
  /** Addresses typed in that belong to nobody in the directory. */
  customEmails: string[];
  onAddCustomEmails: (emails: string[]) => void;
  onRemoveCustomEmail: (email: string) => void;
  /** Draw without its own label and edge, for a labelled compose row (Spectrum email card). */
  bare?: boolean;
  /** Mail groups (G-23). A picked group is one chip; the send route expands it to addresses. */
  groups?: PickerGroup[];
  selectedGroupIds?: Set<string>;
  onToggleGroup?: (groupId: string) => void;
};

export type PickerGroup = { id: string; name: string; shared: boolean; members: Array<{ email: string }> };

/** A To chip: a directory person, or a typed address. */
type Recipient =
  | { key: string; kind: 'person'; person: DirectoryPerson }
  | { key: string; kind: 'email'; email: string }
  | { key: string; kind: 'group'; group: PickerGroup };

export function ComposeRecipientPicker({
  people,
  loading,
  selected,
  onToggle,
  onApplyAutoFill,
  customEmails,
  onAddCustomEmails,
  onRemoveCustomEmail,
  bare,
  groups = [],
  selectedGroupIds,
  onToggleGroup,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [managerId, setManagerId] = useState('all');
  const [clientId, setClientId] = useState('all');
  const searchRef = useRef<HTMLInputElement>(null);
  const autoFilledRef = useRef<string[]>([]);

  const teams = useMemo(() => uniqueDirectoryManagers(people), [people]);
  const clients = useMemo(() => uniqueDirectoryProjects(people), [people]);
  const visible = useMemo(
    () =>
      filterDirectoryPeople(people, {
        query,
        managerId,
        projectId: clientId,
      }),
    [people, query, managerId, clientId],
  );
  const recipients = useMemo<Recipient[]>(
    () => [
      ...people
        .filter((p) => selected.has(p.userId))
        .map((person): Recipient => ({ key: `person:${person.userId}`, kind: 'person', person })),
      ...customEmails.map((email): Recipient => ({ key: `email:${email}`, kind: 'email', email })),
      ...groups
        .filter((g) => selectedGroupIds?.has(g.id))
        .map((group): Recipient => ({ key: `group:${group.id}`, kind: 'group', group })),
    ],
    [people, selected, customEmails, groups, selectedGroupIds],
  );
  const groupMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups.filter((g) => !selectedGroupIds?.has(g.id) && (!q || g.name.toLowerCase().includes(q)));
  }, [groups, selectedGroupIds, query]);
  /* Prototype pop-down groups: Client (up to 5), Team (up to 4), then Groups. A picked person
     leaves the list. With a Team or Client filter set, every match shows. */
  const filtered = managerId !== 'all' || clientId !== 'all';
  const unpicked = visible.filter((p) => !selected.has(p.userId));
  const clientMatches = unpicked.filter((p) => p.kind === 'client').slice(0, filtered ? undefined : CLIENT_CAP);
  const teamMatches = unpicked.filter((p) => p.kind !== 'client').slice(0, filtered ? undefined : TEAM_CAP);
  const firstMatch: { kind: 'person'; id: string } | { kind: 'group'; id: string } | null = clientMatches[0]
    ? { kind: 'person', id: clientMatches[0].userId }
    : teamMatches[0]
      ? { kind: 'person', id: teamMatches[0].userId }
      : groupMatches[0] && onToggleGroup
        ? { kind: 'group', id: groupMatches[0].id }
        : null;
  const trimmedQuery = query.trim();
  const typedIsAddress = isEmailAddress(trimmedQuery);
  const typedMatchesDirectory = people.some(
    (p) => p.email.trim().toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const typedAlreadyAdded = customEmails.includes(trimmedQuery.toLowerCase());
  /** Show "Send to …" when the text is an address nobody in the directory owns. */
  const offerTyped = typedIsAddress && !typedMatchesDirectory && !typedAlreadyAdded;

  function pickFirst(): boolean {
    if (!firstMatch) return false;
    if (firstMatch.kind === 'person') handleToggle(firstMatch.id);
    else onToggleGroup?.(firstMatch.id);
    setQuery('');
    return true;
  }

  function handleToggle(userId: string) {
    if (selected.has(userId)) {
      autoFilledRef.current = autoFilledRef.current.filter((id) => id !== userId);
    }
    onToggle(userId);
  }

  function removeRecipient(recipient: Recipient) {
    if (recipient.kind === 'person') handleToggle(recipient.person.userId);
    else if (recipient.kind === 'group') onToggleGroup?.(recipient.group.id);
    else onRemoveCustomEmail(recipient.email);
  }

  /**
   * Turn what was typed into chips. A directory address selects that person;
   * anything else that is an address becomes a plain chip. Returns false when
   * nothing usable was typed so the caller can leave the text alone.
   */
  function commitTyped(text: string): boolean {
    const resolved = resolveTypedRecipients(people, text);
    for (const id of resolved.personIds) if (!selected.has(id)) onToggle(id);
    const fresh = resolved.emails.filter((email) => !customEmails.includes(email));
    if (fresh.length > 0) onAddCustomEmails(fresh);
    if (resolved.personIds.length === 0 && resolved.emails.length === 0) return false;
    setQuery(resolved.invalid.join(' '));
    return true;
  }

  function handleClientChange(nextClientId: string) {
    const prevAuto = autoFilledRef.current;
    const nextIds = clientRecipientsForProject(people, nextClientId).map((p) => p.userId);
    const manual = [...selected].filter((id) => !prevAuto.includes(id));
    const newlyAuto = nextIds.filter((id) => !manual.includes(id));
    autoFilledRef.current = newlyAuto;
    onApplyAutoFill(prevAuto, newlyAuto);
    setClientId(nextClientId);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={bare ? undefined : 'space-y-1'} data-mail-to-row>
      {bare ? null : <Label htmlFor="mail-to-search">To</Label>}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverAnchor asChild>
            <div
              className={cn(
                bare ? FIELD_BARE : FIELD,
                'flex-1',
                open && !bare && 'border-brand ring-4 ring-brand-line',
              )}
            >
              {recipients.map((recipient) => (
                <Tag
                  key={recipient.key}
                  tone={recipient.kind === 'person' ? recipientTone(recipient.person) : 'idle'}
                  className="h-6 max-w-full shrink-0 gap-1.5 pr-1"
                >
                  {recipient.kind === 'group' ? <Users className="h-3 w-3 shrink-0" strokeWidth={1.6} aria-hidden /> : null}
                  <span className="max-w-[200px] truncate" title={recipientEmail(recipient)}>
                    {recipientText(recipient)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeRecipient(recipient)}
                    className="grid h-4 w-4 place-items-center rounded-sm hover:bg-surface-raised"
                    aria-label={`Remove ${recipientLabel(recipient)}`}
                  >
                    <X className="h-3 w-3" strokeWidth={1.6} aria-hidden />
                  </button>
                </Tag>
              ))}
              <input
                id="mail-to-search"
                role="combobox"
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  // Leaving the field with a full address typed keeps it.
                  if (typedIsAddress) commitTyped(query);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && typedIsAddress)) {
                    if (!trimmedQuery) return;
                    if (commitTyped(query)) e.preventDefault();
                    // Enter picks the first match (prototype RecipientField).
                    else if (e.key === 'Enter') {
                      e.preventDefault();
                      pickFirst();
                    } else if (e.key === ',') e.preventDefault();
                  } else if (e.key === 'Escape') {
                    setOpen(false);
                  } else if (e.key === 'Backspace' && !query && recipients.length > 0) {
                    removeRecipient(recipients[recipients.length - 1]);
                  }
                }}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text');
                  if (/[@]/.test(pasted) && /[,;\s]/.test(pasted.trim()) && commitTyped(pasted)) {
                    e.preventDefault();
                  }
                }}
                placeholder={recipients.length === 0 ? (groups.length > 0 ? 'Name, email or group' : 'Name or email') : ''}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls="mail-to-people"
                autoComplete="off"
                className="h-7 min-w-[140px] flex-1 bg-transparent px-1 text-[13.5px] text-ink outline-none placeholder:text-ink-faint"
              />
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="w-[min(24rem,calc(100vw-2rem))] p-1.5"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              searchRef.current?.focus();
            }}
            onPointerDownOutside={(e) => {
              if (isInsideSelectPortal(e.target)) e.preventDefault();
              if (e.target instanceof Element && e.target.closest('[data-mail-to-row]')) {
                e.preventDefault();
              }
            }}
            onFocusOutside={(e) => {
              if (isInsideSelectPortal(e.target)) e.preventDefault();
              if (e.target instanceof Element && e.target.closest('[data-mail-to-row]')) {
                e.preventDefault();
              }
            }}
          >
            <div
              id="mail-to-people"
              className="max-h-52 space-y-0.5 overflow-y-auto"
              role="listbox"
              aria-label="Recipients"
            >
              {offerTyped ? (
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-surface-sunken"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commitTyped(query)}
                >
                  <AtSign className="h-4 w-4 shrink-0 text-brand-text" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      Send to {trimmedQuery.toLowerCase()}
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">Not in the directory</span>
                  </span>
                </button>
              ) : null}
              {loading ? (
                <p className="px-2 py-3 text-[13px] text-ink-muted">Loading people…</p>
              ) : null}
              {!loading && clientMatches.length > 0 ? (
                <>
                  <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[.07em] text-ink-muted">Client</p>
                  {clientMatches.map((person) => (
                    <PickRow
                      key={person.userId}
                      person={person}
                      first={firstMatch?.kind === 'person' && firstMatch.id === person.userId}
                      onPick={() => {
                        handleToggle(person.userId);
                        setQuery('');
                      }}
                    />
                  ))}
                </>
              ) : null}
              {!loading && teamMatches.length > 0 ? (
                <>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[.07em] text-ink-muted">Team</p>
                  {teamMatches.map((person) => (
                    <PickRow
                      key={person.userId}
                      person={person}
                      first={firstMatch?.kind === 'person' && firstMatch.id === person.userId}
                      onPick={() => {
                        handleToggle(person.userId);
                        setQuery('');
                      }}
                    />
                  ))}
                </>
              ) : null}
              {groupMatches.length > 0 && onToggleGroup ? (
                <>
                  <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[.07em] text-ink-muted">Groups</p>
                  <div className="flex flex-wrap gap-1.5 px-2 pb-1.5">
                    {groupMatches.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        role="option"
                        aria-selected={false}
                        title={g.members.map((m) => m.email).join(', ')}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onToggleGroup(g.id);
                          setQuery('');
                        }}
                        className={cn(CHIP, firstMatch?.kind === 'group' && firstMatch.id === g.id && 'bg-surface-sunken')}
                      >
                        <Users className="h-3 w-3 shrink-0 text-ink-muted" strokeWidth={1.6} aria-hidden />
                        <span className="truncate">{g.name}</span>
                        <span className="tabular-nums text-ink-muted">{g.members.length}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              {!loading && !offerTyped && clientMatches.length === 0 && teamMatches.length === 0 && groupMatches.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-ink-muted">No one matches</p>
              ) : null}
            </div>
          </PopoverContent>
        </Popover>

        <div className="flex shrink-0 gap-2">
          <RowFilter
            label="Team"
            value={managerId}
            options={teams}
            allItem="All teams"
            onValueChange={(v) => {
              setManagerId(v);
              setOpen(true);
            }}
          />
          <RowFilter
            label="Client"
            value={clientId}
            options={clients.map((c) => ({ id: c.id, name: c.companyName }))}
            allItem="All clients"
            onValueChange={handleClientChange}
          />
        </div>
      </div>
    </div>
  );
}

function RowFilter({
  label,
  value,
  options,
  allItem,
  onValueChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  allItem: string;
  onValueChange: (value: string) => void;
}) {
  const selectedName = value === 'all' ? label : options.find((o) => o.id === value)?.name ?? label;
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={label}
        className="h-8 w-[10.5rem] rounded-md text-[13px]"
      >
        <span className="truncate">{selectedName}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{allItem}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function recipientEmail(recipient: Recipient): string {
  if (recipient.kind === 'group') return recipient.group.members.map((m) => m.email).join(', ');
  return recipient.kind === 'person' ? recipient.person.email : recipient.email;
}

/** The chip text: "Name · Org", "Name · Team", a group name, or a typed address. */
function recipientText(recipient: Recipient): string {
  if (recipient.kind === 'group') return recipient.group.name;
  return recipient.kind === 'person' ? personLabel(recipient.person) : recipient.email;
}

function recipientLabel(recipient: Recipient): string {
  if (recipient.kind === 'group') return recipient.group.name;
  return recipient.kind === 'person' ? recipient.person.name : recipient.email;
}

/** One suggestion (prototype `PickRow`): a 24px avatar, the name, and "org · email". */
function PickRow({ person, first, onPick }: { person: DirectoryPerson; first: boolean; onPick: () => void }) {
  const org = person.kind === 'client' ? (person.projects[0]?.companyName ?? 'Client') : 'Team';
  return (
    <button
      type="button"
      role="option"
      aria-selected={first}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 text-left hover:bg-surface-sunken',
        first && 'bg-surface-sunken',
      )}
    >
      <Avatar name={person.name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{person.name}</span>
        <span className="block truncate text-[11.5px] text-ink-muted">
          {org} · {person.email}
        </span>
      </span>
    </button>
  );
}
