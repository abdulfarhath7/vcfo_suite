'use client';

/**
 * DOCUMENTS — /app/manager/projects/[slug]/documents (prototype mxClientDocs):
 * the pre-incorporation document pack. The live pack page
 * (src/views/engagement/DocPackView.tsx) in the console's look, with the same
 * data and the same files: readiness per document (ready / needs inputs /
 * waiting for release), the inputs still missing with a link to the field,
 * what a document waits on, Preview (rendered by the route that downloads it),
 * Download as Word, and Download ready as .zip. Staff only (the API answers
 * 403 to clients).
 */
import { useEffect, useMemo, useState } from 'react';
import { getItem } from '@/data/checklist';
import type { Engagement } from '@/data/engagements';
import { IncorporationDocxPreview } from '@/components/incorporation/IncorporationDocxPreview';
import { useDocPack } from '@/hooks/use-doc-pack';
import { docPackRowName } from '@/lib/doc-pack/labels';
import { DOC_PACK_PART_PARAM, docPackItemUrl, docPackStepPath, docPackZipUrl, parseDocPart } from '@/lib/doc-pack/paths';
import type { DocPackItem, DocPart, DocStatus } from '@/lib/doc-pack/types';
import { missingInputLabel } from '@/lib/doc-pack/unblock';
import { useConsole, useCrumbs } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, ClientAv, Icon, Seg } from '../../ui';
import { companyInitials, plural } from './model';
import { dShort, Island, NotFound, useRouteEngagement, useClientPaths } from './shared';

type PartFilter = 'all' | DocPart;
type StatusFilter = 'any' | DocStatus;

const STATUS: Record<DocStatus, { label: string; pill: 'done' | 'due' | 'mut'; tip: string }> = {
  ready: { label: 'Ready', pill: 'done', tip: 'Every input is in; download it as Word' },
  'needs-inputs': { label: 'Needs inputs', pill: 'due', tip: 'A field the document reads is still empty' },
  'waiting-release': { label: 'Waiting for release', pill: 'mut', tip: 'Waits for the board resolution to be finalised or the directors to be accepted' },
};

const stepTitle = (id: string) => getItem(id)?.title ?? id;

export function ClientDocsPage() {
  const { eng, settled } = useRouteEngagement();
  useCrumbs(['Clients', eng?.companyName ?? '…', 'Documents']);
  if (!eng) return <NotFound settled={settled} />;
  return <Docs key={eng.id} eng={eng} />;
}

