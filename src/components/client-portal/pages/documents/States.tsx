'use client';

/**
 * Documents page states: loading skeleton (s/docs/docs_a_loading.dc.html),
 * empty explorer (s/docs/docs_a_empty.dc.html) and the load error card.
 * The boards' H1 "Documents" is dropped (the refined page has none; the
 * title lives in the top-bar trail).
 */
import type { CSSProperties } from 'react';
import { BotBubble } from './shared-ui';

const CARD: CSSProperties = { flex: 1, minHeight: 0, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column' };

function Sk({ w, h, r, style }: { w: number | string; h: number; r?: number; style?: CSSProperties }) {
  return <span className="sk" style={{ width: w, height: h, borderRadius: r, flex: 'none', ...style }} />;
}

export function DocsLoading({ phone }: { phone?: boolean }) {
  if (phone) {
    return (
      <div className="vds-root" aria-busy="true" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Sk w="100%" h={44} r={6} />
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10 }}>
          {[200, 170, 220, 150, 190].map((w) => (
            <div key={w} className="r" style={{ height: 56 }}>
              <Sk w={20} h={20} r={6} />
              <Sk w={w} h={10} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const tree: Array<[number, number, boolean?]> = [
    [0, 210],
    [36, 170, true],
    [60, 190],
    [60, 150],
    [0, 190],
    [36, 140, true],
    [60, 200],
    [60, 160],
    [60, 180],
    [36, 180, true],
    [0, 220],
  ];
  return (
    <section className="vds-root" aria-label="Loading documents" aria-busy="true" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 12px', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', overflow: 'hidden' }}>
        <Sk w={300} h={32} r={6} style={{ maxWidth: '100%', flexShrink: 1 }} />
        <Sk w={84} h={32} r={6} />
        <Sk w={96} h={32} r={6} />
        <Sk w={220} h={32} r={8} />
        <span style={{ flex: 1 }} />
        <Sk w={170} h={32} r={6} />
      </div>
      <div className="vds-body" style={{ flex: 1, display: 'flex' }}>
        <div className="vds-tree" style={{ width: 420, borderRight: '1px solid var(--border)', padding: '6px 0' }}>
          {tree.map(([pad, w, bar], i) => (
            <div key={i} className="r" style={{ paddingLeft: pad || 12 }}>
              {pad === 60 ? <Sk w={22} h={16} r={3} /> : <Sk w={16} h={16} />}
              <Sk w={w} h={10} />
              {bar ? (
                <>
                  <span style={{ flex: 1 }} />
                  <Sk w={56} h={4} />
                </>
              ) : null}
            </div>
          ))}
        </div>
        <div className="vds-pane vds-hide-md" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 16px', borderBottom: '1px solid var(--border)' }}>
            <Sk w={26} h={20} />
            <Sk w={240} h={12} />
            <span style={{ flex: 1 }} />
            <Sk w={32} h={32} r={6} />
            <Sk w={32} h={32} r={6} />
          </div>
          <div style={{ flex: 1, background: 'var(--raised)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sk w={340} h={440} r={2} style={{ maxHeight: '90%' }} />
          </div>
          <div style={{ height: 36, borderTop: '1px solid var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <Sk w={60} h={10} />
            <Sk w={180} h={10} />
          </div>
          <div style={{ height: 36, borderTop: '1px solid var(--hair)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
            <Sk w={50} h={10} />
            <Sk w={120} h={10} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function DocsEmpty({ company, phases, canUpload, onUpload, onOpenInc }: { company: string; phases: string[]; canUpload: boolean; onUpload: () => void; onOpenInc: () => void }) {
  return (
    <section className="vds-root" aria-label="Document explorer" style={CARD}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 12px', borderBottom: '1px solid var(--border)', opacity: 0.5 }} aria-hidden="true">
        <span style={{ width: 300, maxWidth: '100%', height: 32, borderRadius: 6, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 10px', boxSizing: 'border-box', color: 'var(--subtle)' }}>
          Filter documents
          <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, fontFamily: '"IBM Plex Mono",monospace' }}>
            0/0
          </span>
        </span>
      </div>
      <div className="vds-body" style={{ flex: 1, display: 'flex' }}>
        <div className="vds-tree" style={{ width: 420, borderRight: '1px solid var(--border)', padding: '6px 0' }}>
          {phases.map((p) => (
            <div key={p} className="re">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 6l6 6-6 6" />
              </svg>
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3 18.5V5.5A1.5 1.5 0 0 1 4.5 4h4.2l2 2.4h8.8A1.5 1.5 0 0 1 21 7.9v10.6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5Z" fill="var(--folder,#0f2a4a)" fillOpacity=".3" />
              </svg>
              <span style={{ flex: 1 }}>{p}</span>
              <span style={{ fontSize: 11, fontFamily: '"IBM Plex Mono",monospace' }}>0</span>
            </div>
          ))}
        </div>
        <div className="vds-pane" style={{ flex: 1, background: 'var(--raised)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', padding: 16 }}>
          <BotBubble size={56} question="When will my documents appear here?">
            No documents yet. {company}’s files will appear here as each step is done.
          </BotBubble>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {canUpload ? (
              <button type="button" className="btn btn-n" onClick={onUpload}>
                Upload a document
              </button>
            ) : null}
            <button type="button" className="btn btn-o" onClick={onOpenInc}>
              Open incorporation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DocsError({ onRetry }: { onRetry: () => void }) {
  return (
    <section style={CARD}>
      <div className="vdoc-err" role="alert">
        <span style={{ width: 28, height: 28, borderRadius: 99, background: 'var(--over-chip)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>!</span>
        <span style={{ flex: 1 }}>Could not load documents</span>
        <button type="button" className="btn btn-o" onClick={onRetry}>
          Retry
        </button>
      </div>
    </section>
  );
}
