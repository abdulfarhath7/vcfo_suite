'use client';

/**
 * Pieces both compliance pages share: the law tag and status pill, the company
 * picker, the banners over SBC calendar rows, and the overlays — a filing's
 * card (facts, proofs, window, mark filed, reminder, .ics, portal, Ask VCFO),
 * an SBC calendar line's card, an SBC deadline's card, the window editor, the
 * month picker and the proof-and-details editor (the live FilingProofEditor:
 * same routes, same rules, console markup).
 */
import { useRef, useState, type ReactNode } from 'react';
import type { AreaCode } from '@/lib/client-portal/compliances';
import { AREA_LABEL, portalFor } from '@/lib/client-portal/compliances';
import { preIncorporationCopy } from '@/components/compliances/PreIncorporationNotice';
import { setFilingWindowInDb } from '@/lib/engagements-db';
import { formatWindow, isValidWindowRange } from '@/lib/schedule-windows';
import { financialYearMonths, financialYearLabel } from '@/lib/filings';
import { fmtL } from '@/components/portal/dates';
import { useConsole } from '../../runtime';
import { ModalBody, PopHead } from '../../overlays';
import { Btn, GoArrow, Icon, Select, lawVar } from '../../ui';
import { dShort, plural } from '../today/model';
import {
  C_LABEL,
  C_PILL,
  C_TIP,
  fallbackLine,
  formsIn,
  whenText,
  winShort,
  type Book,
  type BookClient,
  type CRow,
  type CSt,
  type SRow,
} from './model';
import { deleteProof, patchDetails, postFiled, postReminder, useBook, useProofs, useRefreshFilings } from './data';
import '../../css/96-compliance.css';

/* ---------------------------------------------------------------- marks */

export function LawTag({ area, tag, title }: { area: AreaCode | null; tag: string; title?: string }) {
  return (
    <span className="law" style={{ background: area ? lawVar(area) : 'var(--ink-3)' }} title={title ?? (area ? AREA_LABEL[area] : tag)}>
      {tag}
    </span>
  );
}

export function StPill({ st, label }: { st: CSt; label?: string }) {
  return (
    <span className={'pill ' + C_PILL[st]} title={C_TIP[st]}>
      {label ?? C_LABEL[st]}
    </span>
  );
}

export function CompanySelect({ clients, value, onChange }: { clients: BookClient[]; value: string; onChange: (v: string) => void }) {
  return <Select<string> label="Company" value={value} onChange={onChange} options={[['all', 'All companies'], ...clients.map((c): [string, string] => [c.id, c.name])]} />;
}


/** Download a text file the browser builds (CSV / ICS). */
export function downloadText(name: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------------------------------------------------------------- banners */

/**
 * Over the rows: the live pre-incorporation notice for a picked pre-COI client,
 * the live portfolio note ("N engagements begin compliance after
 * incorporation"), and the one-line banner naming the clients whose rows come
 * from SBC's compliance calendar and why.
 */
export function ComplianceBanners({ book, company }: { book: Book; company: string }) {
  const picked = company !== 'all' ? book.byId[company] : undefined;
  if (picked) {
    if (!picked.incorporated)
      return (
        <div className="banner info cf-banner" role="status">
          <Icon name="cal" />
          <div>
            <b>Compliance begins after incorporation</b>
            <span>
              {preIncorporationCopy({ audience: 'staff', companyName: picked.name })}
              {picked.calRows ? ' Until then, its rows come from SBC’s compliance calendar, marked SBC calendar.' : ''}
            </span>
          </div>
        </div>
      );
    if (picked.calRows)
      return (
        <div className="banner info cf-banner" role="status">
          <Icon name="cal" />
          <div>
            <b>SBC calendar until the register starts</b>
            <span>{fallbackLine([picked], book.fyLabel)}</span>
          </div>
        </div>
      );
    return null;
  }
  return (
    <>
      {book.fallback.length ? (
        <div className="banner info cf-banner" role="status" title={book.fallback.map((c) => c.name).join(', ')}>
          <Icon name="cal" />
          <div>
            <b>{`SBC calendar · ${plural(book.fallback.length, 'client')}`}</b>
            <span>{fallbackLine(book.fallback, book.fyLabel)}</span>
          </div>
        </div>
      ) : null}
      {book.pre.length ? (
        <p className="small cf-note">{book.pre.length === 1 ? '1 engagement begins compliance after incorporation.' : `${book.pre.length} engagements begin compliance after incorporation.`}</p>
      ) : null}
    </>
  );
}

/* ---------------------------------------------------------------- filing card */

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div>
      <span>{k}</span>
      <b>{children}</b>
    </div>
  );
}

