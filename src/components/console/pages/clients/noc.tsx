'use client';

/**
 * Registered-office NOC in the console (owner's request; prototype a59x
 * npPaper / npDrawer / npStrip / the wizard's office and owner steps).
 *
 * Data: GET/POST /api/engagements/:id/registered-office-noc (+ /sent, /signed,
 * /file), GET /api/registered-office-nocs. The certificate text comes from
 * src/lib/registered-office-noc/model.ts — the same model the server's Word
 * file and the print view use. "Ask the client to upload the signed copy"
 * uses the live file-request API on the Registered Office Address step, so the
 * client's upload lands in that step's "No-objection certificate" field.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import type { Engagement } from '@/data/engagements';
import type { RegisteredOfficeNocDto } from '@/db/repositories/registered-office-noc';
import {
  blankNocInput,
  checkNoc,
  NOC_BILLS,
  NOC_HOLDINGS,
  NOC_RELATIONS,
  NOC_STATES,
  NOC_STEP_FIELDS,
  NOC_TITLES,
  nocAddress,
  nocMissingCount,
  nocModel,
  nocPrintHtml,
  ROC_CITY,
  type NocField,
  type NocInput,
  type NocRun,
} from '@/lib/registered-office-noc/model';
import { validateMilestoneUploadFile } from '@/lib/milestone-document-storage';
import { useConsole } from '../../runtime';
import { DrawerHead, ModalBody } from '../../overlays';
import { Btn, Icon, Panel, Seg } from '../../ui';
import { dShort, stamp, useToday, useClientPaths } from './shared';

export type NocDto = RegisteredOfficeNocDto;

export const NOC_STATUS: Record<NocDto['status'], { label: string; pill: 'up' | 'due' | 'done' }> = {
  generated: { label: 'NOC generated', pill: 'up' },
  sent: { label: 'Sent to the owner', pill: 'due' },
  signed: { label: 'Signed NOC received', pill: 'done' },
};

const nocUrl = (engagementId: string, tail = '') => `/api/engagements/${encodeURIComponent(engagementId)}/registered-office-noc${tail}`;

/* ---------------------------------------------------------------- data */

export function useNoc(engagementId?: string) {
  return useQuery({
    queryKey: ['registered-office-noc', engagementId ?? ''],
    enabled: Boolean(engagementId),
    queryFn: async () => {
      const res = await fetch(nocUrl(engagementId!));
      const body = (await res.json().catch(() => ({}))) as { noc?: NocDto | null; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not load the NOC');
      return body.noc ?? null;
    },
    staleTime: 15_000,
  });
}

export function useNocList() {
  return useQuery({
    queryKey: ['registered-office-nocs'],
    queryFn: async () => {
      const res = await fetch('/api/registered-office-nocs');
      const body = (await res.json().catch(() => ({}))) as { nocs?: NocDto[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? 'Could not load the NOCs');
      return body.nocs ?? [];
    },
    staleTime: 15_000,
  });
}

/** POST the NOC; resolves with the saved record or throws with the server's words (and `fields`). */
export async function generateNoc(engagementId: string, input: NocInput): Promise<NocDto> {
  const res = await fetch(nocUrl(engagementId), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ input }) });
  const body = (await res.json().catch(() => ({}))) as { noc?: NocDto; error?: string };
  if (!res.ok || !body.noc) throw new Error(body.error ?? 'Could not generate the NOC');
  return body.noc;
}

/** Who may change a NOC: a manager or an admin (src/db/repositories/registered-office-noc.ts); a project lead only reads. */
function useNocWriter(): boolean {
  const { seat } = useConsole();
  const { user } = useApp();
  return seat !== 'lead' && (user?.role === 'manager' || user?.role === 'admin' || user?.role === 'super_admin');
}

function useNocRefresh(engagementId: string) {
  const qc = useQueryClient();
  return (noc?: NocDto) => {
    if (noc) qc.setQueryData(['registered-office-noc', engagementId], noc);
    void qc.invalidateQueries({ queryKey: ['registered-office-noc', engagementId] });
    void qc.invalidateQueries({ queryKey: ['registered-office-nocs'] });
  };
}

/* ---------------------------------------------------------------- the paper (live preview) */

function Run({ r }: { r: NocRun }) {
  return r.miss ? <mark className="np-miss">{r.t}</mark> : <>{r.t}</>;
}

