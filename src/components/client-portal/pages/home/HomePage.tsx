'use client';

/**
 * Client portal v7 — Home (`/app/client/overview`).
 *
 * ≥ 700 px: the desktop / tablet board — v7_before (`.vh-b` grid) before COI,
 * v7_after (`.vh-a` grid) after COI (`usePortal().after`), cards staggered
 * (.stag, 0.04 s + 0.06 s per card). < 700 px: the phone board (mobile.html).
 * Pop-ups: step (v7p_step), compliance (v7p_compliance), timeline editor
 * (tl-editor.js / v7p_timeline_client), PAN/TAN reveal (credentials'
 * IdsRevealDialog), document viewer (documents' DocViewer).
 */
import { useCallback, useEffect, useState } from 'react';
import { BotSays } from '@/components/client-portal/shared';
import { DocViewer, type ViewerDoc } from '@/components/client-portal/pages/documents/DocViewer';
import { IdsRevealDialog } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import type { PortalStep } from '@/lib/client-portal/step-model';
import '../../css/home-base.css';
import '../../css/home-tle.css';
import '../../css/home-m.css';
import { useHome } from './useHome';
import { useNeedUpload } from './ui';
import { ActivityCard, AlertsCard, CurrentCard, DocsCard, GreetCard, NeedsCard, SbcCard } from './CardsA';
import { AreaCard, CompCard, IdsCard, NextCard, PostIncCard, RegCard, StepsCard, TimelineCard } from './CardsB';
import { CompliancePopup, StepPopup } from './Popups';
import { TimelineEditor } from './TimelineEditor';
import { MobileHome } from './MobileHome';
import { dLong, docUrl, type DocItem, type NeedRow } from './derive';

function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 699px)');
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

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

function Skeleton({ after }: { after: boolean }) {
  const card = (h: number, key: string) => (
    <div key={key} className="card" style={{ padding: 16, gap: 10 }} aria-hidden="true">
      <div className="sk" style={{ height: 14, width: '40%' }} />
      <div className="sk" style={{ height: h }} />
    </div>
  );
  return (
    <div className="cp-home" aria-busy="true">
      <div className={`vh-main ${after ? 'vh-a' : 'vh-b'}`}>
        <div className="stag vh-g">
          <div className="sk" style={{ height: 110, borderRadius: 10 }} />
        </div>
        <div className="vh-col vh-col-l">
          <div className="stag">{[card(220, 'a'), card(160, 'b'), card(160, 'c')]}</div>
        </div>
        <div className="vh-col vh-col-r">
          <div className="stag">{[card(180, 'd'), card(140, 'e'), card(160, 'f')]}</div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const h = useHome();
  const phone = usePhone();
  const skeleton = useSkeleton(h.loading);
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
  const upload = useCallback((n: NeedRow) => {
    if (n.requestId) pick(n.requestId, n.title);
    else if (n.href) h.portal.go(n.href);
  }, [pick, h.portal]);

  if (phone === null || (h.loading && !skeleton && !h.overview)) return <div className="cp-home" style={{ minHeight: '60vh' }} />;
  if (h.loading || skeleton) return phone ? <div className="cp-home-m"><div className="app sk"><main className="wrap"><section className="greet" /><section className="card t" style={{ height: 180 }} /><section className="card t" style={{ height: 240 }} /></main></div></div> : <Skeleton after={h.after} />;
  if (h.error) {
    return (
      <div className="cp-home">
        <div className="vh-main">
          <section className="card" style={{ padding: 16 }}>
            <BotSays action="" secondary={<button type="button" className="btn btn-o btn-s" style={{ height: 28 }} onClick={h.refetch}>Try again</button>}>
              We could not load your dashboard.
            </BotSays>
          </section>
        </div>
      </div>
    );
  }
  if (h.missing) {
    return (
      <div className="cp-home">
        <div className="vh-main">
          <section className="card" style={{ padding: 16 }}>
            <BotSays question="Why is there no active engagement?">No active engagement yet. Your SBC team sets it up and it shows here.</BotSays>
          </section>
        </div>
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

  const overlays = (
    <>
      {field}
      {step ? <StepPopup h={h} step={step} onClose={() => setStep(null)} onUpload={upload} onOpenDocs={openDocs} /> : null}
      {comp != null ? <CompliancePopup h={h} tab={comp} onClose={() => setComp(null)} /> : null}
      {editor && phases && h.engagementId ? (
        <TimelineEditor phases={phases} today={h.today} engagementId={h.engagementId} company={h.company} manager={h.manager} onClose={() => setEditor(false)} />
      ) : null}
      {reveal ? <IdsRevealDialog field={reveal} onClose={() => setReveal(null)} /> : null}
      {viewer ? <DocViewer docs={viewer.docs} index={viewer.i} onClose={() => setViewer(null)} onIndexChange={(i) => setViewer((v) => (v ? { ...v, i } : v))} /> : null}
    </>
  );

  if (phone) {
    return (
      <>
        <MobileHome h={h} phases={phases} onEditTimeline={() => setEditor(true)} onOpenDocs={openDocs} />
        {/* pop-ups need the Home page styles (.cp-home …) on phones too */}
        <div className="cp-home">{overlays}</div>
      </>
    );
  }

  const d = (n: number) => ({ animationDelay: `${(0.04 + n * 0.06).toFixed(2)}s` });
  const docsIdx = (i: number) => openDocs(h.docs, i);

  return (
    <div className="cp-home">
      {/* Client home (K-19): the greeting, then two independent columns, the left one
          wide and the right one 360px. Timeline and Steps come first on the left. */}
      <main className={`vh-main ${h.after ? 'vh-a' : 'vh-b'}`}>
        <div className="stag vh-g">
          <div style={d(0)}><GreetCard h={h} /></div>
        </div>
        <div className="vh-col vh-col-l">
          <div className="stag">
            <div style={d(1)}><TimelineCard h={h} phases={phases} onEdit={() => setEditor(true)} /></div>
            <div style={d(2)}><StepsCard h={h} /></div>
            <div style={d(3)}><NeedsCard h={h} onUpload={upload} /></div>
            {h.after ? (
              <>
                <div style={d(4)}><NextCard h={h} /></div>
                <div style={d(5)}><CompCard h={h} onOpen={setComp} /></div>
                <div style={d(6)}><AreaCard h={h} /></div>
                <div style={d(7)}><RegCard h={h} onProof={regProof} /></div>
                <div style={d(8)}><PostIncCard h={h} /></div>
              </>
            ) : (
              <div style={d(4)}><CurrentCard h={h} onStep={setStep} /></div>
            )}
          </div>
        </div>
        <div className="vh-col vh-col-r">
          <div className="stag">
            <div style={d(2)}><AlertsCard h={h} /></div>
            <div style={d(3)}><SbcCard h={h} /></div>
            {h.after ? <div style={d(4)}><IdsCard h={h} onReveal={setReveal} onCoi={coiOpen} /></div> : null}
            <div style={d(5)}><DocsCard h={h} onOpen={docsIdx} /></div>
            <div style={d(6)}><ActivityCard h={h} /></div>
          </div>
        </div>
      </main>
      {overlays}
    </div>
  );
}
