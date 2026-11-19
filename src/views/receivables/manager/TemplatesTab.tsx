'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Chip } from '@/components/ui/spectrum-chip';
import { useSignName, useTemplates } from '@/hooks/use-receivables-v2';
import { TEMPLATE_KINDS, TEMPLATE_META, changedParts, cleanTemplate, type TemplateKind, type TemplateText } from '@/lib/receivables/templates';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { stamp } from '../format';
import { previewOf } from './templates/preview';

/**
 * The Templates tab (owner, 19 Nov 2026): every receivables email in one place. The left list
 * shows each email type, when it goes out and whether its words were changed. The editor changes
 * the subject, greeting, opening and closing; the tables always come from the sheet. The preview
 * is the real email built from sample invoices with the words being typed. Save keeps the words for
 * this sheet; Reset goes back to the standard words.
 */

const EMPTY: TemplateText = { subject: '', greeting: '', intro: '', closing: '' };
const FIELDS: Array<{ key: keyof TemplateText; label: string; multi?: boolean; hint: string }> = [
  { key: 'subject', label: 'Subject', hint: 'The email subject line.' },
  { key: 'greeting', label: 'Greeting', hint: 'The first line, for example "Hi {name},".' },
  { key: 'intro', label: 'Opening text', multi: true, hint: 'Above the table. A blank line starts a new paragraph.' },
  { key: 'closing', label: 'Closing text', multi: true, hint: 'Under the table, before "Regards".' },
];

