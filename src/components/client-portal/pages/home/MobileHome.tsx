'use client';

/**
 * Phone Home (< 700 px) — React port of prototype s/home/mobile.html with its
 * #after state: L1 skeleton (450 ms), stagger, count-up and draw-in, gold-tab
 * cards with (i), bottom sheets for every drill (rule 14 on mobile), the
 * upload sheet (Choose a file / Take a photo), the focus track (style E),
 * gantt, donut, IDs with reveal, registrations with ↗ / 📎, post-inc windows.
 * The board's own top bar, drawer, launcher and chat sheet are the shell's
 * (TopBar, Sidebar drawer, AskLauncher) in the real app.
 */
import { IdsRevealDialog } from '@/components/client-portal/pages/credentials/IdsRevealDialog';
import { StaggerSlot } from './MobileParts';
import { useMobileHome, type MobileHomeProps } from './useMobileHome';
import { createMobileCardsA } from './MobileCardsA';
import { createMobileCardsB } from './MobileCardsB';

export function MobileHome(props: MobileHomeProps) {
  const state = useMobileHome(props);
  const cardsA = createMobileCardsA(state);
  const cardsB = createMobileCardsB({ ...state, ...cardsA });
  const {
    after,
    ready,
    drawn,
    sheet,
    xRef,
    closeSheet,
    fileRef,
    upTarget,
    reveal,
    setReveal,
    uploadFile,
  } = state;
  const {
    greet,
    needsCard,
    holdsCard,
    timelineCard,
    alertsCard,
    sbcCard,
  } = cardsA;
  const {
    nextCard,
    compCard,
    idsCard,
    regsCard,
    postCard,
    docsCard,
    actCard,
  } = cardsB;

  const cards = after
    ? [needsCard, nextCard, compCard, idsCard, regsCard, postCard, sbcCard, timelineCard, docsCard, actCard]
    : [needsCard, holdsCard, timelineCard, alertsCard, sbcCard, docsCard, actCard];

  return (
    <div className="cp-home-m">
      <div className={`app${ready ? '' : ' sk'}`}>
        <main className="wrap">
          {[greet, ...cards].map((c, i) => (
            <StaggerSlot key={i} i={i} drawn={drawn}>
              {c}
            </StaggerSlot>
          ))}
        </main>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          const n = upTarget.current;
          if (f && n?.requestId) {
            closeSheet();
            void uploadFile(n, f);
          }
        }}
      />
      <div className={`scrim${sheet ? ' on' : ''}`} role="presentation" onClick={closeSheet} />
      <section className={`sheet${sheet ? ' on' : ''}`} role="dialog" aria-modal="true" aria-labelledby="m-shT" aria-hidden={!sheet}>
        <div className="grab">
          <i />
        </div>
        <div className="sh">
          <h3 id="m-shT">{sheet?.title}</h3>
          <button ref={xRef} className="ib" type="button" aria-label="Close" onClick={closeSheet}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="body">{sheet?.body}</div>
      </section>
      {reveal ? <IdsRevealDialog field={reveal} onClose={() => setReveal(null)} /> : null}
    </div>
  );
}