function Docs({ eng }: { eng: Engagement }) {
  const paths = useClientPaths();
  const { go, openModal } = useConsole();
  const pack = useDocPack(eng.id);
  const [part, setPart] = useState<PartFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('any');
  useEffect(() => {
    const p = parseDocPart(new URLSearchParams(window.location.search).get(DOC_PACK_PART_PARAM));
    if (p) setPart(p);
  }, []);
  const s = pack.data;
  const items = useMemo(() => (s?.items ?? []).filter((i) => (part === 'all' || i.part === part) && (status === 'any' || i.status === status)), [s, part, status]);
  const countFor = (f: PartFilter) => (s ? s.items.filter((i) => f === 'all' || i.part === f).length : 0);
  const stepHref = (stepId: string, tabId?: string) => paths.step(eng, stepId, tabId);
  const preview = (item: DocPackItem) => openModal(<DocPreview eng={eng} item={item} />, { cls: 'wide cx-docm', label: docPackRowName(item) });
  const toggle = (st: DocStatus) => setStatus((cur) => (cur === st ? 'any' : st));

  return (
    <>
      <section className="glass mx-ch">
        <div className="mx-chl">
          <button type="button" className="ib" aria-label={`Back to ${eng.companyName}`} title={`Back to ${eng.companyName}`} onClick={() => go(paths.project(eng))}>
            <Icon name="back" />
          </button>
          <ClientAv id={eng.id} label={companyInitials(eng.companyName)} big />
          <div className="cx-chm">
            <span className="eyebrow cx-ell">{eng.companyName}</span>
            <h2>Pre-incorporation documents</h2>
            <div className="mx-dsum">
              {(['ready', 'needs-inputs', 'waiting-release'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={'pill cx-pbtn ' + STATUS[st].pill + (status === st ? ' cx-on' : '')}
                  aria-pressed={status === st}
                  title={`${STATUS[st].tip} · click to ${status === st ? 'show every document' : 'show only these'}`}
                  onClick={() => toggle(st)}
                >
                  <b>{s ? s.counts[st] : '·'}</b> {st === 'ready' ? 'ready' : st === 'needs-inputs' ? 'need inputs' : 'waiting for release'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mx-chr">
          <Seg<PartFilter>
            ariaLabel="Filter by part"
            value={part}
            onChange={setPart}
            options={[
              { value: 'all', label: 'All', n: countFor('all') },
              { value: 'part-a', label: 'SPICe+ Part A', n: countFor('part-a') },
              { value: 'part-b', label: 'Part B', n: countFor('part-b') },
            ]}
          />
          {s && s.counts.ready > 0 ? (
            <a className="btn sm pri" href={docPackZipUrl(eng.id)} download>
              <Icon name="dl" />
              {`Download ready (${s.counts.ready}) as .zip`}
            </a>
          ) : (
            <button type="button" className="btn sm" disabled title="Nothing is ready to download yet">
              <Icon name="dl" />
              Download ready (0) as .zip
            </button>
          )}
        </div>
      </section>

      <section className="glass panel mx-p">
        <div className="ph">
          <div className="mx-pt">
            <h3>{part === 'all' ? 'The pack' : part === 'part-a' ? 'SPICe+ Part A' : 'SPICe+ Part B'}</h3>
            <span className="small">Generated from SPICe+ Part A and Part B answers. Regenerates on every download unless a version was attached to KYC Review &amp; DSC.</span>
          </div>
        </div>
        {s && s.skippedDirectors.length > 0 ? (
          <div className="banner info cx-banner">
            <Icon name="alert" />
            <div>
              <b>Not in the pack yet: {s.skippedDirectors.map((d) => d.displayName).join(', ')}</b>
              <span>
                {s.skippedDirectors[0]?.reason}.{' '}
                <button type="button" className="link cx-inl" onClick={() => go(stepHref('pre-15'))}>
                  Proposed Directors
                </button>
              </span>
            </div>
          </div>
        ) : null}
        {pack.isError ? (
          <div className="sec-err">
            <Icon name="alert" />
            <span>{pack.error instanceof Error ? pack.error.message : 'The readiness check failed.'}</span>
            <span className="sp" />
            <button type="button" className="btn sm" onClick={() => void pack.refetch()}>
              Try again
            </button>
          </div>
        ) : !s ? (
          <div className="sec-load">Checking the pack…</div>
        ) : !items.length ? (
          <div className="mx-empty">
            <Icon name="check" />
            <b>No documents match</b>
            <span>Switch the filter to see the rest of the pack.</span>
          </div>
        ) : (
          <div className="cx-scroll">
            <div className="mx-table mx-dt2 cx-dt2">
              <div className="mx-th">
                <span>Document</span>
                <span>Step and condition</span>
                <span>Generated</span>
                <span>Status</span>
                <span />
              </div>
              {items.map((item) => (
                <DocRow key={item.key} eng={eng} item={item} stepHref={stepHref} onPreview={preview} />
              ))}
            </div>
          </div>
        )}
        {s ? <p className="small cx-tail">{`${plural(s.total, 'document')} in the pack · ${s.counts.ready} ready to download`}</p> : null}
      </section>
    </>
  );
}

function DocRow({
  eng,
  item,
  stepHref,
  onPreview,
}: {
  eng: Engagement;
  item: DocPackItem;
  stepHref: (stepId: string, tabId?: string) => string;
  onPreview: (item: DocPackItem) => void;
}) {
  const { go } = useConsole();
  const ready = item.status === 'ready';
  const name = docPackRowName(item);
  const provenance = !ready
    ? null
    : item.source === 'attached'
      ? item.docId === 'board-resolution'
        ? 'Finalised board resolution'
        : 'Attached to KYC Review & DSC'
      : 'Generated now from the answers';
  return (
    <div className="mx-tr static">
      <span className="mx-tc1">
        <span className="cx-docn">
          <span className="mx-ft2 docx">docx</span>
          <b className="cx-ell" title={name}>
            {name}
          </b>
        </span>
        <span className="small cx-ell" title={`from ${item.sourceStepIds.map(stepTitle).join(' · ')}`}>
          from {item.sourceStepIds.map(stepTitle).join(' · ')}
        </span>
      </span>
      <span className="cx-cond">
        {provenance ? <span className="small">{provenance}</span> : null}
        {item.missing.length ? (
          <span className="cx-miss">
            {item.missing.map((m) => (
              <button key={m.key} type="button" className="cx-mchip" title={`Open ${stepTitle(m.stepId)} at this field`} onClick={() => go(stepHref(m.stepId, m.tabId))}>
                {missingInputLabel(m)}
                <span>in {stepTitle(m.stepId)}</span>
              </button>
            ))}
          </span>
        ) : null}
        {item.blockedBy ? (
          <span className="small">
            {item.blockedBy.gate === 'br-finalized' ? 'Opens once the board resolution is finalised in ' : `${item.blockedBy.label} in `}
            <button type="button" className="link cx-inl" onClick={() => go(stepHref(item.blockedBy!.stepId))}>
              {stepTitle(item.blockedBy.stepId)}
            </button>
          </span>
        ) : null}
      </span>
      <span className="small cx-num">{ready ? (item.attachedAt ? dShort(item.attachedAt.slice(0, 10)) : 'On download') : '—'}</span>
      <span>
        <span className={'pill ' + STATUS[item.status].pill} title={STATUS[item.status].tip}>
          {item.status === 'waiting-release' ? <Icon name="lock" /> : item.status === 'ready' ? <Icon name="check" /> : null}
          {STATUS[item.status].label}
        </span>
      </span>
      <span className="mx-moves">
        <Btn cls="sm" ico="eye" disabled={!ready} onClick={() => onPreview(item)} ariaLabel={`Preview ${name}`}>
          Preview
        </Btn>
        {ready ? (
          <a className="btn sm" href={docPackItemUrl(eng.id, item.key)} download aria-label={`Download ${name} as Word`}>
            <Icon name="dl" />
            Download as Word
          </a>
        ) : (
          <button type="button" className="btn sm" disabled title="Ready once its inputs are in">
            <Icon name="dl" />
            Download as Word
          </button>
        )}
      </span>
    </div>
  );
}

function DocPreview({ eng, item }: { eng: Engagement; item: DocPackItem }) {
  const paths = useClientPaths();
  const { go, closeModal } = useConsole();
  const name = docPackRowName(item);
  const first = item.sourceStepIds[0];
  return (
    <ModalBody
      title={name}
      sub={item.source === 'attached' ? 'The file stored for this document.' : 'Rendered now from the checklist answers.'}
      foot={
        <>
          {first ? (
            <Btn
              ico="step"
              onClick={() => {
                closeModal();
                go(paths.step(eng, first));
              }}
            >
              Open step
            </Btn>
          ) : null}
          <span className="sp" />
          <a className="btn pri" href={docPackItemUrl(eng.id, item.key)} download>
            <Icon name="dl" />
            Download as Word
          </a>
        </>
      }
    >
      <Island cls="cx-docv">
        <IncorporationDocxPreview downloadUrl={docPackItemUrl(eng.id, item.key, true)} previewLabel={name} refreshKey={item.key} />
      </Island>
    </ModalBody>
  );
}