export function NocPaper({ input }: { input: NocInput }) {
  const m = nocModel(input);
  return (
    <article className="np-paper" aria-label="NOC preview">
      <div className="np-p-top">
        <span>
          Date: <Run r={m.date} />
        </span>
        <span>
          Place: <Run r={m.place} />
        </span>
      </div>
      <h4 className="np-p-t">NO OBJECTION CERTIFICATE</h4>
      <div className="np-p-st">For use of premises as the registered office</div>
      <p className="np-p-to">
        To,
        <br />
        The {m.roc}
        <br />
        Ministry of Corporate Affairs
      </p>
      <p className="np-p-sub">
        {m.subject.map((r, i) => (
          <Run key={i} r={r} />
        ))}
      </p>
      <p>Dear Sir or Madam,</p>
      {m.paras.map((p, i) => (
        <p key={i}>
          {p.map((r, j) => (
            <Run key={j} r={r} />
          ))}
        </p>
      ))}
      <div className="np-p-sign">
        <div className="np-p-line" />
        <b>
          <Run r={m.signName} />
        </b>
        <span>Owner of the Premises</span>
      </div>
      <div className="np-p-encl">
        <b>Enclosures</b>
        <ol>
          {m.encl.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
      </div>
    </article>
  );
}

export function NocPreview({ input, sm }: { input: NocInput; sm?: boolean }) {
  const missing = nocMissingCount(input);
  return (
    <div className={'np-pw' + (sm ? ' sm' : '')}>
      <div className="np-pwh">
        <span className="eyebrow">NOC · live preview</span>
        <span className="sp" />
        <span className="small" title="Fields the certificate prints that are still empty (marked in amber)">
          {missing ? `${missing} to fill` : 'Ready'}
        </span>
      </div>
      <NocPaper input={input} />
    </div>
  );
}

/** The browser's print dialog on an A4 page of the NOC ("Save as PDF" makes the PDF). */
export function printNoc(input: NocInput, onBlocked: () => void) {
  try {
    const fr = document.createElement('iframe');
    fr.setAttribute('aria-hidden', 'true');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.append(fr);
    fr.onload = () => {
      try {
        fr.contentWindow?.focus();
        fr.contentWindow?.print();
      } catch {
        onBlocked();
      }
      setTimeout(() => fr.remove(), 2000);
    };
    fr.srcdoc = nocPrintHtml(nocModel(input));
  } catch {
    onBlocked();
  }
}

/* ---------------------------------------------------------------- the fields (office, owner, signing) */

export interface NocBind {
  f: NocInput;
  set: (patch: Partial<NocInput>) => void;
  /** the error to show (touched fields only) */
  err: (k: NocField) => string | undefined;
  touch: (k: NocField) => void;
}

/** Field state for a NOC form: value, touched set, errors shown only once a field was left or its step checked. */
export function useNocForm(initial: NocInput) {
  const [f, setF] = useState<NocInput>(initial);
  const [touched, setTouched] = useState<Set<NocField>>(new Set());
  const check = useMemo(() => checkNoc(f), [f]);
  const bind: NocBind = {
    f,
    set: (patch) => setF((cur) => ({ ...cur, ...patch })),
    err: (k) => (touched.has(k) ? check.errors[k] : undefined),
    touch: (k) => setTouched((s) => (s.has(k) ? s : new Set(s).add(k))),
  };
  const markAll = (keys: readonly NocField[]) => setTouched((s) => new Set([...s, ...keys]));
  const stepOk = (keys: readonly NocField[]) => keys.every((k) => !check.errors[k]);
  return { f, setF, bind, check, markAll, stepOk };
}

function NField({ k, label, hint, b, children, cls }: { k: NocField; label: string; hint?: ReactNode; b: NocBind; children: ReactNode; cls?: string }) {
  const e = b.err(k);
  return (
    <label className={'mx-f np-f' + (e ? ' bad' : '') + (cls ? ' ' + cls : '')} data-k={k}>
      <span className="mx-fl">{label}</span>
      {children}
      {e ? <span className="np-err">{e}</span> : hint ? <span className="mx-fh">{hint}</span> : null}
    </label>
  );
}

function NIn({ k, b, ph, type, im, max, up }: { k: NocField; b: NocBind; ph?: string; type?: string; im?: 'numeric' | 'tel' | 'email'; max?: number; up?: boolean }) {
  return (
    <input
      className="mx-in"
      value={String(b.f[k] ?? '')}
      type={type}
      placeholder={ph}
      inputMode={im}
      maxLength={max}
      aria-invalid={b.err(k) ? true : undefined}
      onChange={(e) => b.set({ [k]: up ? e.target.value.toUpperCase() : e.target.value } as Partial<NocInput>)}
      onBlur={() => b.touch(k)}
    />
  );
}

function NSel({ k, b, options }: { k: NocField; b: NocBind; options: ReadonlyArray<readonly [string, string]> }) {
  return (
    <select className="lsel np-sel" value={String(b.f[k] ?? '')} onChange={(e) => b.set({ [k]: e.target.value } as Partial<NocInput>)} onBlur={() => b.touch(k)}>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function Sh({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="np-sh">
      <h4>{title}</h4>
      {sub ? <span className="small">{sub}</span> : null}
    </div>
  );
}

export function NocOfficeFields({ b }: { b: NocBind }) {
  const rented = b.f.holding === 'rented' || b.f.holding === 'leased';
  return (
    <>
      <Sh title="Address of the registered office" sub="Prints on the NOC, SPICe+ Part B and INC-22 exactly as typed" />
      <div className="np-g2">
        <NField k="line1" label="Flat, door or building" b={b}>
          <NIn k="line1" b={b} ph="Plot 42, 3rd Floor, Cyber Towers" />
        </NField>
        <NField k="line2" label="Street or area" b={b}>
          <NIn k="line2" b={b} ph="HITEC City Main Road" />
        </NField>
      </div>
      <div className="np-g3">
        <NField k="locality" label="Locality or landmark (optional)" b={b}>
          <NIn k="locality" b={b} ph="Madhapur" />
        </NField>
        <NField k="city" label="City or town" b={b}>
          <NIn k="city" b={b} ph="Hyderabad" />
        </NField>
        <NField k="district" label="District (optional)" b={b}>
          <NIn k="district" b={b} ph="Rangareddy" />
        </NField>
      </div>
      <div className="np-g2">
        <NField k="state" label="State or union territory" b={b}>
          <NSel k="state" b={b} options={NOC_STATES.map((s) => [s, s] as const)} />
        </NField>
        <NField k="pin" label="PIN code" b={b} hint={ROC_CITY[b.f.state] ? `Falls under the ROC ${ROC_CITY[b.f.state]}` : undefined}>
          <NIn k="pin" b={b} ph="500081" im="numeric" max={6} />
        </NField>
      </div>
      <Sh title="How the company holds the office" />
      <div className="mx-f np-f">
        <Seg
          className="np-seg"
          ariaLabel="How the company holds the office"
          value={b.f.holding}
          options={NOC_HOLDINGS.map((h) => ({ value: h.value, label: h.label }))}
          onChange={(v) => b.set({ holding: v })}
        />
      </div>
      {rented ? (
        <div className="np-g2">
          <NField k="agreementDate" label={b.f.holding === 'leased' ? 'Date of the lease deed' : 'Date of the rent agreement'} b={b}>
            <NIn k="agreementDate" b={b} type="date" />
          </NField>
        </div>
      ) : null}
      <Sh title="Proof of address" sub="Not older than two months on the NOC date" />
      <div className="np-g2">
        <NField k="billType" label="Utility bill" b={b}>
          <NSel k="billType" b={b} options={NOC_BILLS.map((x) => [x, x] as const)} />
        </NField>
        <NField k="billDate" label="Date on the bill" b={b}>
          <NIn k="billDate" b={b} type="date" />
        </NField>
      </div>
    </>
  );
}

export function NocOwnerFields({ b }: { b: NocBind }) {
  return (
    <>
      <Sh title={b.f.holding === 'director' ? 'The director who owns the premises' : 'The owner of the premises'} sub="The NOC is signed by this person" />
      <div className="np-g-own">
        <NField k="ownerTitle" label="Title" b={b}>
          <NSel k="ownerTitle" b={b} options={NOC_TITLES.map((x) => [x, x] as const)} />
        </NField>
        <NField k="ownerName" label="Full name as on the property papers" b={b}>
          <NIn k="ownerName" b={b} ph="Owner's full name" />
        </NField>
      </div>
      <div className="np-g-own">
        <NField k="relation" label="Relation" b={b}>
          <NSel k="relation" b={b} options={NOC_RELATIONS.map((r) => [r.value, r.label] as const)} />
        </NField>
        <NField k="relationName" label="Father's or husband's name" b={b}>
          <NIn k="relationName" b={b} ph="As on the PAN" />
        </NField>
      </div>
      <label className="np-chk">
        <input type="checkbox" checked={b.f.ownerAtPremises} onChange={(e) => b.set({ ownerAtPremises: e.target.checked })} />
        <span>The owner lives at the premises</span>
      </label>
      {b.f.ownerAtPremises ? null : (
        <NField k="ownerAddress" label="Owner's residential address" b={b}>
          <textarea
            className="mx-in"
            rows={3}
            value={b.f.ownerAddress}
            placeholder="House, street, city, state and PIN"
            onChange={(e) => b.set({ ownerAddress: e.target.value })}
            onBlur={() => b.touch('ownerAddress')}
          />
        </NField>
      )}
      <Sh title="To send the NOC for signature (optional)" />
      <div className="np-g3">
        <NField k="ownerPan" label="Owner's PAN" b={b}>
          <NIn k="ownerPan" b={b} ph="ABCDE1234F" max={10} up />
        </NField>
        <NField k="ownerEmail" label="Owner's email" b={b}>
          <NIn k="ownerEmail" b={b} type="email" im="email" ph="owner@example.com" />
        </NField>
        <NField k="ownerPhone" label="Owner's mobile" b={b}>
          <NIn k="ownerPhone" b={b} im="tel" ph="+91 98765 43210" />
        </NField>
      </div>
    </>
  );
}

export function NocSigningFields({ b }: { b: NocBind }) {
  return (
    <>
      <Sh title="Signing details" sub="The owner signs on this date at this place" />
      <NField k="companyName" label="Proposed name of the company" b={b} hint="As the NOC prints it, for example Lotus Dental Private Limited">
        <NIn k="companyName" b={b} ph="Lotus Dental Private Limited" />
      </NField>
      <div className="np-g2">
        <NField k="nocDate" label="Date of the NOC" b={b}>
          <NIn k="nocDate" b={b} type="date" />
        </NField>
        <NField k="place" label="Place of signing" b={b}>
          <NIn k="place" b={b} ph={b.f.city || 'City'} />
        </NField>
      </div>
    </>
  );
}

/** Warnings (never block) and what is still missing, under the signing step. */
export function NocChecks({ f, missingFields }: { f: NocInput; missingFields?: number }) {
  const { warnings } = checkNoc(f);
  const missing = missingFields ?? Object.keys(checkNoc(f).errors).length;
  return (
    <>
      {warnings.length ? (
        <div className="np-warns">
          {warnings.map((w) => (
            <div key={w.title} className="np-warn" role="note">
              <Icon name="alert" size={14} />
              <span className="mx-dt">
                <b>{w.title}</b>
                <span>{w.detail}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {missing ? (
        <div className="np-warn bad" role="note">
          <Icon name="alert" size={14} />
          <span className="mx-dt">
            <b>{missing === 1 ? '1 field still needs you' : `${missing} fields still need you`}</b>
            <span>Use Edit on a row above, or the steps on the left.</span>
          </span>
        </div>
      ) : (
        <div className="np-warn ok" role="note">
          <Icon name="check" size={14} />
          <span className="mx-dt">
            <b>Everything the NOC needs is in</b>
            <span>{warnings.length ? 'The warnings above do not stop it; check them with the owner.' : 'The NOC is generated as a Word file for the owner to sign.'}</span>
          </span>
        </div>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- the editor (generate / generate again) */

const NOC_STEPS = [
  { key: 'office', label: 'Registered office', sub: 'Address and proof', fields: NOC_STEP_FIELDS.office },
  { key: 'owner', label: 'Property owner', sub: 'Who gives the NOC', fields: NOC_STEP_FIELDS.owner },
  { key: 'signing', label: 'Signing and generate', sub: 'Check and generate', fields: NOC_STEP_FIELDS.signing },
] as const;

/** Modal wizard for an existing project: generate its NOC, or change the details and generate it again. */
export function NocEditor({ eng, initial, again }: { eng: Engagement; initial: NocInput; again: boolean }) {
  const { closeModal, toast } = useConsole();
  const refresh = useNocRefresh(eng.id);
  const form = useNocForm(initial);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const missing = nocMissingCount(form.f);
  const go = (to: number) => {
    if (to > step) {
      form.markAll(NOC_STEPS[step]!.fields);
      if (!form.stepOk(NOC_STEPS[step]!.fields)) return;
    }
    setStep(Math.max(0, Math.min(NOC_STEPS.length - 1, to)));
  };
  const submit = async () => {
    form.markAll(NOC_STEPS.flatMap((s) => [...s.fields]));
    if (Object.keys(form.check.errors).length) {
      setErr('A few fields still need you');
      const first = NOC_STEPS.findIndex((s) => !form.stepOk(s.fields));
      if (first >= 0) setStep(first);
      return;
    }
    setBusy(true);
    setErr('');
    try {
      const noc = await generateNoc(eng.id, form.f);
      refresh(noc);
      closeModal();
      toast(again ? 'NOC generated again · the owner signs this version' : 'NOC generated · download it for the owner to sign');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate the NOC');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="np-wiz">
      <div className="np-head">
        <span className="mx-ni">
          <Icon name="doc" />
        </span>
        <div className="mx-dt">
          <h3>{again ? `Edit the NOC · ${eng.companyName}` : `Registered office NOC · ${eng.companyName}`}</h3>
          <span>The owner of the registered office signs it; the Word file is generated from these details</span>
        </div>
        <button type="button" className="ib" aria-label="Close" onClick={closeModal}>
          <Icon name="x" />
        </button>
      </div>
      <div className="np-body">
        <div className="np-rail">
          {NOC_STEPS.map((s, i) => {
            const ok = i < step && form.stepOk(s.fields);
            return (
              <button key={s.key} type="button" className={'np-rs' + (i === step ? ' on' : '') + (ok ? ' ok' : '')} aria-current={i === step ? 'step' : undefined} onClick={() => go(i)}>
                <span className="np-rn">{ok ? <Icon name="check" size={12} /> : i + 1}</span>
                <span className="mx-dt">
                  <b>{s.label}</b>
                  <span>{s.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="np-mid">
          <div className="np-form">
            <div className="np-step">
              <span className="eyebrow">{`Step ${step + 1} of ${NOC_STEPS.length}`}</span>
              <h3>{NOC_STEPS[step]!.label}</h3>
            </div>
            {step === 0 ? <NocOfficeFields b={form.bind} /> : step === 1 ? <NocOwnerFields b={form.bind} /> : null}
            {step === 2 ? (
              <>
                <NocSigningFields b={form.bind} />
                <NocChecks f={form.f} />
              </>
            ) : null}
            {err ? <p className="cx-err">{err}</p> : null}
          </div>
          <div className="np-foot">
            {step ? (
              <Btn ico="back" onClick={() => setStep(step - 1)}>
                Back
              </Btn>
            ) : (
              <span />
            )}
            <span className="sp" />
            <span className="small">{missing ? `${missing} NOC field${missing === 1 ? '' : 's'} left` : 'The NOC is complete'}</span>
            {step < NOC_STEPS.length - 1 ? (
              <Btn cls="pri" ico="chev" onClick={() => go(step + 1)}>
                Continue
              </Btn>
            ) : (
              <Btn cls="pri" ico="check" disabled={busy} onClick={() => void submit()}>
                {busy ? 'Generating…' : again ? 'Save and generate the NOC again' : 'Generate the NOC'}
              </Btn>
            )}
          </div>
        </div>
        <NocPreview input={form.f} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- track + actions (panel and drawer) */

export function NocTrack({ noc }: { noc: NocDto }) {
  const keys = ['generated', 'sent', 'signed'] as const;
  const at = keys.indexOf(noc.status);
  const when = [noc.generatedAt, noc.sentAt, noc.signedAt];
  return (
    <div className="np-track" role="list" aria-label="Signature track">
      {keys.map((k, i) => (
        <div key={k} role="listitem" className={'np-tk' + (i <= at ? ' on' : '')} title={i <= at && when[i] ? `${NOC_STATUS[k].label} · ${stamp(when[i])}` : `${NOC_STATUS[k].label} · not yet`}>
          <i>{i < at || (i === at && k === 'signed') ? <Icon name="check" size={11} /> : i + 1}</i>
          <span>{NOC_STATUS[k].label}</span>
        </div>
      ))}
    </div>
  );
}

/** "Mark as sent": who it went to, and (default on) ask the client to upload the signed copy on the step. */
function SentBox({ eng, noc }: { eng: Engagement; noc: NocDto }) {
  const { closeModal, toast } = useConsole();
  const refresh = useNocRefresh(eng.id);
  const qc = useQueryClient();
  const [to, setTo] = useState(noc.input.ownerEmail || 'the owner');
  const [ask, setAsk] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const send = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch(nocUrl(eng.id, '/sent'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to }) });
      const body = (await res.json().catch(() => ({}))) as { noc?: NocDto; error?: string };
      if (!res.ok || !body.noc) throw new Error(body.error ?? 'Could not save');
      refresh(body.noc);
      let asked = false;
      if (ask) {
        const fr = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/file-requests`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ stepId: 'pre-14', fieldId: 'registeredOfficeNocUrl', label: 'Signed NOC from the property owner', note: `The NOC we sent on ${dShort(new Date().toISOString())}, signed by ${body.noc.input.ownerName || 'the owner'}` }),
        });
        asked = fr.ok;
        void qc.invalidateQueries({ queryKey: ['file-requests', eng.id] });
      }
      closeModal();
      toast(asked ? `Marked as sent · the client is asked to upload the signed copy` : `Marked as sent to ${to.trim() || 'the owner'}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ModalBody
      title="Mark the NOC as sent"
      sub={`Download or print the NOC and send it to the owner yourself. This records who it went to.`}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn cls="pri" ico="send" disabled={busy} onClick={() => void send()}>
            {busy ? 'Saving…' : 'Mark as sent'}
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <label className="mx-f">
          <span className="mx-fl">Sent to</span>
          <input className="mx-in" value={to} onChange={(e) => setTo(e.target.value)} placeholder="the owner, or their email" />
        </label>
        <label className="np-chk">
          <input type="checkbox" checked={ask} onChange={(e) => setAsk(e.target.checked)} />
          <span>Ask the client to upload the signed copy on Registered Office Address (a file request, as on the step page)</span>
        </label>
      </div>
      {err ? <p className="cx-err">{err}</p> : null}
    </ModalBody>
  );
}

function useSignedUpload(eng: Engagement) {
  const { toast } = useConsole();
  const refresh = useNocRefresh(eng.id);
  return useMutation({
    mutationFn: async (file: File) => {
      const bad = validateMilestoneUploadFile(file);
      if (bad) throw new Error(bad);
      const fd = new FormData();
      fd.set('file', file);
      const res = await fetch(nocUrl(eng.id, '/signed'), { method: 'POST', body: fd });
      const body = (await res.json().catch(() => ({}))) as { noc?: NocDto; error?: string };
      if (!res.ok || !body.noc) throw new Error(body.error ?? 'Upload failed');
      return body.noc;
    },
    onSuccess: (noc) => {
      refresh(noc);
      toast(`Signed NOC received · ${noc.signedFileName ?? 'file'}`);
    },
    onError: (e: Error) => toast(e.message),
  });
}

/** The NOC's actions: download, print, mark sent, upload the signed copy, edit details. */
function NocActions({ eng, noc, row }: { eng: Engagement; noc: NocDto; row?: boolean }) {
  const { openModal, toast } = useConsole();
  const upload = useSignedUpload(eng);
  // A project lead reads the NOC (download, print); sending, the signed copy and edits are the manager's (repository rule).
  const canWrite = useNocWriter();
  return (
    <div className={'np-dacts' + (row ? ' row' : '')}>
      <a className="btn pri" href={nocUrl(eng.id, '/file')} download={noc.fileName}>
        <Icon name="dl" />
        Download NOC
      </a>
      <Btn ico="doc" onClick={() => printNoc(noc.input, () => toast('Printing is blocked here · use Download NOC instead'))}>
        Print or save as PDF
      </Btn>
      {canWrite && noc.status === 'generated' ? (
        <Btn ico="send" onClick={() => openModal(<SentBox eng={eng} noc={noc} />, { label: 'Mark the NOC as sent' })}>
          Mark as sent to the owner
        </Btn>
      ) : null}
      {noc.status !== 'signed' ? (
        canWrite ? (
        <label className={'btn' + (upload.isPending ? ' cx-busy' : '')}>
          <Icon name="up" />
          {upload.isPending ? 'Uploading…' : 'Upload the signed NOC'}
          <input
            type="file"
            hidden
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload.mutate(file);
            }}
          />
        </label>
        ) : null
      ) : (
        <a className="btn" href={nocUrl(eng.id, '/file?kind=signed')} download={noc.signedFileName ?? undefined}>
          <Icon name="dl" />
          Download the signed copy
        </a>
      )}
      {canWrite ? (
        <Btn ico="notes" onClick={() => openModal(<NocEditor eng={eng} initial={noc.input} again />, { cls: 'np-modal', label: 'Edit the NOC' })}>
          Edit details
        </Btn>
      ) : null}
    </div>
  );
}

function NocFile({ noc }: { noc: NocDto }) {
  return (
    <div className="np-file">
      <span className="np-fi">DOCX</span>
      <span className="mx-dt">
        <b>{noc.fileName}</b>
        <span>{`Word · A4 · Times New Roman 12 · generated ${stamp(noc.generatedAt)}`}</span>
      </span>
    </div>
  );
}

function NocActivity({ noc, max }: { noc: NocDto; max?: number }) {
  const list = noc.history.slice().reverse();
  const shown = max ? list.slice(0, max) : list;
  return (
    <div className="mx-acts">
      {shown.map((h, i) => (
        <div key={`${h.at}-${i}`} className="mx-act">
          <i />
          <span className="mx-dt">
            <b>{h.text}</b>
            <span>{`${h.byName} · ${stamp(h.at)}`}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** pre-14's "No-objection certificate from the owner" — set when the client uploaded a NOC on the step. */
function useStepNoc(eng: Engagement): boolean {
  const { getStateForEngagement } = useApp();
  return Boolean(getStateForEngagement(eng)['pre-14']?.responses?.registeredOfficeNocUrl?.trim());
}

/** Client overview panel: the project's registered-office NOC, or the way to generate it. */
export function NocPanel({ eng }: { eng: Engagement }) {
  const paths = useClientPaths();
  const { openModal, go } = useConsole();
  const canWrite = useNocWriter();
  const today = useToday();
  const q = useNoc(eng.id);
  const stepHasNoc = useStepNoc(eng);
  const noc = q.data;
  const isInc = eng.stage === 'Pre-Incorporation';
  const reqs = useQuery({
    queryKey: ['file-requests', eng.id],
    enabled: Boolean(noc),
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${encodeURIComponent(eng.id)}/file-requests`);
      if (!res.ok) return [] as Array<{ stepId: string; fieldId: string; requestedAt: string; fulfilledAt?: string }>;
      return ((await res.json()) as { requests: Array<{ stepId: string; fieldId: string; requestedAt: string; fulfilledAt?: string }> }).requests;
    },
  });
  const asked = (reqs.data ?? []).filter((r) => r.stepId === 'pre-14' && r.fieldId === 'registeredOfficeNocUrl').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0];
  if (q.isSuccess && !noc && !isInc) return null;
  return (
    <Panel
      title="Registered office NOC"
      sub="The property owner's no-objection certificate · Pre-7 Registered Office Address"
      need="inc"
      act={noc ? <span className={'pill ' + NOC_STATUS[noc.status].pill}>{NOC_STATUS[noc.status].label}</span> : undefined}
      id="cx-noc"
    >
      {q.isPending ? (
        <p className="small">Loading the NOC…</p>
      ) : q.isError ? (
        <div className="sec-err">
          <Icon name="alert" />
          <span>The NOC could not load.</span>
          <span className="sp" />
          <button type="button" className="btn sm" onClick={() => void q.refetch()}>
            Try again
          </button>
        </div>
      ) : !noc ? (
        <div className="cx-nocempty">
          <p className="small">
            {canWrite
              ? 'No NOC generated for this project yet. Type the office and the owner’s details and the app writes the NOC as a Word file for the owner to sign.'
              : 'No NOC generated for this project yet. Your manager generates it from the office and the owner’s details.'}
          </p>
          {canWrite ? (
          <Btn cls="sm pri" ico="doc" onClick={() => openModal(<NocEditor eng={eng} initial={blankNocInput(eng.companyName, today)} again={false} />, { cls: 'np-modal', label: 'Generate the NOC' })}>
            Generate the NOC
          </Btn>
          ) : null}
        </div>
      ) : (
        <div className="cx-noc">
          <NocFile noc={noc} />
          <NocTrack noc={noc} />
          <p className="small cx-nocline">
            {nocAddress(noc.input)} · owner {noc.input.ownerTitle} {noc.input.ownerName}
            {noc.sentAt ? ` · sent to ${noc.sentTo ?? 'the owner'} on ${dShort(noc.sentAt.slice(0, 10))}` : ''}
            {asked && !asked.fulfilledAt && noc.status !== 'signed' ? ` · the client is asked for the signed copy since ${dShort(asked.requestedAt.slice(0, 10))}` : ''}
          </p>
          {stepHasNoc && noc.status !== 'signed' ? (
            <div className="banner info cx-banner">
              <Icon name="check" />
              <div>
                <b>The client uploaded a NOC on Registered Office Address</b>
                <span>
                  Check it on the step.{' '}
                  <button type="button" className="link cx-inl" onClick={() => go(paths.step(eng, 'pre-14'))}>
                    Open the step
                  </button>
                </span>
              </div>
            </div>
          ) : null}
          <NocActions eng={eng} noc={noc} row />
          <div className="mx-sub-h">
            <span className="eyebrow">Activity</span>
          </div>
          <NocActivity noc={noc} max={4} />
        </div>
      )}
    </Panel>
  );
}

/** The drawer a Clients-page NOC card opens (prototype npDrawer). */
export function NocDrawer({ eng }: { eng: Engagement }) {
  const paths = useClientPaths();
  const { closeDrawer, go } = useConsole();
  const q = useNoc(eng.id);
  const noc = q.data;
  const people = useApp().internOptions;
  const lead = people.find((p) => p.id === eng.internId)?.name;
  return (
    <div className="np-drw">
      <DrawerHead
        eyebrow="Registered office NOC"
        title={eng.companyName}
        chips={
          <>
            {noc ? <span className={'pill ' + NOC_STATUS[noc.status].pill}>{NOC_STATUS[noc.status].label}</span> : null}
            <span className="pill mut">Pre-7 Registered Office Address</span>
          </>
        }
      />
      {!noc ? (
        <p className="small">{q.isPending ? 'Loading the NOC…' : q.isError ? 'The NOC could not load.' : 'No NOC for this project yet.'}</p>
      ) : (
        <>
          <div className="mx-facts">
            <div>
              <span>Client contact</span>
              <b className="cx-ell">{eng.clientDisplayName || '—'}</b>
            </div>
            <div>
              <span>Email</span>
              <b className="cx-ell" title={eng.clientEmail ?? undefined}>
                {eng.clientEmail || '—'}
              </b>
            </div>
            <div>
              <span>Project lead</span>
              <b className="cx-ell">{lead || '—'}</b>
            </div>
            <div>
              <span>Owner</span>
              <b className="cx-ell">{`${noc.input.ownerTitle} ${noc.input.ownerName}`}</b>
            </div>
          </div>
          <section className="mx-ds2">
            <div className="mx-dsh">
              <span className="eyebrow">The NOC</span>
              <span className="sp" />
              <span className="small">{noc.fileName}</span>
            </div>
            <NocPreview input={noc.input} sm />
            <NocActions eng={eng} noc={noc} row />
          </section>
          <section className="mx-ds2">
            <div className="mx-dsh">
              <span className="eyebrow">Signature</span>
            </div>
            <NocTrack noc={noc} />
          </section>
          <section className="mx-ds2">
            <div className="mx-dsh">
              <span className="eyebrow">Activity</span>
            </div>
            <NocActivity noc={noc} />
          </section>
        </>
      )}
      <div className="mx-dfoot">
        <Btn
          ico="grid"
          onClick={() => {
            closeDrawer();
            go(paths.project(eng) + '#cx-noc');
          }}
        >
          Open the client
        </Btn>
        <span className="sp" />
        <Btn cls="pri" onClick={closeDrawer}>
          Done
        </Btn>
      </div>
    </div>
  );
}

/** Clients page: NOCs still waiting for a signature (prototype npStrip). */
export function NocStrip({ engagements, onNew }: { engagements: Engagement[]; onNew?: () => void }) {
  const { openDrawer } = useConsole();
  const list = useNocList();
  const people = useApp().internOptions;
  const open = (list.data ?? [])
    .filter((n) => n.status !== 'signed')
    .map((n) => ({ n, e: engagements.find((e) => e.id === n.engagementId) }))
    .filter((x): x is { n: NocDto; e: Engagement } => Boolean(x.e));
  if (!open.length) return null;
  return (
    <section className="glass panel np-strip">
      <div className="ph">
        <div className="mx-pt">
          <h3>Registered office NOCs</h3>
          <span className="small">{`${open.length} waiting for the owner's signature · the NOC goes to the owner first`}</span>
        </div>
        <span className="sp" />
        {onNew ? (
          <Btn cls="sm" ico="build" onClick={onNew}>
            New project
          </Btn>
        ) : null}
      </div>
      <div className="np-cards">
        {open.map(({ n, e }) => {
          const lead = people.find((p) => p.id === e.internId)?.name;
          return (
            <button key={e.id} type="button" className="np-card" onClick={() => openDrawer(<NocDrawer eng={e} />)}>
              <div className="np-ch">
                <span className="np-mono">{(e.companyName.trim()[0] ?? '?').toUpperCase()}</span>
                <span className="mx-dt">
                  <b title={e.companyName}>{e.companyName}</b>
                  <span>{[n.input.city, lead].filter(Boolean).join(' · ') || '—'}</span>
                </span>
              </div>
              <div className="np-cf">
                <span className={'pill ' + NOC_STATUS[n.status].pill}>{NOC_STATUS[n.status].label}</span>
                <span className="sp" />
                <span className="small">{`Generated ${dShort(n.generatedAt.slice(0, 10))}`}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