/** "Remind me" — the caller's own reminder (email, 3 days before the due date). */
export function ReminderBtn({ r, small }: { r: CRow; small?: boolean }) {
  const { toast } = useConsole();
  const refresh = useRefreshFilings();
  const [busy, setBusy] = useState(false);
  if (r.cal || r.filedOn || !r.portal) return null;
  const on = Boolean(r.reminderOn);
  const flip = async () => {
    setBusy(true);
    try {
      const res = await postReminder(r.id, !on);
      refresh();
      toast(on ? 'Reminder turned off' : `Reminder set for ${dShort(res.remindOn ?? r.due, r.due)} · by email`, on ? undefined : () => void postReminder(r.id, false).then(refresh));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the reminder');
    } finally {
      setBusy(false);
    }
  };
  const label = on ? `Reminder set for ${dShort(r.reminderOn!, r.due)} · turn it off` : 'Remind me 3 days before, by email';
  if (small)
    return (
      <button type="button" className={'ib sm' + (on ? ' cf-on' : '')} aria-pressed={on} aria-label={label} title={label} disabled={busy} onClick={() => void flip()}>
        <Icon name="bell" />
      </button>
    );
  return (
    <Btn cls="sm" ico="bell" disabled={busy} title={label} onClick={() => void flip()}>
      {on ? `Reminder ${dShort(r.reminderOn!, r.due)}` : 'Remind me'}
    </Btn>
  );
}

