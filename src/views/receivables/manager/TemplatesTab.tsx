'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { Chip } from '@/components/ui/spectrum-chip';
import { useSignName, useTemplates } from '@/hooks/use-receivables-v2';
import { TEMPLATE_KINDS, TEMPLATE_META, changedParts, cleanTemplate, type TemplateKind, type TemplateText } from '@/lib/receivables/templates';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { cn } from '@/lib/utils';
import { stamp } from '../format';
import { BODY_PARTS, editorHtml, previewOf, type BodyPart } from './templates/preview';

/**
 * The Templates tab (owner, 19 Nov 2026): every receivables email in one place. The left list
 * shows each email type, when it goes out and whether its words were changed. The editor changes
 * the subject, greeting, opening and closing; the tables always come from the sheet. The preview
 * is the real email built from sample invoices with the words being typed. Save keeps the words for
 * this sheet; Reset goes back to the standard words.
 */

const EMPTY: TemplateText = { subject: '', greeting: '', intro: '', closing: '' };
/** An editable part: a faint tint, an outline on hover and a brand outline while typing, the email's own font. */
const SLOT =
  'rounded-sm border border-transparent bg-[#fafbff] px-1 -mx-1 font-[inherit] text-[length:inherit] leading-[inherit] text-[inherit] outline-none placeholder:text-[#9aa0a6] hover:border-[#c9ccd1] focus:border-brand focus:bg-[#f6f8ff]';
const PART_LABEL: Record<BodyPart, string> = { greeting: 'Greeting', intro: 'Opening text', closing: 'Closing text' };
const PART_EMPTY: Record<BodyPart, string> = { greeting: 'Add a greeting', intro: 'Add an opening line', closing: '+ Add a closing line (optional)' };

/**
 * The email's HTML with a text box in each part that takes typing. The HTML comes from our own
 * builder and sample invoices only; each `data-slot` gets its text box through a portal, so the
 * HTML is never rebuilt while the person types.
 */
