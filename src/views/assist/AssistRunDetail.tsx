'use client';

import { useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/spectrum-chip';
import { Textarea } from '@/components/ui/textarea';
import { useAssistEvidenceDocuments, useRecordAssistAttestation, type AssistAttestationBody } from '@/hooks/use-assist-agents';
import { ATTESTATION_CHECK_SPECS, requiredAttestationChecks, runAwaitsAttestation } from '@/lib/assist-agents/attestation';
import { findSubAgent } from '@/lib/assist-agents/catalog';
import { ASSIST_AGENT_RUN_CLOSED, type AssistAgentRunView, type AssistBlankReason } from '@/lib/assist-agents/types';
import { toastError, toastSuccess } from '@/lib/toast-errors';

/**
 * One VCFO Assist run, for the staff Assist runs page: the evidence log (SAFETY.md G14), the
 * fields left for the client's records (G16) and the certifier's checks (G17), with the "Record
 * certifier checks" form while the run waits for them. Nothing in the form starts ticked: each
 * check is the certifier's own click, and Save stays off until the checks this form needs are made.
 */

const when = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const BLANK_TEXT: Record<AssistBlankReason, string> = {
  missing: 'not in Suite',
  empty: 'blank in Suite',
  placeholder: 'looked like a placeholder',
  firm_contact: "was the firm's own contact",
};

const ERROR_TEXT: Record<string, string> = {
  certifier_must_differ: 'The firm requires the certifier to be someone other than the person who ran the agent.',
  already_attested: 'The certifier checks for this run are already recorded.',
  run_not_filled: 'The form is not filled yet. Record the checks once the agent has filled it.',
  run_closed: 'The run is closed.',
  attestation_incomplete: 'Confirm every check this form needs.',
  unknown_document: 'One of the evidence documents is not in this client’s vault.',
};

function Fact({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 border-t border-line-soft py-2 text-[13px] first:border-t-0">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="min-w-0 break-words text-ink">{children}</dd>
    </div>
  );
}

function AttestationForm({ run, onDone }: { run: AssistAgentRunView; onDone: () => void }) {
  const required = requiredAttestationChecks(run.subAgent);
  const [fieldsChecked, setFieldsChecked] = useState(false);
  const [office, setOffice] = useState<'visited' | 'owner_noc' | ''>('');
  const [signatures, setSignatures] = useState<'in_presence' | 'video_kyc' | ''>('');
  const [docs, setDocs] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const record = useRecordAssistAttestation();
  const documentsQuery = useAssistEvidenceDocuments(run.engagementId);
  const documents = documentsQuery.data?.documents ?? [];

  const complete =
    fieldsChecked && (!required.includes('registeredOffice') || office !== '') && (!required.includes('subscriberSignatures') || signatures !== '');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!complete) return;
    const body: AssistAttestationBody = {
      checks: {
        fieldsCheckedAgainstRecords: true,
        ...(office ? { registeredOffice: office } : {}),
        ...(signatures ? { subscriberSignatures: signatures } : {}),
      },
      evidenceDocumentIds: docs,
      ...(note.trim() ? { note: note.trim() } : {}),
    };
    record.mutate(
      { engagementId: run.engagementId, runId: run.id, body },
      {
        onSuccess: () => {
          toastSuccess('Certifier checks recorded', 'The side panel now shows Submit and Pay to the person filing.');
          onDone();
        },
        onError: (err) => toastError('Could not record the checks', ERROR_TEXT[err.message] ?? err.message),
      },
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-md border border-line-soft bg-surface-sunken p-3" aria-label="Record certifier checks">
      <p className="text-[13px] text-ink-2">Tick only what you did yourself. These checks are recorded under your name with the time and your IP address.</p>
      <label className="flex items-start gap-2 text-[13.5px] text-ink">
        <input type="checkbox" className="mt-0.5" checked={fieldsChecked} onChange={(e) => setFieldsChecked(e.target.checked)} />
        {ATTESTATION_CHECK_SPECS.fieldsCheckedAgainstRecords.label}
      </label>
      {required.includes('registeredOffice') ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[12.5px] font-medium text-ink-muted">{ATTESTATION_CHECK_SPECS.registeredOffice.label}</legend>
          {ATTESTATION_CHECK_SPECS.registeredOffice.options!.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-[13.5px] text-ink">
              <input type="radio" name="registeredOffice" className="mt-0.5" checked={office === o.value} onChange={() => setOffice(o.value as typeof office)} />
              {o.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      {required.includes('subscriberSignatures') ? (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1 text-[12.5px] font-medium text-ink-muted">{ATTESTATION_CHECK_SPECS.subscriberSignatures.label}</legend>
          {ATTESTATION_CHECK_SPECS.subscriberSignatures.options!.map((o) => (
            <label key={o.value} className="flex items-start gap-2 text-[13.5px] text-ink">
              <input type="radio" name="subscriberSignatures" className="mt-0.5" checked={signatures === o.value} onChange={() => setSignatures(o.value as typeof signatures)} />
              {o.label}
            </label>
          ))}
        </fieldset>
      ) : null}
      <fieldset className="grid gap-1.5">
        <legend className="mb-1 text-[12.5px] font-medium text-ink-muted">Evidence from the client&apos;s vault (optional)</legend>
        {documentsQuery.isLoading ? (
          <span className="text-[12.5px] text-ink-muted">Loading documents…</span>
        ) : documents.length === 0 ? (
          <span className="text-[12.5px] text-ink-muted">No documents in this client&apos;s vault yet. Upload the site-visit photo, NOC or video-KYC record there to link it.</span>
        ) : (
          <div className="max-h-40 overflow-y-auto">
            {documents.map((d) => (
              <label key={d.id} className="flex items-center gap-2 py-0.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={docs.includes(d.id)}
                  onChange={(e) => setDocs((cur) => (e.target.checked ? [...cur, d.id].slice(0, 20) : cur.filter((x) => x !== d.id)))}
                />
                <span className="truncate">{d.fileName}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <div className="grid gap-1">
        <label htmlFor={`attest-note-${run.id}`} className="text-[12.5px] text-ink-muted">
          Note (optional, no personal data)
        </label>
        <Textarea id={`attest-note-${run.id}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={!complete || record.isPending}>
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Record certifier checks
        </Button>
      </div>
    </form>
  );
}

export function AssistRunDetail({ run, onOpenChange }: { run: AssistAgentRunView | null; onOpenChange: (open: boolean) => void }) {
  const [attesting, setAttesting] = useState(false);
  if (!run) return null;
  const sub = findSubAgent(run.subAgent);
  const ev = run.evidence;
  const awaits = runAwaitsAttestation(run);
  const submittedWithout = !run.attestation && Boolean(run.srn);
  return (
    <Modal
      open
      onOpenChange={(open) => {
        if (!open) setAttesting(false);
        onOpenChange(open);
      }}
      size="lg"
      eyebrow={run.companyName ?? 'Agent run'}
      title={`${sub?.form ?? run.subAgent} · v${run.recipeVersion}`}
      sub={
        <>
          <span>{when(run.startedAt)}</span>
          <span className="font-mono">{run.state}</span>
        </>
      }
    >
      <section className="mb-4" aria-label="Certifier checks">
        <h3 className="mb-2 text-[13px] font-medium text-ink">Certifier checks</h3>
        {run.attestation ? (
          <div className="grid gap-1 text-[13px]">
            <span>
              <Chip raw tone="ok">
                Recorded
              </Chip>{' '}
              by {run.attestation.certifierName ?? run.attestation.certifierEmail ?? 'a staff member'} on {when(run.attestation.createdAt)}
              {run.attestation.ip ? <span className="ml-1 font-mono text-[12px] text-ink-muted">({run.attestation.ip})</span> : null}
            </span>
            <ul className="ml-4 list-disc text-ink-2">
              <li>{ATTESTATION_CHECK_SPECS.fieldsCheckedAgainstRecords.label}</li>
              {run.attestation.checks.registeredOffice ? (
                <li>{ATTESTATION_CHECK_SPECS.registeredOffice.options!.find((o) => o.value === run.attestation!.checks.registeredOffice)?.label}</li>
              ) : null}
              {run.attestation.checks.subscriberSignatures ? (
                <li>{ATTESTATION_CHECK_SPECS.subscriberSignatures.options!.find((o) => o.value === run.attestation!.checks.subscriberSignatures)?.label}</li>
              ) : null}
            </ul>
            {run.attestation.evidenceDocumentIds.length ? (
              <span className="text-ink-muted">{run.attestation.evidenceDocumentIds.length} evidence document(s) linked.</span>
            ) : null}
            {run.attestation.note ? <span className="text-ink-muted">Note: {run.attestation.note}</span> : null}
          </div>
        ) : submittedWithout ? (
          <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
            The SRN came back before any certifier checks were recorded for this run.
          </p>
        ) : awaits ? (
          attesting ? (
            <AttestationForm run={run} onDone={() => setAttesting(false)} />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] text-ink-2">The side panel is waiting for these before it shows Submit and Pay.</span>
              <Button size="sm" onClick={() => setAttesting(true)}>
                Record certifier checks
              </Button>
            </div>
          )
        ) : (
          <p className="text-[13px] text-ink-muted">
            {ASSIST_AGENT_RUN_CLOSED.has(run.status) ? 'None recorded.' : 'The checks can be recorded once the agent has filled the form.'}
          </p>
        )}
      </section>

      <section className="mb-4" aria-label="Evidence log">
        <h3 className="mb-1 text-[13px] font-medium text-ink">Evidence log</h3>
        <dl>
          <Fact k="Run by (Suite)">
            {ev.userName ?? run.userName ?? '—'}
            {ev.userEmail ? <span className="ml-1 text-ink-muted">({ev.userEmail})</span> : null}
          </Fact>
          <Fact k="MCA login used">{ev.mcaLoginLabel ?? '—'}</Fact>
          <Fact k="DSC holders">{ev.dscSigners.length ? ev.dscSigners.map((s) => `${s.name} (${s.kind})`).join(', ') : '—'}</Fact>
          <Fact k="Device">
            {ev.device ? (
              <>
                <span className="font-mono text-[12px]">install {ev.device.installId}</span>
                {ev.device.extensionVersion ? <span className="ml-1 text-ink-muted">· extension {ev.device.extensionVersion}</span> : null}
                <span className="mt-0.5 block text-[12px] text-ink-muted">{ev.device.userAgent}</span>
              </>
            ) : (
              '—'
            )}
          </Fact>
          <Fact k="Client IPs">
            {ev.clientIps.length
              ? ev.clientIps.map((c) => (
                  <span key={c.ip} className="block">
                    <span className="font-mono text-[12.5px]">{c.ip}</span>
                    <span className="ml-1 text-[12px] text-ink-muted">
                      {c.calls} call{c.calls === 1 ? '' : 's'}, {when(c.firstAt)} to {when(c.lastAt)}
                    </span>
                  </span>
                ))
              : '—'}
          </Fact>
        </dl>
      </section>

      <section aria-label="Left for the client's records">
        <h3 className="mb-1 text-[13px] font-medium text-ink">Left for the client&apos;s records</h3>
        {run.blanks.length === 0 ? (
          <p className="text-[13px] text-ink-muted">None.</p>
        ) : (
          <ul className="grid gap-0.5 text-[13px]">
            {run.blanks.map((b) => (
              <li key={b.field}>
                <span className="font-mono text-[12.5px]">{b.field}</span> <span className="text-ink-muted">· {BLANK_TEXT[b.reason]}</span>
              </li>
            ))}
          </ul>
        )}
        {run.refusals.length ? (
          <p className="mt-2 text-[12.5px] text-ink-muted">Guard refusals: {run.refusals.map((r) => `${r.kind}${r.target ? ` (${r.target})` : ''}`).join(', ')}.</p>
        ) : null}
      </section>
    </Modal>
  );
}
