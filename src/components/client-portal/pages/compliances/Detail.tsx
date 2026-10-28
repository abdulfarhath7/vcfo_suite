'use client';

/**
 * Filing detail — Calendar: centred pop-up (P-02, prototype detailModal());
 * Filings: right side panel (F-10, prototype filDetail()). Phones: bottom sheet.
 */
import { useRef } from 'react';
import { usePortal } from '../../PortalProvider';
import {
  MON,
  MONTHS,
  D,
  daysBetween,
  dow,
  fmtDM,
  fmtDMY,
  focusNodes,
  plural,
  statusOf,
  tileInk,
  tileVar,
  type PortalFiling,
} from '@/lib/client-portal/compliances';
import { Chip as SChip, type ChipTone } from '@/components/ui/spectrum-chip';
import { FileBadge } from '@/components/ui/file-badge';
import { proofHref, useProofs } from './api';
import { AreaChip, Chip, FocusTrack, I, PortalBtn, ProofChip, useModal } from './bits';
import { useComp } from './ctx';

/** "Sep 2026" → "September 2026"; other period shapes unchanged. */
function longPeriod(p: string): string {
  const m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(p);
  if (!m) return p;
  const i = MON.indexOf(m[1]!);
  return i >= 0 ? `${MONTHS[i]} ${m[2]}` : p;
}

/** A soft Spectrum tag inside the legacy dialog markup. */
function Tone({ tone, children }: { tone: ChipTone; children: string }) {
  return (
    <span className="cp-tw inline-flex align-middle">
      <SChip tone={tone} dot={false} className="min-w-0">
        {children}
      </SChip>
    </span>
  );
}

export function TimingChip({ f, today }: { f: PortalFiling; today: string }) {
  if (f.filedOn) {
    const early = daysBetween(f.filedOn, f.dueDate);
    if (early > 0) return <Tone tone="ok">{`${plural(early, 'day')} early`}</Tone>;
    if (early === 0) return <Tone tone="ok">On the due date</Tone>;
    return <Tone tone="bad">{`${plural(-early, 'day')} late`}</Tone>;
  }
  const left = daysBetween(today, f.dueDate);
  if (left < 0) return <Tone tone="bad">{`${plural(-left, 'day')} late`}</Tone>;
  return <Tone tone="prog">{left === 0 ? 'Due today' : `${plural(left, 'day')} left`}</Tone>;
}

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '9px 12px', borderRadius: 6, background: 'var(--raised)' }}>
      <div style={{ font: '500 12px var(--font-sans),sans-serif', color: 'var(--muted)' }}>{k}</div>
      <div style={{ fontWeight: 500, fontSize: 14, marginTop: 3 }}>{children}</div>
    </div>
  );
}

export function RiskChip({ r }: { r: string }) {
  const t = r.toLowerCase();
  const tone: ChipTone = t === 'high' ? 'bad' : t === 'medium' ? 'warn' : 'ok';
  return <Tone tone={tone}>{t ? t[0]!.toUpperCase() + t.slice(1) : '—'}</Tone>;
}

