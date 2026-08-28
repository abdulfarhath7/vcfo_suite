"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { emailSchema } from '@/lib/api/schemas';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { Surface } from '@/components/noir/Surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const INLINE_VISIBLE_CC = 2;
/** Shared pill chrome for inline CC chips, +N overflow, and Add. */
const INLINE_CC_PILL =
  'inline-flex h-6 shrink-0 items-center rounded-full border border-border/80 bg-raised/50 text-[10.5px] text-ink';

interface ProgressCcResponse {
  ok: boolean;
  emails?: string[];
  defaultCcConfigured?: boolean;
  error?: string;
}

interface ProgressEmailCcSectionProps {
  engagementId: string;
  /** Compact one-line row for intern project heading. */
  variant?: 'card' | 'inline';
  className?: string;
}

type CcState = {
  emails: string[];
  defaultCcConfigured: boolean;
  loading: boolean;
  saving: boolean;
  draft: string;
  inputError: string | null;
};

type CcAction =
  | { type: 'patch'; patch: Partial<CcState> }
  | { type: 'set_emails'; emails: string[]; defaultCcConfigured: boolean };

const initialCcState: CcState = {
  emails: [],
  defaultCcConfigured: false,
  loading: true,
  saving: false,
  draft: '',
  inputError: null,
};

function ccReducer(state: CcState, action: CcAction): CcState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };
    case 'set_emails':
      return {
        ...state,
        emails: action.emails,
        defaultCcConfigured: action.defaultCcConfigured,
      };
    default:
      return state;
  }
}

