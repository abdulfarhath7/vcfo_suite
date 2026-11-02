'use client';

/**
 * BOARD RESOLUTION (NOC) — /app/manager/projects/[slug]/board-resolution and
 * /app/intern/projects/[slug]/board-resolution (manager and project lead). The
 * live editor (src/views/intern/BoardResolutionEditor.tsx with
 * useBoardResolutionEditorState and BoardResolutionEditorView: generate from
 * Pre-1, edit, apply the template, send to the manager, approve / send back,
 * finalise, send to client, the signed copy) is mounted unchanged inside the
 * console frame, in the Tailwind island. That view already carries the NOC
 * staff cards (src/views/intern/board-resolution-noc: the 6- or 4-step track,
 * the receive checklist with Accept and Send back, the Notarised / Apostilled
 * ticks for a foreign parent, the Template card with Change template, the
 * notary-steps switch and Compare versions, and the decision tree), so the
 * console adds only its own head: the client tile, the NOC variant and the
 * step words from `GET .../board-resolution/noc`.
 *
 * Live links reach it from the Pre-2 / Pre-3 step pages, the client overview,
 * notifications and emails (the old /app/intern/engagements/… path redirects
 * here).
 */
import BoardResolutionEditor from '@/views/intern/BoardResolutionEditor';
import { useNocState } from '@/views/intern/board-resolution-noc/useNocState';
import { useRealtimeBoardResolution } from '@/hooks/use-realtime-board-resolution';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, ClientAv, Icon } from '../../ui';
import { companyInitials, stepCode } from './model';
import { nocHeadStatus, nocHeadVariant } from './noc-head';
import { dShort, Island, NotFound, useClientPaths, useClientSeat, useRouteEngagement } from './shared';

export function BoardResolutionPage() {
  const paths = useClientPaths();
  const seat = useClientSeat();
  const { go } = useConsole();
  const { eng, settled } = useRouteEngagement();
  useCrumbs(['Clients', eng?.companyName ?? '…', 'Board resolution']);
  // The head reads the same state the cards inside the island read. The island's actions (tick,
  // Accept, Send back, Change template) update its own copy; the visibility-aware poll the live
  // editor already uses brings the head up to date.
  const { noc, reload } = useNocState(eng?.id, eng?.id ?? '');
  useRealtimeBoardResolution({ appEngagementId: eng?.id, onRemoteChange: () => void reload() });
  const status = nocHeadStatus(noc, dShort);
  const variant = nocHeadVariant(noc);
  if (!eng) return <NotFound settled={settled} />;
  return (
    <>
      <section className="glass mx-ch">
        <div className="mx-chl">
          <button type="button" className="ib" aria-label={`Back to ${eng.companyName}`} title={`Back to ${eng.companyName}`} onClick={() => go(paths.project(eng))}>
            <Icon name="back" />
          </button>
          <ClientAv id={eng.id} label={companyInitials(eng.companyName)} big />
          <div className="cx-chm">
            <span className="eyebrow cx-ell" title={`${eng.companyName} · ${stepCode('pre-2')} and ${stepCode('pre-3')}`}>
              {`${eng.companyName} · ${stepCode('pre-2')} · ${stepCode('pre-3')}`}
            </span>
            <h2>Board resolution (NOC)</h2>
            <div className="mx-chips">
              {variant ? (
                <span className="pill mut" title={noc?.parentName ? `Passed by the board of ${noc.parentName} (the parent)` : 'The NOC template this project uses'}>
                  <Icon name="doc" />
                  {variant}
                </span>
              ) : null}
              {status ? (
                <span className={'pill ' + status.kind} title="Where the document stands, from its stored record">
                  <Icon name={status.icon} />
                  {status.text}
                </span>
              ) : null}
              {noc?.version ? (
                <span className="pill mut" title="The latest draft version SBC made">
                  Version {noc.version}
                </span>
              ) : null}
            </div>
            <span className="small">
              {seat === 'lead'
                ? 'Draft it from Pre-1, edit it here, send it to your manager; once released the client signs it and you check the signed copy'
                : 'The lead drafts it from Pre-1; you approve or send it back, release it to the client, and the team checks the signed copy'}
            </span>
          </div>
        </div>
        <div className="mx-chr">
          <Btn cls="sm" ico="step" onClick={() => go(paths.step(eng, 'pre-2'))}>
            Open step {stepCode('pre-2')}
          </Btn>
          <Btn cls="sm" ico="step" onClick={() => go(paths.step(eng, 'pre-3'))}>
            Open step {stepCode('pre-3')}
          </Btn>
        </div>
      </section>
      <section className="glass panel mx-p">
        <Island cls="cx-br">
          <BoardResolutionEditor />
        </Island>
      </section>
    </>
  );
}
