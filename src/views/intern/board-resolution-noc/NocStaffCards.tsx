'use client';

import { useState } from 'react';
import { GitCompare, RefreshCw, Replace, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Chip, Tag } from '@/components/ui/spectrum-chip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FilterSelect } from '@/components/ui/native-select';
import { Switch } from '@/components/ui/switch';
import { CardHeadTile } from '@/components/common/CardHeadTile';
import {
  DocTrack,
  EvidenceTable,
  ReceiveChecklist,
  VariantTree,
  VersionCompare,
  docDay,
  nocDocType,
  nocEvidence,
  type DocVersion,
} from '@/components/board-doc';
import { NOC_TEMPLATES } from '@/lib/noc/templates';
import { NOC_VARIANTS } from '@/lib/noc/variant';
import { NOC_FIELD_LABEL, NOC_VARIANT_FIELD } from '@/lib/noc/fields';
import type { NocState } from '@/lib/noc/state';
import { nocRecords, type NocAction, type NocVersionRow } from '@/views/intern/board-resolution-noc/useNocState';

/**
 * Staff parts of the board resolution (NOC) page (R-52, T1 to T6): the track with the notary
 * steps, the Template card (variant, internal file name, Change template, out-of-date mark,
 * Compare versions), the receive checklist and the "Why VCFO chose this template" evidence.
 * The shared document part (`@/components/board-doc`) draws the track, the checklist, the
 * compare list and the evidence table; this file only feeds them the real state.
 */

export function NocTrackStrip({ noc, nowLabel }: { noc: NocState; nowLabel?: string }) {
  const type = nocDocType(noc.variant, { notary: noc.foreignParent && !noc.notaryStepsOff });
  return <DocTrack stages={type.stages} records={nocRecords(noc)} nowLabel={nowLabel} label="Progress of the board resolution" />;
}

function CardHead({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center gap-2.5 border-b border-line-soft px-4 py-2">
      <CardHeadTile title={title} />
      <h2 className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">{title}</h2>
      {right}
    </div>
  );
}

const VARIANT_OPTIONS = NOC_VARIANTS.map((v) => ({ value: v, label: NOC_TEMPLATES[v].label }));

