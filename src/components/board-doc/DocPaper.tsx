'use client';

import { useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { segmentText } from './merge-segments';
import type { DocModel, MergeValue } from './types';

/**
 * C5: the Draft tab. The generated text on the letterhead, margin labels beside each section and
 * the two dated labels under the heading. Values filled from answers have the brand-soft tint; a
 * click opens the field that holds the value, or names the field when the viewer cannot edit it.
 * The paper never draws a signature or a seal (P7).
 */
export function DocPaper({
  model,
  values,
  onField,
  canEdit,
  activeKey,
  className,
}: {
  model: DocModel;
  values: MergeValue[];
  onField?: (v: MergeValue) => void;
  /** Default: every value is editable when `onField` is set. */
  canEdit?: (v: MergeValue) => boolean;
  activeKey?: string | null;
  className?: string;
}) {
  const [noted, setNoted] = useState<string | null>(null);

  const renderText = (text: string, at: string) =>
    segmentText(text, values).map((seg, i) => {
      if (!seg.field) return <span key={i}>{seg.text}</span>;
      const f = seg.field;
      const id = `${at}.${i}`;
      const editable = Boolean(onField) && (canEdit ? canEdit(f) : true);
      const act = () => {
        if (editable) onField!(f);
        else setNoted((n) => (n === id ? null : id));
      };
      const onKey = (e: KeyboardEvent<HTMLSpanElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          act();
        } else if (e.key === 'Escape') setNoted(null);
      };
      return (
        <span key={i}>
          <span
            role="button"
            tabIndex={0}
            data-field={f.key}
            aria-label={`${f.missing ? 'Not given yet' : seg.text} · ${f.source}`}
            title={f.missing ? `Not given yet · ${f.source}` : f.source}
            onClick={act}
            onKeyDown={onKey}
            onBlur={() => setNoted((n) => (n === id ? null : n))}
            className={cn(
              'cursor-pointer rounded-[3px] px-[3px] outline-none transition-[box-shadow] focus-visible:ring-[1.5px] focus-visible:ring-brand',
              f.missing
                ? 'border-b-[1.5px] border-dashed border-line-strong text-ink-faint'
                : 'bg-brand-soft font-medium text-brand-text hover:ring-[1.5px] hover:ring-brand-line',
              activeKey === f.key && 'ring-[1.5px] ring-brand',
            )}
          >
            {seg.text}
          </span>
          {noted === id ? (
            <span role="status" className="ml-1 inline-flex rounded-mark bg-surface-sunken px-1.5 align-baseline text-[11.5px] font-medium text-ink-2 animate-in fade-in-0 duration-150">
              {f.missing ? 'Not given yet · ' : 'From '}
              {f.source}
            </span>
          ) : null}
        </span>
      );
    });

  return (
    <article
      aria-label="Draft"
      className={cn('relative rounded-mark border border-line bg-surface-raised px-[clamp(14px,3vw,34px)] pb-7 pt-6 text-[13px] leading-[1.65] text-ink', className)}
    >
      {model.letterhead ? (
        <header className="mb-1.5 flex items-center gap-3 border-b-2 border-navy pb-2.5">
          <i aria-hidden className="grid h-[34px] w-[34px] flex-none place-items-center rounded-mark bg-navy text-[15px] font-bold not-italic text-on-navy">
            {model.letterhead.name.trim().charAt(0).toUpperCase()}
          </i>
          <div className="min-w-0">
            <b className="block truncate text-[13px] font-bold uppercase tracking-[.03em]">{model.letterhead.name}</b>
            {model.letterhead.address ? <span className="block text-[11px] text-ink-muted">{model.letterhead.address}</span> : null}
          </div>
        </header>
      ) : null}
      {model.letterhead?.note ? (
        <span className="mb-2.5 inline-flex rounded-mark border border-dashed border-line-strong px-1.5 text-[10.5px] text-ink-muted">{model.letterhead.note}</span>
      ) : null}
      {model.heading ? <h3 className="mx-0 mb-1 mt-2.5 text-center text-[12.5px] font-bold leading-normal tracking-[.04em]">{renderText(model.heading, 'h')}</h3> : null}
      {model.dates?.length ? (
        <div className="mb-3 flex flex-wrap justify-center gap-2">
          {model.dates.map((d) => (
            <span key={d.label} className="rounded-mark border border-line px-[7px] py-px text-[11px] text-ink-muted">
              {d.label} · {d.value}
            </span>
          ))}
        </div>
      ) : null}
      {model.sections.map((s, si) => (
        <section key={si} className="mt-2.5 grid gap-0.5 sm:grid-cols-[84px_minmax(0,1fr)] sm:gap-3">
          <span className="text-[10.5px] uppercase tracking-[.06em] text-ink-muted sm:border-t-[1.5px] sm:border-line sm:pt-[3px]">{s.label ?? ''}</span>
          <div className="min-w-0">
            {s.paragraphs.map((p, pi) => (
              <p key={pi} className="m-0 mb-2 whitespace-pre-line break-words">
                {renderText(p, `${si}.${pi}`)}
              </p>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}
