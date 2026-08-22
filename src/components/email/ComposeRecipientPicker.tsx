'use client';

import { useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';

/** Keep the To row compact; extras behind +N. */
const VISIBLE_CHIPS = 2;

const CHIP =
  'inline-flex h-7 max-w-[min(100%,18rem)] shrink-0 items-center gap-1 rounded-md border border-border/80 bg-raised/50 px-2 text-foreground hover:border-primary/40';

const FIELD =
  'box-border flex min-h-10 min-w-0 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-panel px-2 py-1 text-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/40';

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
};

export function ComposeRecipientPicker({
  people,
  loading,
  selected,
  onToggle,
  onApplyAutoFill,
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
  const selectedPeople = useMemo(
    () => people.filter((p) => selected.has(p.userId)),
    [people, selected],
  );
  const shownChips = selectedPeople.slice(0, VISIBLE_CHIPS);
  const overflowChips = selectedPeople.slice(VISIBLE_CHIPS);

  function handleToggle(userId: string) {
    if (selected.has(userId)) {
      autoFilledRef.current = autoFilledRef.current.filter((id) => id !== userId);
    }
    onToggle(userId);
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
    <div className="space-y-1" data-mail-to-row>
      <Label htmlFor="mail-to-search">To</Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Popover open={open} onOpenChange={setOpen} modal={false}>
          <PopoverAnchor asChild>
            <div
              className={cn(FIELD, 'flex-1', open && 'border-primary ring-2 ring-ring/40')}
            >
              {shownChips.map((person) => (
                <button
                  key={person.userId}
                  type="button"
                  className={cn(
                    CHIP,
                    selectedPeople.length === 1 && overflowChips.length === 0 && 'max-w-[calc(100%-7rem)]',
                  )}
                  title={`Remove ${person.name}`}
                  onClick={() => handleToggle(person.userId)}
                >
                  <span className="truncate font-mono text-[12.5px]">{person.email}</span>
                  <X className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              ))}
              {overflowChips.length > 0 ? (
                <OverflowChips people={overflowChips} onRemove={handleToggle} />
              ) : null}
              <input
                id="mail-to-search"
                ref={searchRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                placeholder={selectedPeople.length === 0 ? 'Search names…' : 'Add more…'}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls="mail-to-people"
                autoComplete="off"
                className={cn(
                  'h-8 bg-transparent px-1 text-sm text-foreground outline-none placeholder:text-muted-foreground',
                  selectedPeople.length === 0 ? 'min-w-[7rem] flex-1' : 'w-[6.5rem] shrink-0',
                )}
              />
            </div>
          </PopoverAnchor>

          <PopoverContent
            align="start"
            sideOffset={6}
            collisionPadding={16}
            className="w-[min(28rem,calc(100vw-2rem))] p-1"
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
              aria-multiselectable="true"
              aria-label="People"
            >
              {loading ? (
                <p className="px-2 py-3 text-[13px] text-muted-foreground">Loading people…</p>
              ) : visible.length === 0 ? (
                <p className="px-2 py-3 text-[13px] text-muted-foreground">No one matches.</p>
              ) : (
                visible.map((person) => {
                  const checked = selected.has(person.userId);
                  return (
                    <label
                      key={person.userId}
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/40',
                        checked && 'bg-primary-light/40',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => handleToggle(person.userId)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-foreground">
                          {person.name}
                        </span>
                        <span className="block truncate font-mono text-[11px] text-muted-foreground">
                          {person.email}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
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
        className="h-10 w-[10.5rem] rounded-md text-sm"
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

function OverflowChips({
  people,
  onRemove,
}: {
  people: DirectoryPerson[];
  onRemove: (userId: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(CHIP, 'max-w-none tabular-nums hover:bg-raised')}
          aria-label={`${people.length} more recipients`}
        >
          +{people.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <ul className="flex flex-col gap-1">
          {people.map((person) => (
            <li key={person.userId} className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1">
              <span className="min-w-0 flex-1 truncate font-mono text-[12px]" title={person.email}>
                {person.email}
              </span>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${person.name}`}
                onClick={() => onRemove(person.userId)}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
