'use client';

/**
 * The To row (prototype mx-tos / mx-sugg; live ComposeRecipientPicker): chips,
 * name / email search over the directory, typed addresses outside it (Enter,
 * comma, Tab, leaving the field, paste), Backspace drops the last chip, and the
 * Team and Client pickers (a client puts its contacts in To and swaps them when
 * it changes; people picked by hand stay).
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { filterDirectoryPeople, uniqueDirectoryManagers, uniqueDirectoryProjects, type DirectoryPerson } from '@/lib/email/directory-filter';
import { isEmailAddress, resolveTypedRecipients } from '@/lib/email/recipient-input';
import { Icon, Select } from '../../ui';
import { clientAutoFill, groupPeople, recipientsOf, type Recipient } from './model';

const CHIPS = 3;

export function RecipientPicker({
  people,
  loading,
  failed,
  onRetry,
  selected,
  onToggle,
  onApplyAutoFill,
  customEmails,
  onAddCustomEmails,
  onRemoveCustomEmail,
  inScope,
  scopeNote,
}: {
  people: DirectoryPerson[];
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  selected: ReadonlySet<string>;
  onToggle: (userId: string) => void;
  onApplyAutoFill: (remove: string[], add: string[]) => void;
  customEmails: string[];
  onAddCustomEmails: (emails: string[]) => void;
  onRemoveCustomEmail: (email: string) => void;
  /** the Client picker follows the Stage filter */
  inScope: (projectId: string) => boolean;
  scopeNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('all');
  const [clientId, setClientId] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const filtRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const autoFilled = useRef<string[]>([]);

  const teams = useMemo(() => uniqueDirectoryManagers(people), [people]);
  const clients = useMemo(() => uniqueDirectoryProjects(people).filter((c) => c.id === clientId || inScope(c.id)), [people, clientId, inScope]);
  const visible = useMemo(() => filterDirectoryPeople(people, { query, managerId: team, projectId: clientId }), [people, query, team, clientId]);
  const groups = useMemo(() => groupPeople(visible), [visible]);
  const recipients = useMemo(() => recipientsOf(people, selected, customEmails), [people, selected, customEmails]);
  const shown = showAll ? recipients : recipients.slice(0, CHIPS);
  const hidden = recipients.length - shown.length;

  const trimmed = query.trim();
  const typedIsAddress = isEmailAddress(trimmed);
  const typedInDirectory = people.some((p) => p.email.trim().toLowerCase() === trimmed.toLowerCase());
  const offerTyped = typedIsAddress && !typedInDirectory && !customEmails.includes(trimmed.toLowerCase());

  /* close when a click lands outside the To and filter rows */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && (rowRef.current?.contains(t) || filtRef.current?.contains(t))) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function toggle(userId: string) {
    if (selected.has(userId)) autoFilled.current = autoFilled.current.filter((id) => id !== userId);
    onToggle(userId);
  }
  function remove(r: Recipient) {
    if (r.kind === 'person') toggle(r.userId);
    else onRemoveCustomEmail(r.email);
  }
  /** typed text → chips; false when nothing usable was typed (the text stays) */
  function commitTyped(text: string): boolean {
    const resolved = resolveTypedRecipients(people, text);
    for (const id of resolved.personIds) if (!selected.has(id)) onToggle(id);
    const fresh = resolved.emails.filter((email) => !customEmails.includes(email));
    if (fresh.length > 0) onAddCustomEmails(fresh);
    if (resolved.personIds.length === 0 && resolved.emails.length === 0) return false;
    setQuery(resolved.invalid.join(' '));
    return true;
  }
  function onClientChange(next: string) {
    const { remove: drop, add } = clientAutoFill(people, selected, autoFilled.current, next);
    autoFilled.current = add;
    onApplyAutoFill(drop, add);
    setClientId(next);
    setOpen(false);
    setQuery('');
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || (e.key === 'Tab' && typedIsAddress)) {
      if (!trimmed) return;
      if (commitTyped(query)) e.preventDefault();
      else if (e.key === 'Enter' || e.key === ',') e.preventDefault();
    } else if (e.key === 'Backspace' && !query && recipients.length > 0) {
      remove(recipients[recipients.length - 1]!);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => listRef.current?.querySelector<HTMLElement>('button[role="option"]')?.focus());
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }
  function onListKey(e: KeyboardEvent<HTMLDivElement>) {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('button[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = e.key === 'ArrowDown' ? i + 1 : i - 1;
      if (next < 0) inputRef.current?.focus();
      else items[Math.min(next, items.length - 1)]?.focus();
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      inputRef.current?.focus();
    }
  }

  return (
    <>
      <div className="mx-mrow" ref={rowRef}>
        <label className="mx-fl" htmlFor="ws-to">
          To
        </label>
        <div className="mx-tos">
          {shown.map((r) => (
            <span key={r.key} className="pill mut ws-chip" title={r.kind === 'person' ? `${r.name} · ${r.email}` : `${r.email} · not in the directory`}>
              <span className="ws-ell">{r.email}</span>
              <button type="button" aria-label={`Remove ${r.name}`} onClick={() => remove(r)}>
                <Icon name="x" size={11} />
              </button>
            </span>
          ))}
          {hidden > 0 ? (
            <button type="button" className="pill mut ws-more" aria-label={`Show ${hidden} more recipients`} onClick={() => setShowAll(true)}>
              +{hidden}
            </button>
          ) : showAll && recipients.length > CHIPS ? (
            <button type="button" className="link ws-more" onClick={() => setShowAll(false)}>
              Fewer
            </button>
          ) : null}
          <input
            id="ws-to"
            ref={inputRef}
            className="mx-in grow"
            role="combobox"
            aria-expanded={open}
            aria-controls="ws-to-list"
            aria-autocomplete="list"
            autoComplete="off"
            value={query}
            placeholder={recipients.length === 0 ? 'Search names or type an email…' : 'Add more…'}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              // leaving the field with a full address typed keeps it (live)
              if (typedIsAddress) commitTyped(query);
            }}
            onKeyDown={onKey}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (/[@]/.test(pasted) && /[,;\s]/.test(pasted.trim()) && commitTyped(pasted)) e.preventDefault();
            }}
          />
        </div>
        <div ref={listRef} id="ws-to-list" className="mx-sugg ws-sugg" role="listbox" aria-label="People" aria-multiselectable="true" hidden={!open} onKeyDown={onListKey}>
          {offerTyped ? (
            <button type="button" role="option" aria-selected={false} className="mx-mi" onMouseDown={(e) => e.preventDefault()} onClick={() => commitTyped(query)}>
              <Icon name="mail" />
              <span className="mx-mt">
                <b className="ws-ell">{`Send to ${trimmed.toLowerCase()}`}</b>
                <span>Not in the directory · press Enter to add</span>
              </span>
            </button>
          ) : null}
          {loading ? (
            <p className="small ws-sline">Loading people…</p>
          ) : failed ? (
            <p className="small ws-sline">
              Could not load people.{' '}
              <button type="button" className="link" onMouseDown={(e) => e.preventDefault()} onClick={onRetry}>
                Try again
              </button>
            </p>
          ) : !visible.length ? (
            offerTyped ? null : (
              <p className="small ws-sline">
                {trimmed.includes('@')
                  ? 'No one matches — finish typing the address to send outside the directory.'
                  : 'No one matches. Type a full email address to send outside the directory.'}
              </p>
            )
          ) : (
            groups.map((g) => (
              <div key={g.label} role="group" aria-label={g.label}>
                <span className="eyebrow" aria-hidden="true">
                  {g.label}
                </span>
                {g.people.map((p) => {
                  const on = selected.has(p.userId);
                  return (
                    <button
                      key={p.userId}
                      type="button"
                      role="option"
                      aria-selected={on}
                      className={'mx-mi' + (on ? ' on' : '')}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggle(p.userId)}
                    >
                      <span className="mx-mt">
                        <b className="ws-ell">{p.name}</b>
                        <span className="ws-ell">{p.email}</span>
                      </span>
                      {on ? <Icon name="check" /> : null}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mx-mrow ws-filt" ref={filtRef}>
        <span className="mx-fl" aria-hidden="true" />
        <Select<string>
          label="Team"
          value={team}
          options={[['all', 'All teams'], ...teams.map((t): [string, string] => [t.id, t.name])]}
          onChange={(v) => {
            setTeam(v);
            inputRef.current?.focus();
            setOpen(true);
          }}
        />
        <Select<string> label="Client" value={clientId} options={[['all', 'All clients'], ...clients.map((c): [string, string] => [c.id, c.companyName])]} onChange={onClientChange} />
        <span className="small">{scopeNote ?? 'Pick a client to put its contacts in To'}</span>
      </div>
    </>
  );
}
