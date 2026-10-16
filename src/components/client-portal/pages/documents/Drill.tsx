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
import { BotBubble, PagePortal } from './shared-ui';
import { missingLabel, statusClass, STATUS_STYLE, tagStyle, tagText, tagTip, type StatusClass } from './model';

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
  linkText: string;
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
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${target.name} documents`}
            className="dlg"
            style={{ width: 640, maxWidth: '100%', background: 'var(--panel)', borderRadius: 12, boxShadow: '0 24px 60px -20px oklch(15% 0.05 258 / .55)', overflow: 'hidden', fontFamily: 'Manrope,system-ui,sans-serif', color: 'var(--fg)', fontSize: 13 }}
          >
            <div className="dd-top" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 18px', background: 'var(--primary-light)', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--muted)', flex: 'none' }}>
              <span>
                These documents are for {target.name} in {target.where}
              </span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  close();
                  target.onLink();
                }}
                style={{ marginLeft: 'auto', fontWeight: 800, fontSize: 12.5, whiteSpace: 'nowrap' }}
              >
                {target.linkText}
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 56, padding: '0 12px 0 18px', borderBottom: '1px solid var(--border)', flex: 'none' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="var(--folder,#0f2a4a)" />
              </svg>
              <h2 style={{ margin: 0, font: '700 15px Manrope,sans-serif', color: 'var(--navy-ink,var(--navy))', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.title}</h2>
              <span style={{ display: 'flex', gap: 1, width: 80, height: 5, borderRadius: 3, overflow: 'hidden', background: 'var(--hair)', flex: 'none' }}>
                <span style={{ width: `${(ok / tot) * 100}%`, background: 'var(--ok)' }} />
                <span style={{ width: `${(rv / tot) * 100}%`, background: 'var(--prog)' }} />
                <span style={{ width: `${(ms / tot) * 100}%`, background: 'var(--due)' }} />
              </span>
              <span className="mono" style={{ fontSize: 11.5, color: 'var(--subtle)' }}>
                {ok}/{ok + rv + ms}
              </span>
              <button ref={closeRef} type="button" className="ib" data-tip="Close" aria-label="Close" onClick={close}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div style={{ padding: '12px 16px', flex: 'none' }}>
              <div className="seg" role="tablist" aria-label="Status">
                <span className="thumb" style={{ width: 'calc((100% - 4px)/4)', transform: `translateX(${t * 100}%)` }} />
                {TABS.map((x, i) => {
                  const cnt = i === 0 ? files.length : files.filter((f) => statusClass(f.status) === x.cls).length;
                  return (
                    <button key={x.label} type="button" role="tab" aria-selected={t === i} className={t === i ? 'on' : ''} onClick={() => setT(i)}>
                      {x.label}
                      <span className="c">{cnt}</span>
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
                      <span style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
                        <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px dashed var(--due)', boxSizing: 'border-box' }} />
                      </span>
                    ) : (
                      <span className="ft" role="img" aria-label={tagTip(f)} data-tip={tagTip(f)} style={tagStyle(f)}>
                        {tagText(f)}
                      </span>
                    )}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (missing) onUpload(f);
                        else onPreview(f, previewable);
                      }}
                      style={{ flex: 1, minWidth: 0, color: 'var(--fg)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {f.label}
                    </a>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--subtle)' }}>
                      {missing ? missingLabel(f) : dayMonth(f.date)}
                    </span>
                    <span className="badge" style={STATUS_STYLE[f.status]}>
                      {f.status}
                    </span>
                    {missing ? (
                      <button type="button" className="ib" data-tip="Upload" aria-label={`Upload ${f.label}`} onClick={() => onUpload(f)} style={{ color: 'var(--due-text)', borderColor: 'oklch(66% 0.17 48 / .5)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 15V4 M7.5 8.5 12 4l4.5 4.5 M5 19.5h14" />
                        </svg>
                      </button>
                    ) : (
                      <button type="button" className="ib" data-tip="Preview" aria-label={`Preview ${f.label}`} onClick={() => onPreview(f, previewable)}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6Z" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
              {list.length === 0 ? (
                <div style={{ padding: '22px 16px', borderTop: '1px solid var(--hair)' }}>
                  <BotBubble size={40} question={`Why is nothing in ${TABS[t]!.label} for ${target.name} yet?`}>
                    Nothing in this group yet.
                  </BotBubble>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PagePortal>
  );
}