export function ProgressEmailCcSection({
  engagementId,
  variant = 'card',
  className,
}: ProgressEmailCcSectionProps) {
  const [state, dispatch] = useReducer(ccReducer, initialCcState);
  const { emails, defaultCcConfigured, loading, saving, draft, inputError } = state;
  const [adding, setAdding] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const load = useCallback(async () => {
    dispatch({ type: 'patch', patch: { loading: true } });
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/progress-cc`, {
        credentials: 'same-origin',
      });
      const data = (await res.json()) as ProgressCcResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'load_failed');
      }
      dispatch({
        type: 'set_emails',
        emails: data.emails ?? [],
        defaultCcConfigured: Boolean(data.defaultCcConfigured),
      });
    } catch {
      toastError('Could not load CC list', 'Try refreshing the page.');
    } finally {
      dispatch({ type: 'patch', patch: { loading: false } });
    }
  }, [engagementId]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: string[]): Promise<boolean> => {
    dispatch({ type: 'patch', patch: { saving: true } });
    try {
      const res = await fetch(`/api/engagements/${encodeURIComponent(engagementId)}/progress-cc`, {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails: next }),
      });
      const data = (await res.json()) as ProgressCcResponse;
      if (!res.ok || !data.ok) {
        const code = data.error ?? 'save_failed';
        if (code === 'too_many_cc') {
          toastError('Too many addresses', 'You can add up to 10 CC emails per project.');
          return false;
        }
        if (code === 'invalid_email') {
          toastError('Invalid email', 'Check the address and try again.');
          return false;
        }
        throw new Error(code);
      }
      dispatch({
        type: 'set_emails',
        emails: data.emails ?? [],
        defaultCcConfigured: Boolean(data.defaultCcConfigured),
      });
      toastSuccess('CC list updated', 'Progress emails will include these addresses.');
      return true;
    } catch {
      toastError('Could not save CC list', 'Try again in a moment.');
      return false;
    } finally {
      dispatch({ type: 'patch', patch: { saving: false } });
    }
  };

  const closeAdding = () => {
    setAdding(false);
    dispatch({ type: 'patch', patch: { draft: '', inputError: null } });
  };

  const handleAdd = () => {
    const value = draft.trim().toLowerCase();
    if (!value) return;
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      dispatch({ type: 'patch', patch: { inputError: 'Enter a valid email address.' } });
      return;
    }
    if (emails.includes(parsed.data)) {
      dispatch({ type: 'patch', patch: { inputError: 'That address is already on this project.' } });
      return;
    }
    if (emails.length >= 10) {
      dispatch({ type: 'patch', patch: { inputError: 'Maximum 10 additional CC addresses per project.' } });
      return;
    }
    void persist([...emails, parsed.data]).then((ok) => {
      if (!ok) return;
      dispatch({ type: 'patch', patch: { inputError: null, draft: '' } });
      setAdding(false);
    });
  };

  const handleRemove = (email: string) => {
    void persist(emails.filter((e) => e !== email));
  };

  const inlineAddControl = adding ? (
    <div
      className={cn(
        INLINE_CC_PILL,
        'min-w-0 gap-1 py-0 pl-2 pr-0.5 focus-within:border-primary',
      )}
    >
      <input
        ref={addInputRef}
        type="email"
        placeholder="name@firm.com"
        value={draft}
        onChange={(e) => {
          dispatch({ type: 'patch', patch: { draft: e.target.value, inputError: null } });
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            closeAdding();
          }
        }}
        onBlur={(e) => {
          const next = e.relatedTarget as Node | null;
          if (next && e.currentTarget.parentElement?.contains(next)) return;
          if (!draft.trim()) closeAdding();
        }}
        disabled={saving}
        aria-label="Add CC email"
        aria-invalid={Boolean(inputError)}
        className="h-full w-[9.5rem] bg-transparent p-0 font-mono text-[10.5px] text-ink outline-none placeholder:text-text-tertiary disabled:opacity-50"
      />
      <button
        type="button"
        onClick={handleAdd}
        disabled={saving || !draft.trim()}
        aria-label="Confirm CC email"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:text-ink disabled:opacity-40"
      >
        <Plus className="h-2.5 w-2.5" />
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      disabled={saving}
      aria-label="Add CC email"
      className={cn(INLINE_CC_PILL, 'gap-1 px-2 font-medium hover:bg-raised disabled:opacity-50')}
    >
      <Plus className="h-3 w-3" />
      Add
    </button>
  );

  if (variant === 'inline') {
    const visibleEmails = emails.slice(0, INLINE_VISIBLE_CC);
    const hiddenEmails = emails.slice(INLINE_VISIBLE_CC);

    const renderChip = (email: string) => (
      <span
        key={email}
        className={cn(INLINE_CC_PILL, 'min-w-0 max-w-[8.5rem] gap-1 px-1.5')}
      >
        <span className="min-w-0 truncate font-mono" title={email}>
          {email}
        </span>
        <button
          type="button"
          onClick={() => handleRemove(email)}
          disabled={saving}
          className="shrink-0 text-text-tertiary hover:text-ink disabled:opacity-50"
          aria-label={`Remove ${email}`}
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </span>
    );

    return (
      <div className={cn('min-w-0', className)}>
        <div className="flex min-w-0 flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
          <span
            className="shrink-0 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-text-tertiary"
            title={
              defaultCcConfigured
                ? 'Firm default CC is always included.'
                : 'Copied on client progress emails for this project.'
            }
          >
            CC
          </span>
          {loading ? (
            <span className="shrink-0 text-[11px] text-text-tertiary">Loading…</span>
          ) : (
            <>
              {visibleEmails.map(renderChip)}
              {hiddenEmails.length > 0 ? (
                <Popover open={moreOpen} onOpenChange={setMoreOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={cn(INLINE_CC_PILL, 'px-2 font-medium tabular-nums hover:bg-raised')}
                      aria-label={`${hiddenEmails.length} more CC ${hiddenEmails.length === 1 ? 'address' : 'addresses'}`}
                    >
                      +{hiddenEmails.length}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-2">
                    <ul className="flex flex-col gap-1">
                      {hiddenEmails.map((email) => (
                        <li
                          key={email}
                          className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 hover:bg-muted/50"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink" title={email}>
                            {email}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemove(email)}
                            disabled={saving}
                            className="shrink-0 text-text-tertiary hover:text-ink disabled:opacity-50"
                            aria-label={`Remove ${email}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        setAdding(true);
                      }}
                      className={cn(INLINE_CC_PILL, 'mt-1.5 gap-1 px-2 font-medium hover:bg-raised')}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </button>
                  </PopoverContent>
                </Popover>
              ) : null}
              <div className="shrink-0">{inlineAddControl}</div>
            </>
          )}
        </div>
        {inputError ? (
          <p className="mt-0.5 text-right text-[11px] text-destructive">{inputError}</p>
        ) : null}
      </div>
    );
  }

  return (
    <Surface className="p-5 mb-5">
      <h2 className="text-[12px] uppercase tracking-wider text-text-tertiary font-semibold mb-1">
        Progress email CC
      </h2>
      {defaultCcConfigured && (
        <p className="text-[11.5px] text-text-tertiary mb-3 font-mono">
          Firm default CC included
        </p>
      )}

      {loading ? (
        <p className="text-[12px] text-text-tertiary">Loading…</p>
      ) : (
        <>
          {emails.length > 0 && (
            <ul className="flex flex-wrap gap-2 mb-3">
              {emails.map((email) => (
                <li
                  key={email}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1 text-[12px] text-ink"
                >
                  <span className="font-mono">{email}</span>
                  <button
                    type="button"
                    onClick={() => handleRemove(email)}
                    disabled={saving}
                    className="text-text-tertiary hover:text-ink disabled:opacity-50"
                    aria-label={`Remove ${email}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 items-start">
            <div className="flex-1 min-w-[200px]">
              <Input
                type="email"
                placeholder="colleague@firm.com"
                value={draft}
                onChange={(e) => {
                  dispatch({ type: 'patch', patch: { draft: e.target.value, inputError: null } });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={saving}
                className="h-9 text-[13px]"
              />
              {inputError && (
                <p className="text-[11px] text-destructive mt-1">{inputError}</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
            >
              Add CC
            </Button>
          </div>
        </>
      )}
    </Surface>
  );
}
