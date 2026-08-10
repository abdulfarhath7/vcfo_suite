"use client";

import { useCallback, useEffect, useReducer } from 'react';
import { X } from 'lucide-react';
import { emailSchema } from '@/lib/api/schemas';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { Surface } from '@/components/noir/Surface';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ProgressCcResponse {
  ok: boolean;
  emails?: string[];
  defaultCcConfigured?: boolean;
  error?: string;
}

interface ProgressEmailCcSectionProps {
  engagementId: string;
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

export function ProgressEmailCcSection({ engagementId }: ProgressEmailCcSectionProps) {
  const [state, dispatch] = useReducer(ccReducer, initialCcState);
  const { emails, defaultCcConfigured, loading, saving, draft, inputError } = state;

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

  const persist = async (next: string[]) => {
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
          return;
        }
        if (code === 'invalid_email') {
          toastError('Invalid email', 'Check the address and try again.');
          return;
        }
        throw new Error(code);
      }
      dispatch({
        type: 'set_emails',
        emails: data.emails ?? [],
        defaultCcConfigured: Boolean(data.defaultCcConfigured),
      });
      toastSuccess('CC list updated', 'Progress emails will include these addresses.');
    } catch {
      toastError('Could not save CC list', 'Try again in a moment.');
    } finally {
      dispatch({ type: 'patch', patch: { saving: false } });
    }
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
    dispatch({ type: 'patch', patch: { inputError: null, draft: '' } });
    void persist([...emails, parsed.data]);
  };

  const handleRemove = (email: string) => {
    void persist(emails.filter((e) => e !== email));
  };

  return (
    <Surface className="p-5 mb-5">
      <h2 className="text-[12px] uppercase tracking-wider text-text-tertiary font-semibold mb-1">
        Progress email CC
      </h2>
      <p className="text-[12.5px] text-text-secondary mb-4 leading-relaxed">
        Additional recipients copied on client progress emails for this project.
        {defaultCcConfigured
          ? ' Firm default CC is always included.'
          : ' Add addresses below for this project only.'}
      </p>
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