function InPlaceEmail({ html, render }: { html: string; render: (part: BodyPart) => ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Partial<Record<BodyPart, Element>>>({});
  useLayoutEffect(() => {
    const found: Partial<Record<BodyPart, Element>> = {};
    for (const part of BODY_PARTS) {
      const el = box.current?.querySelector(`[data-slot="${part}"]`);
      if (el) found[part] = el;
    }
    setSlots(found);
  }, [html]);
  return (
    <>
      <div
        ref={box}
        title="The tables, the total and the signature come from the sheet."
        className="max-h-[70vh] overflow-auto p-4 [&_ul]:list-disc [&_ul]:pl-6 [&_[data-slot]]:cursor-text"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {BODY_PARTS.map((part) => (slots[part] ? createPortal(render(part), slots[part]!, part) : null))}
    </>
  );
}

export function TemplatesTab({ sheetId, sheetName, today }: { sheetId: string; sheetName: string; today: string }) {
  const { query, save, reset } = useTemplates(sheetId);
  const sign = useSignName();
  const [kind, setKind] = useState<TemplateKind>('summary');
  const [draft, setDraft] = useState<TemplateText>(EMPTY);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const lastField = useRef<{ key: keyof TemplateText; el: HTMLInputElement | HTMLTextAreaElement } | null>(null);

  const saved = query.data?.templates[kind];
  const savedText: TemplateText = { ...EMPTY, ...saved };
  // A new email type, or fresh data from the server, fills the editor with what is saved.
  useEffect(() => {
    setDraft({ ...EMPTY, ...query.data?.templates[kind] });
  }, [kind, query.data]);

  const meta = TEMPLATE_META[kind];
  const dirty = (['subject', ...BODY_PARTS] as const).some((k) => draft[k].trim() !== savedText[k].trim());
  const ctx = { today, signName: sign.query.data?.name || 'Accounts Team', sheetName };
  const editHtml = useMemo(() => editorHtml(kind, ctx), [kind, today, ctx.signName, sheetName]); // eslint-disable-line react-hooks/exhaustive-deps
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

      {/* One email, edited in place (owner, 19 Nov 2026): the outlined parts take typing; the rest comes from the sheet. */}
      <section aria-label={`Edit ${meta.label}`} className="grid min-w-0 content-start gap-2.5 rounded-md border border-line bg-surface-raised p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 className="text-[15px] font-medium text-ink">{meta.label}</h2>
          <span className="text-[12px] text-ink-muted">{meta.when}</span>
          {query.data?.stamps[kind] ? <span className="text-[11.5px] text-ink-muted">{`Changed ${stamp(query.data.stamps[kind]!.updatedAt)}`}</span> : null}
          <span className="flex-1" />
          <SpectrumTabs
            label="View"
            items={[
              { key: 'edit', label: 'Edit' },
              { key: 'preview', label: 'Preview' },
            ]}
            value={view}
            onChange={(k) => setView(k as 'edit' | 'preview')}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-y border-line-soft py-2">
          <Button size="sm" onClick={onSave} disabled={!dirty || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save template'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDraft(savedText)} disabled={!dirty}>
            Undo changes
          </Button>
          {view === 'edit' ? (
            <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
              Insert:
              {meta.placeholders.map((ph) => (
                <button key={ph} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(ph)} className="rounded border border-line bg-surface-sunken px-1.5 py-0.5 font-mono text-[11.5px] text-ink hover:bg-hover">
                  {ph}
                </button>
              ))}
            </span>
          ) : null}
          <Button size="sm" variant="quiet" className="ml-auto" onClick={onReset} disabled={!changedParts(saved).length || reset.isPending}>
            <RotateCcw aria-hidden className="size-3.5" />
            Reset to standard
          </Button>
        </div>
        <p className="text-[12.5px] text-ink-2">
          {view === 'edit'
            ? 'Type in the outlined parts. An empty part keeps the standard words, shown in grey. The tables, the total and the signature come from the sheet.'
            : 'The email as it goes out, with sample invoices and the placeholders filled in.'}
          {dirty ? <span className="text-warning"> Not saved yet.</span> : null}
        </p>

        <div className="mx-auto w-full max-w-[1000px] overflow-hidden rounded-md border border-line-strong bg-white text-black shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#e4e4e4] px-4 py-2 text-[13px]">
            <span className="text-[#6b7079]">Subject</span>
            {view === 'edit' ? (
              <input
                aria-label="Subject"
                value={draft.subject}
                placeholder={meta.standard.subject}
                maxLength={200}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                onFocus={(e) => (lastField.current = { key: 'subject', el: e.currentTarget })}
                onSelect={(e) => (lastField.current = { key: 'subject', el: e.currentTarget })}
                className={cn(SLOT, 'h-7 flex-1 font-medium')}
              />
            ) : (
              <b className="font-medium">{preview.subject}</b>
            )}
          </div>
          {view === 'edit' ? (
            <InPlaceEmail
              key={editHtml}
              html={editHtml}
              render={(part) => (
                <textarea
                  aria-label={PART_LABEL[part]}
                  value={draft[part]}
                  placeholder={meta.standard[part] || PART_EMPTY[part]}
                  maxLength={part === 'greeting' ? 120 : 2000}
                  rows={1}
                  onChange={(e) => setDraft({ ...draft, [part]: part === 'greeting' ? e.target.value.replace(/\n/g, ' ') : e.target.value })}
                  onFocus={(e) => (lastField.current = { key: part, el: e.currentTarget })}
                  onSelect={(e) => (lastField.current = { key: part, el: e.currentTarget })}
                  className={cn(SLOT, 'block w-full resize-none [field-sizing:content]', part !== 'greeting' && 'min-h-[42px]')}
                />
              )}
            />
          ) : (
            <iframe title={`${meta.label} preview`} sandbox="" srcDoc={preview.html} className="h-[640px] w-full bg-white" />
          )}
        </div>
      </section>
    </div>
  );
}
