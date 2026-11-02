'use client';

/**
 * Progress drill-down (prototype s/docs/docs_a_drill.dc.html + proto.js
 * vcfoDrill behaviour): opened from a step / category progress bar, sliding
 * pill All · Received · In review · Missing with the clicked part pre-selected,
 * rows open the shared viewer (files) or the upload (missing). Esc / scrim /
 * × close, focus returns to the bar. Phone (≤700): bottom sheet.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DocNode } from '@/lib/client-portal/documents';
import { dayMonth } from './file-types';
import { PagePortal } from './shared-ui';
import { LinkButton } from '@/components/client-portal/LinkButton';
import { Chip } from '@/components/ui/spectrum-chip';
import { solidTagStyle, statusClass, STATUS_TONE, tagText, tagTip, type StatusClass } from './model';

const TABS: Array<{ label: string; cls?: StatusClass }> = [
  { label: 'All' },
  { label: 'Received', cls: 'ok' },
  { label: 'In review', cls: 'rv' },
  { label: 'Missing', cls: 'ms' },
];

export interface DrillTarget {
  title: string;
  /** "Director KYC" */
  name: string;
  where: string;
  /** null: no link (the files are not in an Incorporation phase). */
  linkText: string | null;
  onLink: () => void;
  files: DocNode[];
  tab: number;
}

export function DocsDrill({
  target,
  onClose,
  onPreview,
  onUpload,
}: {
  target: DrillTarget;
  onClose: () => void;
  onPreview: (n: DocNode, list: DocNode[]) => void;
  onUpload: (n: DocNode) => void;
}) {
  const [t, setT] = useState(target.tab);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);
  const files = target.files.filter((f) => !f.replaced);
  const ok = files.filter((f) => statusClass(f.status) === 'ok').length;
  const rv = files.filter((f) => statusClass(f.status) === 'rv').length;
  const ms = files.filter((f) => statusClass(f.status) === 'ms').length;
  const tot = ok + rv + ms || 1;
  const list = files.filter((f) => t === 0 || statusClass(f.status) === TABS[t]!.cls);
  const previewable = list.filter((f) => f.status !== 'Missing');

  const close = useCallback(() => {
    onClose();
    (opener.current as HTMLElement | null)?.focus?.({ preventScroll: true });
  }, [onClose]);

  useEffect(() => {
    opener.current = document.activeElement;
    const tm = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 40);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      clearTimeout(tm);
      document.removeEventListener('keydown', key, true);
    };
  }, [close]);

  return (
    <PagePortal>
      <div className="dd-root">
        <div
          className="dd-scrim"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${target.name} documents`}
            className="dlg"
          >
            <div className="dd-top">
              <span>
                These documents are for {target.name} in {target.where}
              </span>
              {target.linkText ? (
                <LinkButton
                  onClick={() => {
                    close();
                    target.onLink();
                  }}
                  style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
                >
                  {target.linkText}
                </LinkButton>
              ) : null}
            </div>
            <div className="dd-hd">
              <span className="fico" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="currentColor" />
                </svg>
              </span>
              <h2>{target.title}</h2>
              <span className="dd-trk">
                <span style={{ width: `${(ok / tot) * 100}%`, background: 'oklch(var(--positive-mid))' }} />
                <span style={{ width: `${(rv / tot) * 100}%`, background: 'oklch(var(--brand))' }} />
                <span style={{ width: `${(ms / tot) * 100}%`, background: 'oklch(var(--warning-mid))' }} />
              </span>
              <span className="mono cnt">
                {ok}/{ok + rv + ms}
              </span>
              <button ref={closeRef} type="button" className="sx-ib sm" aria-label="Close" onClick={close}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px 16px', flex: 'none' }}>
              <div className="sx-seg" role="tablist" aria-label="Status">
                {TABS.map((x, i) => {
                  const cnt = i === 0 ? files.length : files.filter((f) => statusClass(f.status) === x.cls).length;
                  return (
                    <button key={x.label} type="button" role="tab" aria-selected={t === i} className={t === i ? 'on' : ''} onClick={() => setT(i)}>
                      {x.label}
                      <span className="cnt">{cnt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="dd-list" style={{ paddingBottom: 6 }}>
              {list.map((f) => {
                const missing = f.status === 'Missing';
                return (
                  <div className="row" key={f.id}>
                    {missing ? (
                      <span className="ft-miss" role="img" aria-label="Not uploaded yet" />
                    ) : (
                      <span className="ft" role="img" aria-label={tagTip(f)} data-tip={tagTip(f)} style={solidTagStyle(f)}>
                        {tagText(f)}
                      </span>
                    )}
                    <LinkButton
                      onClick={() => {
                        if (missing) onUpload(f);
                        else onPreview(f, previewable);
                      }}
                      style={{ flex: 1, minWidth: 0, color: 'oklch(var(--ink))', fontWeight: 500, overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      {/* the ellipsis sits on an inner block: a button's own box does not reliably clip with one */}
                      <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    </LinkButton>
                    <span className="mono cnt">{missing ? (f.due ? `Due ${dayMonth(f.due)}` : 'No due date') : dayMonth(f.date)}</span>
                    <span className="cp-tw">
                      <Chip fixed tone={STATUS_TONE[f.status]}>
                        {f.status}
                      </Chip>
                    </span>
                    {missing ? (
                      <button type="button" className="sx-ib sm edge" data-tip="Upload" aria-label={`Upload ${f.label}`} onClick={() => onUpload(f)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14" />
                        </svg>
                      </button>
                    ) : (
                      <button type="button" className="sx-ib sm edge" data-tip="Preview" aria-label={`Preview ${f.label}`} onClick={() => onPreview(f, previewable)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {list.length === 0 ? (
                <div className="sx-empty" role="status">
                  <span>None</span>
                  {t !== 0 ? (
                    <button type="button" className="sx-btn sm" onClick={() => setT(0)}>
                      See all
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}
