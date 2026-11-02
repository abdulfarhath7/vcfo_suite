'use client';

/**
 * BOARD RESOLUTION — /app/intern/projects/[slug]/board-resolution (project
 * lead). The live editor (src/views/intern/BoardResolutionEditor.tsx with
 * useBoardResolutionEditorState, BoardResolutionEditorView and the doc panel:
 * generate from Pre-1, edit, apply the template, send to the manager, finalise,
 * the signed copy) mounted unchanged inside the console frame, in the Tailwind
 * island. Live links reach it from the Pre-2 step (BoardResolutionStepLink),
 * notifications and emails through the old /app/intern/engagements/… path,
 * which redirects here.
 */
import BoardResolutionEditor from '@/views/intern/BoardResolutionEditor';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn, ClientAv, Icon } from '../../ui';
import { companyInitials, stepCode } from './model';
import { Island, NotFound, useClientPaths, useRouteEngagement } from './shared';

export function BoardResolutionPage() {
  const paths = useClientPaths();
  const { go } = useConsole();
  const { eng, settled } = useRouteEngagement();
  useCrumbs(['Clients', eng?.companyName ?? '…', 'Board resolution']);
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
            <span className="eyebrow cx-ell">{`${eng.companyName} · ${stepCode('pre-2')}`}</span>
            <h2>Board resolution</h2>
            <span className="small">Draft it from Pre-1, edit it here, send it to your manager; once finalised the client sees it</span>
          </div>
        </div>
        <div className="mx-chr">
          <Btn cls="sm" ico="step" onClick={() => go(paths.step(eng, 'pre-2'))}>
            Open the step
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
