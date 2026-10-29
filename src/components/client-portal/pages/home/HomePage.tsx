'use client';

/**
 * Client portal Home (`/app/client/overview`), VCFO Spectrum (prototype
 * src/screens/client/HomeScreen.tsx). The home card (R-17), then two columns: the wide one
 * with the ST5 steps card and the Gantt timeline, the 360px one with what the client owes and
 * who holds the work. After the COI the compliance cards join and Registrations runs full
 * width. Below 1024px the columns dissolve and `order` sets the phone card order, so phones
 * show the same cards at 390px.
 *
 * "Message <lead>" (MessagesCard, G-09) sits under What SBC is doing.
 *
 * Pop-ups: step (StepPopup), compliance (CompliancePopup), the timeline editor, the PAN/TAN
 * reveal (credentials' IdsRevealDialog) and the document viewer (documents' DocViewer).
 */
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, SkeletonRows } from '@/components/ui/empty-state';
import { DocViewer, type ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import { IdsRevealDialog } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import { phaseHref } from '@/components/client-portal/routes';
import type { PortalStep } from '@/lib/client-portal/step-model';
import '../../css/home-base.css';
import '../../css/home-tle.css';
import '../../css/home-m.css';
import { Island, St5Card } from '../incorporation/spectrum';
import { useHome } from './useHome';
import { useDownload, useNeedUpload } from './ui';
import { ActivityCard, AlertsCard, DocsCard, HoldsCard, HomeCard, NeedsCard, SbcCard } from './CardsA';
import { AreaCard, CompCard, IdsCard, NextCard, PostIncCard, RegCard, TimelineCard } from './CardsB';
import { CompliancePopup, StepPopup } from './Popups';
import { TimelineEditor } from './TimelineEditor';
import { MessagesCard } from './MessagesCard';
import { dLong, docUrl, type DocItem, type NeedRow } from './derive';

/** L1 skeleton: shown after 150 ms, held at least 300 ms. */
function useSkeleton(loading: boolean): boolean {
  const [show, setShow] = useState(false);
  const [since, setSince] = useState<number | null>(null);
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        setShow(true);
        setSince(Date.now());
      }, 150);
      return () => clearTimeout(t);
    }
    if (show && since) {
      const left = Math.max(0, 300 - (Date.now() - since));
      const t = setTimeout(() => setShow(false), left);
      return () => clearTimeout(t);
    }
  }, [loading, show, since]);
  return show;
}

function toViewer(d: DocItem, company: string): ViewerDoc {
  return {
    id: d.id,
    name: d.name,
    url: () => docUrl(d),
    contentType: d.contentType ?? null,
    sizeBytes: d.sizeBytes ?? null,
    uploadedAt: d.date,
    uploadedBy: d.from === 'client' ? company : 'SBC',
    meta: `From ${d.from === 'client' ? company : 'SBC'}${d.date ? ` · ${dLong(d.date)}` : ''}`,
  };
}

/** The page frame: 16px side gutter on phones, the board's clamp padding above. */
const FRAME = 'mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-5 px-4 py-4 sm:p-[clamp(12px,2vw,24px)]';
const COLS = 'grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] max-lg:contents';
const COL = 'grid min-w-0 grid-cols-1 gap-5 max-lg:contents';

/** R-48: loading shows grey shapes. */
function Skeleton() {
  return (
    <div className="cp-home" aria-busy="true">
      <Island className={FRAME}>
        <span className="block h-[180px] animate-pulse rounded-md bg-surface-sunken" aria-hidden />
        <div className={COLS.replace(' max-lg:contents', '')}>
          <SkeletonRows rows={6} />
          <SkeletonRows rows={5} />
        </div>
      </Island>
    </div>
  );
}