export function TemplatesTab({ sheetId, sheetName, today }: { sheetId: string; sheetName: string; today: string }) {
  const { query, save, reset } = useTemplates(sheetId);
  const sign = useSignName();
  const [kind, setKind] = useState<TemplateKind>('summary');
  const [draft, setDraft] = useState<TemplateText>(EMPTY);
  const lastField = useRef<{ key: keyof TemplateText; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const saved = query.data?.templates[kind];
  const savedText: TemplateText = { ...EMPTY, ...saved };
  // A new email type, or fresh data from the server, fills the editor with what is saved.
  useEffect(() => {
    setDraft({ ...EMPTY, ...query.data?.templates[kind] });
  }, [kind, query.data]);

  const meta = TEMPLATE_META[kind];
  const dirty = FIELDS.some((f) => draft[f.key].trim() !== savedText[f.key].trim());
  const preview = useMemo(() => previewOf(kind, cleanTemplate(draft), { today, signName: sign.query.data?.name || 'Accounts Team', sheetName }), [kind, draft, today, sign.query.data?.name, sheetName]);

  const pick = (k: TemplateKind) => {
    if (k === kind) return;
    if (dirty && !window.confirm('Leave this template without saving your changes?')) return;
    setKind(k);
  };
  /** A placeholder goes where the cursor was in the last field used (the opening text by default). */
  const insert = (ph: string) => {
    const at = lastField.current;
    const key = at?.key ?? 'intro';
    const value = draft[key];
    const start = at?.el.selectionStart ?? value.length;
    const end = at?.el.selectionEnd ?? value.length;
    setDraft({ ...draft, [key]: value.slice(0, start) + ph + value.slice(end) });
    requestAnimationFrame(() => {
      at?.el.focus();
      at?.el.setSelectionRange(start + ph.length, start + ph.length);
    });
  };
  const onSave = () =>
    save.mutate(
      { kind, ...draft },
      {
        onSuccess: () => toastSuccess('Template saved', `${meta.label} emails use these words from now on.`),
        onError: (e) => toastError('Not saved', e instanceof Error ? e.message : undefined),
      },
    );
  const onReset = () => {
    if (!window.confirm(`Go back to the standard words for "${meta.label}"?`)) return;
    reset.mutate(kind, {
      onSuccess: () => toastSuccess('Back to the standard words', meta.label),
      onError: (e) => toastError('Not reset', e instanceof Error ? e.message : undefined),
    });
  };

  if (query.isLoading) return <p className="py-10 text-center text-ink-muted">Loading the templates…</p>;
  if (query.error) return <p className="py-10 text-center text-danger">{query.error.message}</p>;

  return (
    <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* The email types. */}
      <nav aria-label="Email templates" className="h-fit rounded-md border border-line bg-surface-raised p-1.5">
        {TEMPLATE_KINDS.map((k) => {
          const m = TEMPLATE_META[k];
          const custom = changedParts(query.data?.templates[k]).length > 0;
          return (
            <button
              key={k}
              type="button"
              aria-current={k === kind ? 'true' : undefined}
              onClick={() => pick(k)}
              className={cn('flex w-full flex-col gap-0.5 rounded-md border-l-2 px-2.5 py-1.5 text-left', k === kind ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-hover')}
            >
              <span className="flex items-center gap-2">
                <span className={cn('text-[13px] text-ink', k === kind && 'font-medium')}>{m.label}</span>
                {custom ? (
                  <Chip raw tone="prog" className="ml-auto">
                    Custom
                  </Chip>
                ) : null}
              </span>
              <span className="text-[11.5px] text-ink-muted">{m.when}</span>
            </button>
          );
        })}
      </nav>

      <div className="grid min-w-0 gap-3 min-[1700px]:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* The editor. */}
        <section aria-label={`Edit ${meta.label}`} className="grid h-fit gap-2.5 rounded-md border border-line bg-surface-raised p-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-[15px] font-medium text-ink">{meta.label}</h2>
            <span className="text-[12px] text-ink-muted">{meta.when}</span>
            {query.data?.stamps[kind] ? <span className="ml-auto text-[11.5px] text-ink-muted">{`Changed ${stamp(query.data.stamps[kind]!.updatedAt)}`}</span> : null}
          </div>
          <p className="text-[12.5px] text-ink-2">Leave a box empty to keep the standard words, shown in grey. The tables always come from the sheet.</p>
          {FIELDS.map((f) => {
            const id = `tpl-${f.key}`;
            const common = {
              id,
              value: draft[f.key],
              placeholder: meta.standard[f.key] || '(nothing)',
              onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [f.key]: e.target.value }),
              onFocus: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => (lastField.current = { key: f.key, el: e.currentTarget }),
              onSelect: (e: { currentTarget: HTMLInputElement | HTMLTextAreaElement }) => (lastField.current = { key: f.key, el: e.currentTarget }),
            };
            return (
              <div key={f.key} className="grid gap-1">
                <label htmlFor={id} className="flex items-baseline gap-2 text-[12.5px] font-medium text-ink-2">
                  {f.label}
                  <span className="font-normal text-ink-muted">{f.hint}</span>
                </label>
                {f.multi ? <Textarea {...common} rows={3} maxLength={2000} className="min-h-[70px] text-[13px]" /> : <Input {...common} maxLength={f.key === 'subject' ? 200 : 120} className="h-8 text-[13px]" />}
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
            Insert:
            {meta.placeholders.map((ph) => (
              <button key={ph} type="button" onClick={() => insert(ph)} className="rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[11.5px] text-ink hover:bg-hover">
                {ph}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-2.5">
            <Button size="sm" onClick={onSave} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save template'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setDraft(savedText)} disabled={!dirty}>
              Undo changes
            </Button>
            <Button size="sm" variant="quiet" className="ml-auto" onClick={onReset} disabled={!changedParts(saved).length || reset.isPending}>
              <RotateCcw aria-hidden className="size-3.5" />
              Reset to standard
            </Button>
          </div>
          {dirty ? <p className="text-[12px] text-warning">Not saved yet. The preview shows your changes.</p> : null}
        </section>

        {/* The preview: the real email, built from sample invoices. */}
        <section aria-label="Preview" className="grid h-fit gap-1.5 rounded-md border border-line bg-surface-raised p-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-[13px] font-medium text-ink">Preview</h2>
            <span className="text-[11.5px] text-ink-muted">Sample invoices, not your sheet</span>
          </div>
          <div className="truncate rounded border border-line-soft bg-surface-sunken px-2 py-1 text-[12.5px]">
            <span className="text-ink-muted">Subject </span>
            <b className="font-medium text-ink">{preview.subject}</b>
          </div>
          <iframe title={`${meta.label} preview`} sandbox="" srcDoc={preview.html} className="h-[560px] w-full rounded border border-line-soft bg-white" />
        </section>
      </div>
    </div>
  );
}