/** T2, T3, T4: the Template card. */
export function NocTemplateCard({
  noc,
  busy,
  act,
  onMakeAgain,
  makingAgain,
  loadVersions,
  onError,
}: {
  noc: NocState;
  busy: NocAction['action'] | null;
  act: (body: NocAction) => Promise<NocState>;
  onMakeAgain: () => Promise<void> | void;
  makingAgain: boolean;
  loadVersions: () => Promise<NocVersionRow[]>;
  onError: (message: string) => void;
}) {
  const staff = noc.staff;
  const [changeOpen, setChangeOpen] = useState(false);
  const [variant, setVariant] = useState<string>(noc.variant);
  const [reason, setReason] = useState('');
  const [compareOpen, setCompareOpen] = useState(false);
  const [versions, setVersions] = useState<DocVersion[] | null>(null);
  if (!staff) return null;
  const accepted = noc.accepted;

  const openCompare = async () => {
    setCompareOpen(true);
    try {
      const rows = await loadVersions();
      // The compare part reads oldest first; the route returns newest first.
      setVersions(
        [...rows].reverse().map((r) => ({
          id: String(r.version),
          label: `Version ${r.version}`,
          at: r.createdAt,
          by: r.byName ?? null,
          values: r.fields,
        })),
      );
    } catch (err) {
      setCompareOpen(false);
      onError(err instanceof Error ? err.message : 'Could not load the versions');
    }
  };

  const submitChange = async () => {
    try {
      await act({ action: 'change_template', variant, reason: reason.trim() });
      setChangeOpen(false);
      setReason('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not change the template');
    }
  };

  return (
    <section className="surface min-w-0 overflow-hidden" aria-label="Template">
      <CardHead title="Template" right={noc.version ? <Tag>Version {noc.version}</Tag> : undefined} />
      <div className="grid gap-3 px-4 py-3 text-[13.5px]">
        <div className="min-w-0">
          <div className="font-medium text-ink">{noc.variantLabel}</div>
          <div className="truncate font-mono text-[12.5px] text-ink-muted" title={staff.templateFileName}>
            {staff.templateFileName}
          </div>
        </div>
        {staff.override ? (
          <p className="m-0 text-[12.5px] text-ink-muted">
            Changed{staff.override.byName ? ` by ${staff.override.byName}` : ''} · {docDay(staff.override.at)}
            {staff.override.reason ? ` · ${staff.override.reason}` : ''}
          </p>
        ) : null}
        {staff.outOfDate ? (
          <div className="grid gap-2">
            <Chip tone="warn" raw fixed={false}>
              Answers changed after release
            </Chip>
            <ul className="m-0 grid list-none gap-0.5 p-0 text-[12.5px] text-ink-muted" aria-label="Changed answers">
              {staff.outOfDate.changes.slice(0, 4).map((c) => (
                <li key={c.key} className="truncate">
                  {c.label}: {c.after || 'Not given yet'}
                </li>
              ))}
            </ul>
            <Button size="sm" disabled={makingAgain || accepted} onClick={() => void onMakeAgain()}>
              <RefreshCw size={14} strokeWidth={1.6} aria-hidden />
              {makingAgain ? 'Making the draft…' : 'Make the draft again'}
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void openCompare()}>
            <GitCompare size={14} strokeWidth={1.6} aria-hidden />
            Compare versions
          </Button>
          {staff.canChangeTemplate && !accepted ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setVariant(noc.variant);
                setChangeOpen(true);
              }}
            >
              <Replace size={14} strokeWidth={1.6} aria-hidden />
              Change template
            </Button>
          ) : null}
        </div>
        {staff.canChangeTemplate && noc.foreignParent && !accepted ? (
          <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3 text-[13px] text-ink">
            <span>Notary and apostille steps</span>
            <Switch
              checked={!noc.notaryStepsOff}
              disabled={busy === 'notary_steps'}
              aria-label="Notary and apostille steps"
              onCheckedChange={(on) => {
                act({ action: 'notary_steps', off: !on }).catch((err) => onError(err instanceof Error ? err.message : 'Could not save'));
              }}
            />
          </div>
        ) : null}
      </div>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change template</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <FilterSelect aria-label="Template" options={VARIANT_OPTIONS} value={variant} onChange={(e) => setVariant(e.target.value)} />
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="Reason for the change"
              placeholder="Why does this project need another template?"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!reason.trim() || variant === noc.variant || busy === 'change_template'} onClick={() => void submitChange()}>
              Change template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Compare versions</DialogTitle>
          </DialogHeader>
          {versions ? (
            <VersionCompare versions={versions} labels={{ ...NOC_FIELD_LABEL, [NOC_VARIANT_FIELD]: 'Template' }} />
          ) : (
            <p className="text-[13px] text-ink-muted">Loading…</p>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

/** T5, T6: the receive checklist with Accept and Send back. */
export function NocReceiveCard({
  noc,
  busy,
  act,
  hasSignedCopy,
  onAccepted,
  onError,
}: {
  noc: NocState;
  busy: NocAction['action'] | null;
  act: (body: NocAction) => Promise<NocState>;
  hasSignedCopy: boolean;
  onAccepted: (next: NocState) => void;
  onError: (message: string) => void;
}) {
  const staff = noc.staff;
  if (!staff || !hasSignedCopy) return null;
  const accepted = noc.accepted;
  const acceptedStep = noc.track.find((s) => s.key === 'accepted');
  const run = (body: NocAction, then?: (n: NocState) => void) =>
    act(body)
      .then((n) => then?.(n))
      .catch((err) => onError(err instanceof Error ? err.message : 'Could not save'));

  return (
    <div className="grid gap-2">
      <ReceiveChecklist
        checks={staff.checks.map((c) => ({ key: c.key, label: c.label }))}
        ticked={staff.checks.filter((c) => c.ticked).map((c) => c.key)}
        onTick={(key, on) => void run({ action: 'check', key, ticked: on })}
        onAccept={() => void run({ action: 'accept' }, onAccepted)}
        onSendBack={(reason) => void run({ action: 'send_back', reason })}
        done={accepted}
        busy={busy !== null}
      />
      {noc.sentBack ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Sent back{noc.sentBack.byName ? ` by ${noc.sentBack.byName}` : ''} · {docDay(noc.sentBack.at)} · {noc.sentBack.reason}
        </p>
      ) : null}
      {accepted ? (
        <p className="m-0 text-[12.5px] text-ink-muted">
          Accepted{acceptedStep?.byName ? ` by ${acceptedStep.byName}` : ''}
          {acceptedStep?.at ? ` · ${docDay(acceptedStep.at)}` : ''}
          {staff.vaultDocumentId ? ' · Filed in Documents › Vault' : ''}
        </p>
      ) : null}
    </div>
  );
}

/** C8 for staff: the full decision tree (D5, the same part the client sees) and the evidence behind the template. */
export function NocWhyCard({ noc }: { noc: NocState }) {
  const ev = nocEvidence(noc.answers);
  const [replayKey, setReplayKey] = useState(0);
  const added = noc.foreignParent && !noc.notaryStepsOff;
  return (
    <section className="surface min-w-0 overflow-hidden" aria-label="Why VCFO chose this template">
      <CardHead
        title="Why VCFO chose this template"
        right={
          <Button variant="quiet" size="sm" onClick={() => setReplayKey((k) => k + 1)} aria-label="Replay the chosen path">
            <RotateCcw size={15} strokeWidth={1.6} aria-hidden />
            Replay
          </Button>
        }
      />
      <VariantTree answers={noc.answers} replayKey={replayKey} />
      <div className="p-4 pt-2">
        <EvidenceTable
          rows={ev.rows}
          result={
            <>
              <span>{noc.staff?.override ? `Changed by staff to ${noc.variantLabel}` : noc.variantLabel}</span>
              {added ? <Tag tone="prog">This choice adds 2 steps · Notarise · Apostille</Tag> : null}
            </>
          }
        />
      </div>
    </section>
  );
}