function inr(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return v;
  return `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/* ---------------------------------------------------- calendar pop-up */

export function DetailModal({ f, onClose, onOpenFilings }: { f: PortalFiling; onClose: () => void; onOpenFilings: (f: PortalFiling) => void }) {
  const { today, companyShort, openProof, addToCalendar } = useComp();
  const { openChat } = usePortal();
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, onClose);
  const s = statusOf(f, today);
  const d = D(f.dueDate);
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Esc closes (useModal) */}
      <div className="scrim" onClick={onClose} />
      <div className="modal cdet" role="dialog" aria-modal="true" aria-labelledby="comp-det-t" ref={ref}>
        <span className="sheet-grab" aria-hidden="true" />
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div className="dtile" style={{ background: tileVar(s), color: tileInk(s), width: 56, height: 62 }}>
            <b style={{ fontSize: 24 }}>{d.getUTCDate()}</b>
            {/* month and weekday on their own lines: "OCT · SAT" does not fit the 56 px tile (CP-12) */}
            <small>{MON[d.getUTCMonth()]}</small>
            <small style={{ fontSize: 9.5, marginTop: 0, opacity: 0.75 }}>{dow(f.dueDate)}</small>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <AreaChip a={f.area} />
              <Chip s={s} />
              <ProofChip f={f} onOpen={(x) => openProof(x)} />
              <TimingChip f={f} today={today} />
            </div>
            <div id="comp-det-t" style={{ font: "500 22px var(--font-sans)", letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {f.name} · {longPeriod(f.period)} <PortalBtn f={f} />
            </div>
          </div>
          <button type="button" className="ibtn" aria-label="Close" onClick={onClose}>
            {I.x(15)}
          </button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ overflowX: 'auto' }}>
            <FocusTrack nodes={focusNodes(f, companyShort, today)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
            <Fact k="Authority">{f.authorityName}</Fact>
            <Fact k="Frequency">{f.freqLabel}</Fact>
            <Fact k="Period">{f.periodLong ?? f.period}</Fact>
            <Fact k="Penalty risk">
              <RiskChip r={f.penaltyRisk} />
            </Fact>
          </div>
          {f.draftDueOn && !f.approvedOn && !f.filedOn ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 6, background: 'oklch(var(--waiting-soft))', color: 'oklch(var(--waiting))', fontWeight: 500, fontSize: 13 }}>
              {I.user(16)}
              <span style={{ flex: 1 }}>
                SBC will send the draft for {companyShort}’s approval by {fmtDM(f.draftDueOn)}.
              </span>
            </div>
          ) : null}
        </div>
        <div className="det-ft" style={{ padding: '12px 20px', borderTop: '1px solid var(--hair)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ask"
            style={{ border: 0, margin: 0, padding: 0, flex: 1, background: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', }}
            onClick={() => {
              onClose();
              openChat(`Tell me about ${f.name} · ${f.period}`);
            }}
          >
            Ask VCFO about {f.name}
          </button>
          {!f.filedOn ? (
            <button type="button" className="btn btn-o btn-s" onClick={() => addToCalendar(f)}>
              {I.cal(14)} Add to my calendar
            </button>
          ) : null}
          <button type="button" className="btn btn-n btn-s" onClick={() => onOpenFilings(f)}>
            Open in filings {I.arrow(13)}
          </button>
        </div>
      </div>
    </>
  );
}

/* ----------------------------------------------------- filings panel */

function kb(n: number | null): string {
  if (n == null) return '';
  return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function ext(name: string, mime: string | null): string {
  const e = /\.([a-z0-9]{2,4})$/i.exec(name)?.[1]?.toUpperCase();
  if (e) return e;
  if (mime?.includes('pdf')) return 'PDF';
  if (mime?.startsWith('image/')) return 'IMG';
  return 'FILE';
}

export function SidePanel({ f, onClose }: { f: PortalFiling; onClose: () => void }) {
  const { today, companyShort, openProof, remind, addToCalendar } = useComp();
  const { openChat } = usePortal();
  const ref = useRef<HTMLDivElement>(null);
  useModal(ref, onClose);
  const s = statusOf(f, today);
  const d = D(f.dueDate);
  const proofs = useProofs(f.filedOn ? f.id : null);
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Esc closes (useModal) */}
      <div className="scrim" onClick={onClose} />
      <div className="modal fpan" role="dialog" aria-modal="true" aria-labelledby="comp-pan-t" ref={ref}>
        <span className="sheet-grab" aria-hidden="true" />
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--hair)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div className="dtile" style={{ background: tileVar(s), color: tileInk(s), width: 56, height: 62 }}>
            <b style={{ fontSize: 24 }}>{d.getUTCDate()}</b>
            <small>{MON[d.getUTCMonth()]}</small>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
              <AreaChip a={f.area} />
              <Chip s={s} />
              <ProofChip f={f} onOpen={(x) => openProof(x)} />
              <TimingChip f={f} today={today} />
            </div>
            <div id="comp-pan-t" style={{ font: "500 21px var(--font-sans)", letterSpacing: '-.02em', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {f.name} · {longPeriod(f.period)} <PortalBtn f={f} />
            </div>
          </div>
          <button type="button" className="ibtn" aria-label="Close" onClick={onClose}>
            {I.x(15)}
          </button>
        </div>
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18, flex: 1, overflow: 'auto' }}>
          <div style={{ overflowX: 'auto' }}>
            <FocusTrack nodes={focusNodes(f, companyShort, today)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {f.acknowledgementNo ? (
              <Fact k="ARN">
                <span className="idm">{f.acknowledgementNo}</span>
              </Fact>
            ) : null}
            {f.amountPaid ? (
              <Fact k="Tax paid">
                <span className="metric" style={{ fontSize: 16 }}>
                  {inr(f.amountPaid)}
                </span>
              </Fact>
            ) : null}
            <Fact k="Due date">{fmtDMY(f.dueDate)}</Fact>
            {f.filedOn ? (
              <Fact k="Filed by">{f.filedByName ? `${f.filedByName} · SBC` : `SBC · ${fmtDMY(f.filedOn)}`}</Fact>
            ) : (
              <>
                <Fact k="Authority">{f.authorityName}</Fact>
                <Fact k="Frequency">{f.freqLabel}</Fact>
                <Fact k="Penalty risk">
                  <RiskChip r={f.penaltyRisk} />
                </Fact>
              </>
            )}
          </div>
          {f.filedOn ? (
            <div>
              <p className="st" style={{ marginBottom: 8 }}>
                Proof
              </p>
              {proofs.isLoading ? (
                <div className="sk-row" style={{ height: 62, borderRadius: 8 }} />
              ) : proofs.data && proofs.data.length ? (
                proofs.data.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      border: `1.5px solid ${i === 0 ? 'oklch(var(--brand-line))' : 'var(--border)'}`,
                      borderRadius: 6,
                      marginBottom: 6,
                      ...(i === 0 ? { background: 'var(--primary-light)' } : {}),
                    }}
                  >
                    <span className="cp-tw inline-flex flex-none">
                      <FileBadge name={p.fileName} type={ext(p.fileName, p.mime) === 'PDF' ? 'PDF' : undefined} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b style={{ fontSize: 13, fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.fileName}</b>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{[kb(p.sizeBytes), fmtDM(p.uploadedAt.slice(0, 10))].filter(Boolean).join(' · ')}</div>
                    </div>
                    <button type="button" className="ibtn" data-tip="Preview" aria-label={`Preview ${p.fileName}`} onClick={() => openProof(f, p.id)}>
                      {I.eye(15)}
                    </button>
                    <a className="ibtn" data-tip="Download" aria-label={`Download ${p.fileName}`} href={proofHref(f.id, p.id)} download>
                      {I.down(15)}
                    </a>
                  </div>
                ))
              ) : (
                // the header already carries the "Proof pending" chip (CP-15): say what will land here instead
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, border: '1.5px dashed oklch(var(--line-strong))', borderRadius: 6, color: 'var(--muted)', fontSize: 13 }}>
                  {I.file(16)}
                  <span style={{ flex: 1 }}>Challan or acknowledgement from SBC</span>
                </div>
              )}
            </div>
          ) : null}
        </div>
        <div className="det-ft" style={{ padding: '12px 20px', borderTop: '1px solid var(--hair)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="ask"
            style={{ border: 0, margin: 0, padding: 0, flex: 1, background: 'none', font: 'inherit', cursor: 'pointer', textAlign: 'left', }}
            onClick={() => {
              onClose();
              openChat(`Tell me about ${f.name} · ${f.period}`);
            }}
          >
            Ask VCFO about this filing
          </button>
          {!f.filedOn ? (
            <>
              <button type="button" className="btn btn-o btn-s" onClick={() => addToCalendar(f)}>
                {I.cal(14)} Add to my calendar
              </button>
              <button type="button" className="btn btn-o btn-s" onClick={() => remind(f)} aria-pressed={Boolean(f.reminderOn)}>
                {I.bell(14)} {f.reminderOn ? `Reminder ${fmtDM(f.reminderOn)}` : 'Remind me'}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
}