export function HomePage() {
  const h = useHome();
  const skeleton = useSkeleton(h.loading);
  const download = useDownload();
  const { pick, field } = useNeedUpload();
  const [step, setStep] = useState<PortalStep | null>(null);
  const [comp, setComp] = useState<number | null>(null);
  const [editor, setEditor] = useState(false);
  const [reveal, setReveal] = useState<'pan' | 'tan' | null>(null);
  const [viewer, setViewer] = useState<{ docs: ViewerDoc[]; i: number } | null>(null);

  // route `home-chat` (#chat): open the Ask VCFO chat 500 ms after load
  const { openChat } = h.portal;
  useEffect(() => {
    if (!/chat/.test(window.location.hash)) return;
    const t = setTimeout(() => openChat(), 500);
    return () => clearTimeout(t);
  }, [openChat]);

  const openDocs = useCallback((docs: DocItem[], i: number) => setViewer({ docs: docs.map((d) => toViewer(d, h.company)), i }), [h.company]);
  const upload = useCallback(
    (n: NeedRow) => {
      if (n.requestId) pick(n.requestId, n.title);
      else if (n.href) h.portal.go(n.href);
    },
    [pick, h.portal],
  );

  if (h.loading && !skeleton && !h.overview) return <div className="cp-home" style={{ minHeight: '60vh' }} />;
  if (h.loading || skeleton) return <Skeleton />;
  if (h.error || h.missing) {
    return (
      <div className="cp-home">
        <Island className={FRAME}>
          {h.error ? (
            <EmptyState
              title="Your dashboard did not load"
              action={
                <Button size="sm" variant="secondary" onClick={h.refetch}>
                  Try again
                </Button>
              }
            />
          ) : (
            <EmptyState title="No active engagement yet" />
          )}
        </Island>
      </div>
    );
  }

  const phases = h.timeline;
  const coiDoc = h.overview?.documents.deliverables.find((d) => d.id === 'pre-12:certificateOfIncorporationFinalUrl');
  const coiOpen = coiDoc
    ? () => openDocs([{ id: coiDoc.id, name: coiDoc.name, type: 'PDF', date: coiDoc.issuedAt?.slice(0, 10), from: 'firm', kind: 'milestone', ref: coiDoc.storagePath }], 0)
    : undefined;
  const regProof = (r: { certPath?: string; certName?: string; step: PortalStep }) =>
    r.certPath && openDocs([{ id: `${r.step.id}:cert`, name: r.certName ?? r.step.title, type: 'PDF', from: 'firm', kind: 'milestone', ref: r.certPath }], 0);
  const docsIdx = (i: number) => openDocs(h.docs, i);
  const st5 = (cls: string) => (
    <St5Card
      model={h.model}
      company={h.company}
      lead={h.lead}
      link={{ label: 'All steps', onClick: () => h.portal.go('incorporation') }}
      onPhase={(no) => h.portal.go(phaseHref(no))}
      onStep={setStep}
      className={cls}
    />
  );

  return (
    <div className="cp-home">
      <Island className={FRAME}>
        <HomeCard h={h} onUpload={upload} />
        {h.after ? (
          <>
            <div className={COLS}>
              <div className={COL}>
                {st5('max-lg:order-3')}
                <TimelineCard h={h} phases={phases} onEdit={() => setEditor(true)} className="max-lg:order-[9]" />
                <AreaCard h={h} className="max-lg:order-[8]" />
                <PostIncCard h={h} className="max-lg:order-6" />
                <DocsCard h={h} onOpen={docsIdx} onDownload={(d) => void download(d)} className="max-lg:order-[11]" />
                <ActivityCard h={h} className="max-lg:order-[13]" />
              </div>
              <div className={COL}>
                <NeedsCard h={h} onUpload={upload} className="max-lg:order-1" />
                <NextCard h={h} className="max-lg:order-2" />
                <CompCard h={h} onOpen={setComp} className="max-lg:order-4" />
                <IdsCard h={h} onReveal={setReveal} onCoi={coiOpen} className="max-lg:order-5" />
                <AlertsCard h={h} className="max-lg:order-[10]" />
                <SbcCard h={h} className="max-lg:order-[12]" />
                <MessagesCard engagementId={h.engagementId} lead={h.lead} today={h.today} className="max-lg:order-[14]" />
              </div>
            </div>
            <RegCard h={h} onProof={regProof} className="max-lg:order-7" />
          </>
        ) : (
          <div className={COLS}>
            <div className={COL}>
              {st5('max-lg:order-2')}
              <TimelineCard h={h} phases={phases} onEdit={() => setEditor(true)} className="max-lg:order-5" />
              <DocsCard h={h} onOpen={docsIdx} onDownload={(d) => void download(d)} className="max-lg:order-6" />
              <ActivityCard h={h} className="max-lg:order-8" />
            </div>
            <div className={COL}>
              <NeedsCard h={h} onUpload={upload} className="max-lg:order-1" />
              <HoldsCard h={h} className="max-lg:order-3" />
              <AlertsCard h={h} className="max-lg:order-4" />
              <SbcCard h={h} className="max-lg:order-7" />
              <MessagesCard engagementId={h.engagementId} lead={h.lead} today={h.today} className="max-lg:order-9" />
            </div>
          </div>
        )}
      </Island>
      {field}
      {step ? <StepPopup h={h} step={step} onClose={() => setStep(null)} onUpload={upload} onOpenDocs={openDocs} /> : null}
      {comp != null ? <CompliancePopup h={h} tab={comp} onClose={() => setComp(null)} /> : null}
      {editor && phases && h.engagementId ? (
        <TimelineEditor phases={phases} today={h.today} engagementId={h.engagementId} company={h.company} manager={h.manager} onClose={() => setEditor(false)} />
      ) : null}
      {reveal ? <IdsRevealDialog field={reveal} onClose={() => setReveal(null)} /> : null}
      {viewer ? <DocViewer docs={viewer.docs} index={viewer.i} onClose={() => setViewer(null)} onIndexChange={(i) => setViewer((v) => (v ? { ...v, i } : v))} /> : null}
    </div>
  );
}