/** Mark filed (today) with an Undo toast — managers, admins, super admins. */
export function useMarkFiled() {
  const { toast } = useConsole();
  const refresh = useRefreshFilings();
  return async (r: CRow, filedOn: string | null) => {
    const prev = r.filedOn ?? null;
    try {
      await postFiled(r.id, filedOn);
      refresh();
      toast(filedOn ? `${r.name} · ${r.clientName} marked filed ${dShort(filedOn, filedOn)}` : `${r.name} · ${r.clientName} marked not filed`, () =>
        void postFiled(r.id, prev).then(refresh, (e: unknown) => toast(e instanceof Error ? e.message : 'Could not undo')),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the filed date');
    }
  };
}

/** A register filing's card (opens from every row, chip, cell and count). Reads live data by id. */
export function FilingPop({ id, fy }: { id: string; fy: number }) {
  const { book, mayWrite } = useBook(fy);
  const { go, base, openChat, closePop, openModal, openPop } = useConsole();
  const r = book.rows.find((x) => x.id === id);
  const markFiled = useMarkFiled();
  const today = book.today;
  const [on, setOn] = useState(today);
  const proofs = useProofs(id, Boolean(r && !r.cal));
  if (!r) return <PopHead title="This filing is not in view" sub="Change the Stage filter or the financial year to see it." />;
  if (r.cal) return <LinePop r={r} />;
  const c = book.byId[r.clientId];
  const [portal, url] = portalFor({ area: r.area, name: r.name });
  const p = r.portal;
  return (
    <div className="cf-pop">
      <PopHead title={[r.name, r.period].filter(Boolean).join(' · ')} sub={`${r.clientName} · ${AREA_LABEL[r.area]}`} lead={<LawTag area={r.area} tag={r.area} />} />
      <div className="mx-chips cf-pchips">
        <StPill st={r.st} />
        <span className="small">{whenText(r, today)}</span>
      </div>
      <div className="mx-facts">
        <Fact k="Due">{fmtL(r.due)}</Fact>
        <Fact k="Frequency">{r.freqLabel}</Fact>
        <Fact k="Authority">{r.authorityName}</Fact>
        <Fact k="Window">
          {mayWrite ? (
            <button type="button" className="link" onClick={(e) => openPop(e.currentTarget, <WindowPop id={r.id} fy={fy} />, { push: true })}>
              {r.window ? winShort(r.window, today) : 'Set window'}
            </button>
          ) : r.window ? (
            winShort(r.window, today)
          ) : (
            'None set'
          )}
        </Fact>
        {r.filedOn ? <Fact k="Filed">{`${dShort(r.filedOn, today)}${p?.filedByName ? ` · ${p.filedByName}` : ''}`}</Fact> : null}
        {p?.acknowledgementNo ? <Fact k="ARN">{p.acknowledgementNo}</Fact> : null}
        {p?.amountPaid ? <Fact k="Tax paid">{`₹${p.amountPaid}`}</Fact> : null}
        {p?.ownerName ? <Fact k="With">{p.ownerName}</Fact> : null}
        {p?.dataReceivedOn ? <Fact k="Data received">{dShort(p.dataReceivedOn, today)}</Fact> : null}
        {p?.approvedOn ? <Fact k="Approved">{dShort(p.approvedOn, today)}</Fact> : null}
      </div>
      <div className="mx-ds2 cf-proofs">
        <span className="eyebrow">{proofs.data ? `Proofs · ${proofs.data.length}` : 'Proofs'}</span>
        {proofs.isLoading ? (
          <span className="small">Loading the proofs…</span>
        ) : proofs.isError ? (
          <span className="small">The proofs could not load.</span>
        ) : proofs.data?.length ? (
          proofs.data.map((f) => (
            <a key={f.id} className="mx-drow" href={`/api/client/compliances/${encodeURIComponent(r.id)}/proofs/${encodeURIComponent(f.id)}`} target="_blank" rel="noopener noreferrer">
              <Icon name="doc" size={16} />
              <span className="mx-dt">
                <b className="cf-ell" title={f.fileName}>
                  {f.fileName}
                </b>
                <span>{`${f.kind[0]!.toUpperCase()}${f.kind.slice(1)}${f.uploadedBy ? ` · ${f.uploadedBy}` : ''}`}</span>
              </span>
              <Icon name="ext" size={16} />
            </a>
          ))
        ) : (
          <span className="small">{r.filedOn ? 'Proof pending. The client sees “Proof pending” until one is uploaded.' : 'No proof yet.'}</span>
        )}
      </div>
      {mayWrite ? (
        <div className="mx-apa cf-acts">
          {r.filedOn ? (
            <Btn cls="sm" ico="x" onClick={() => void markFiled(r, null)}>
              Mark not filed
            </Btn>
          ) : (
            <>
              <input className="mx-in cf-date" type="date" value={on} max={today} aria-label="Filed on" onChange={(e) => setOn(e.target.value)} />
              <Btn cls="sm pri" ico="check" disabled={!on || on > today} onClick={() => void markFiled(r, on)}>
                Mark filed
              </Btn>
            </>
          )}
          <Btn
            cls="sm"
            ico="up"
            onClick={() => {
              closePop();
              openModal(<ProofEditor id={r.id} fy={fy} />, { label: 'Proof and details' });
            }}
          >
            Proof and details
          </Btn>
        </div>
      ) : null}
      <div className="pop-foot">
        <ReminderBtn r={r} />
        <a className="btn sm" href={`/api/client/compliances/${encodeURIComponent(r.id)}/ics`} title="Download an .ics file for your calendar app">
          <Icon name="cal" />
          .ics
        </a>
        <Btn
          cls="sm"
          ico="chat"
          onClick={() => {
            closePop();
            openChat(`${r.name}${r.period ? ` for ${r.period}` : ''} · ${r.clientName}: what is it, and what should we check before filing?`);
          }}
        >
          Ask
        </Btn>
        <span className="sp" />
        {c?.e ? (
          <button
            type="button"
            className="link"
            onClick={() => {
              closePop();
              go(`${base}/projects/${c.e!.slug ?? c.e!.id}`);
            }}
          >
            Client
          </button>
        ) : null}
        <GoArrow label={portal} href={url} />
      </div>
    </div>
  );
}

/** A line from SBC's calendar for a client with no register rows (the client portal's card). */
export function LinePop({ r }: { r: CRow }) {
  const { openChat, closePop } = useConsole();
  const [, url] = portalFor({ area: r.area, name: r.name });
  return (
    <div className="cf-pop">
      <PopHead title={r.name} sub={`${r.clientName} · ${[r.period, r.authorityName].filter(Boolean).join(' · ')}`} lead={<LawTag area={r.area} tag={r.area} />} />
      <div className="mx-chips cf-pchips">
        <StPill st="c" />
      </div>
      {r.particular !== r.name ? <p className="small">On this line of the calendar: {r.particular}</p> : null}
      <div className="mx-facts">
        <Fact k="Due">{fmtL(r.due)}</Fact>
        <Fact k="How often">{r.freqLabel}</Fact>
      </div>
      <p className="small">{`From SBC’s compliance calendar. ${r.clientName} has no filings on its register yet; this deadline applies once SBC adds it to the register. No proof, reminder or window until then.`}</p>
      <div className="pop-foot">
        <Btn
          cls="sm"
          ico="chat"
          onClick={() => {
            closePop();
            openChat(`What is ${r.name}, and when will it apply to ${r.clientName}?`);
          }}
        >
          Ask
        </Btn>
        <span className="sp" />
        <GoArrow label="Portal" href={url} />
      </div>
    </div>
  );
}

/** One deadline of SBC's master calendar (branch layout studio's note: due, due in, deadline, act, form). */
export function SbcPop({ s, names }: { s: SRow; names: string[] }) {
  const { openChat, closePop } = useConsole();
  const forms = formsIn(s.title);
  const dueIn = s.days < 0 ? `Overdue by ${plural(-s.days, 'day')}` : s.days === 0 ? 'Due today' : `Due in ${plural(s.days, 'day')}`;
  return (
    <div className="cf-pop">
      <PopHead title={s.name} sub={s.actFull} lead={<LawTag area={s.area} tag={s.tag} title={s.actFull} />} />
      <div className="mx-chips cf-pchips">
        <StPill st={s.st} />
        <span className="small">{dueIn}</span>
      </div>
      <div className="mx-facts">
        <Fact k="Due">{fmtL(s.due)}</Fact>
        <Fact k="Return period">{s.period ?? '—'}</Fact>
        {forms ? <Fact k="Form">{forms}</Fact> : null}
        <Fact k="Applies to">{names.length ? names.join(', ') : 'No client in view'}</Fact>
      </div>
      <p className="small">SBC’s statutory calendar has no filed state: the register says what was filed for each client.</p>
      <div className="pop-foot">
        <Btn
          cls="sm"
          ico="chat"
          onClick={() => {
            closePop();
            openChat(`What is ${s.title} (${s.actFull}), due ${fmtL(s.due)}, and which of my clients does it apply to?`);
          }}
        >
          Ask
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- window editor (live ScheduleWindowControl) */

export function WindowPop({ id, fy }: { id: string; fy: number }) {
  const { book } = useBook(fy);
  const { closePop, toast } = useConsole();
  const refresh = useRefreshFilings();
  const r = book.rows.find((x) => x.id === id);
  const [from, setFrom] = useState(r?.window?.from ?? '');
  const [to, setTo] = useState(r?.window?.to ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!r) return null;
  const valid = isValidWindowRange(from, to);
  const commit = async (next: { from: string; to: string } | null) => {
    setBusy(true);
    setErr('');
    try {
      await setFilingWindowInDb(r.id, next);
      refresh();
      closePop();
      toast(next ? `${r.name} window saved · ${formatWindow(next)}` : `${r.name} window cleared`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save the window. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <PopHead title={`${r.name} window`} sub={r.window ? `Now ${formatWindow(r.window)} · due ${dShort(r.due, book.today)}` : `No window set yet · due ${dShort(r.due, book.today)}`} />
      <div className="mx-form2">
        <label className="mx-f">
          <span className="mx-fl">From</span>
          <input className="mx-in" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">To</span>
          <input className="mx-in" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      {from && to && !valid ? <p className="small red">The end date must not be before the start.</p> : null}
      {err ? <p className="small red">{err}</p> : null}
      <div className="pop-foot">
        {r.window ? (
          <Btn cls="sm" ico="x" disabled={busy} onClick={() => void commit(null)}>
            Clear
          </Btn>
        ) : null}
        <span className="sp" />
        <Btn cls="sm" disabled={busy} onClick={closePop}>
          Cancel
        </Btn>
        <Btn cls="sm pri" ico="check" disabled={busy || !valid} onClick={() => void commit({ from, to })}>
          {busy ? 'Saving…' : 'Save'}
        </Btn>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- month picker (prototype mxMonthPick, by financial year) */

export function MonthPick({ value, onPick }: { value: string; onPick: (key: string) => void }) {
  const { closePop } = useConsole();
  const start = Number(value.slice(5, 7)) >= 4 ? Number(value.slice(0, 4)) : Number(value.slice(0, 4)) - 1;
  const [fy, setFy] = useState(start);
  return (
    <div>
      <PopHead title="Pick a month" sub={financialYearLabel(fy)} />
      <div className="co-row cf-fyrow">
        <button type="button" className="ib sm" aria-label="Previous financial year" onClick={() => setFy(fy - 1)}>
          <Icon name="back" />
        </button>
        <b>{financialYearLabel(fy)}</b>
        <button type="button" className="ib sm" aria-label="Next financial year" onClick={() => setFy(fy + 1)}>
          <Icon name="chev" />
        </button>
      </div>
      <div className="mx-mpick">
        {financialYearMonths(fy).map((m) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={m.key === value}
            title={m.label}
            onClick={() => {
              closePop();
              onPick(m.key);
            }}
          >
            {m.shortLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- proof and details (live FilingProofEditor) */

const DATE_FIELDS: Array<[string, string]> = [
  ['dataReceivedOn', 'Data received'],
  ['preparingSince', 'Preparing since'],
  ['draftDueOn', 'Draft due'],
  ['approvalDueOn', 'Approval due'],
  ['approvedOn', 'Approved on'],
];
const FIELDS = ['acknowledgementNo', 'amountPaid', ...DATE_FIELDS.map(([k]) => k)];

export function ProofEditor({ id, fy }: { id: string; fy: number }) {
  const { book } = useBook(fy);
  const { closeModal, toast } = useConsole();
  const refresh = useRefreshFilings();
  const r = book.rows.find((x) => x.id === id);
  const proofs = useProofs(id);
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState('acknowledgement');
  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const base = `/api/client/compliances/${encodeURIComponent(id)}`;
  const p = r?.portal as unknown as Record<string, string | null> | undefined;
  const d: Record<string, string> = draft ?? Object.fromEntries(FIELDS.map((k) => [k, (p?.[k] as string | null) ?? '']));
  const set = (k: string, v: string) => setDraft({ ...d, [k]: v });
  const upload = async (file: File) => {
    setBusy(true);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('kind', kind);
      const res = await fetch(`${base}/proofs`, { method: 'POST', body: form });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Upload failed');
      toast('Proof uploaded');
      void proofs.refetch();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (proofId: string) => {
    try {
      await deleteProof(id, proofId);
      void proofs.refetch();
      refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not remove the proof');
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      const patch: Record<string, string | null> = {};
      for (const k of FIELDS) patch[k] = d[k]?.trim() ? d[k]!.trim() : null;
      await patchDetails(id, patch);
      toast('Filing details saved');
      refresh();
      closeModal();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the details');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title={`${r?.name ?? 'Filing'} · proof and details`}
      sub={r ? `${r.clientName} · due ${fmtL(r.due)}` : undefined}
      foot={
        <>
          <Btn onClick={closeModal}>Close</Btn>
          <Btn cls="pri" ico="check" disabled={busy || !draft} onClick={() => void save()}>
            Save details
          </Btn>
        </>
      }
    >
      <section className="mx-ds2 cf-proofs">
        <span className="eyebrow">Proofs · the client sees them</span>
        {proofs.data?.length ? (
          proofs.data.map((f) => (
            <div key={f.id} className="mx-drow">
              <Icon name="doc" size={16} />
              <span className="mx-dt">
                <b className="cf-ell" title={f.fileName}>
                  {f.fileName}
                </b>
                <span>{f.kind}</span>
              </span>
              <a className="link" href={`${base}/proofs/${encodeURIComponent(f.id)}`} target="_blank" rel="noopener noreferrer">
                View
              </a>
              {!f.legacy ? (
                <Btn cls="sm" onClick={() => void remove(f.id)}>
                  Remove
                </Btn>
              ) : null}
            </div>
          ))
        ) : (
          <span className="small">{proofs.isLoading ? 'Loading the proofs…' : 'No proof yet. The client sees “Proof pending” once it is filed.'}</span>
        )}
        <div className="co-row">
          <Select<string>
            label="Kind of proof"
            value={kind}
            onChange={setKind}
            options={[
              ['acknowledgement', 'Acknowledgement'],
              ['challan', 'Challan'],
              ['certificate', 'Certificate'],
              ['other', 'Other'],
            ]}
          />
          <input
            ref={fileRef}
            type="file"
            hidden
            aria-label="Proof file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
              e.target.value = '';
            }}
          />
          <Btn cls="sm" ico="up" disabled={busy} onClick={() => fileRef.current?.click()}>
            Upload proof
          </Btn>
        </div>
      </section>
      <div className="mx-form2">
        <label className="mx-f">
          <span className="mx-fl">ARN / acknowledgement no.</span>
          <input className="mx-in" value={d.acknowledgementNo ?? ''} onChange={(e) => set('acknowledgementNo', e.target.value)} />
        </label>
        <label className="mx-f">
          <span className="mx-fl">Tax paid (₹)</span>
          <input className="mx-in" inputMode="decimal" value={d.amountPaid ?? ''} onChange={(e) => set('amountPaid', e.target.value)} />
        </label>
        {DATE_FIELDS.map(([k, l]) => (
          <label key={k} className="mx-f">
            <span className="mx-fl">{l}</span>
            <input className="mx-in" type="date" value={d[k] ?? ''} onChange={(e) => set(k, e.target.value)} />
          </label>
        ))}
      </div>
    </ModalBody>
  );
}
