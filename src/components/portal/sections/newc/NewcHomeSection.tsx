'use client';

/**
 * New-client Overview (prototype newc_body.txt #nsec-home + a58b_newc.js
 * renderNewcHome): the company strip with its status pill and call to action,
 * "Where your incorporation is" (`.ntrack`, six stages over the real SPICe+
 * Part A / Part B / MCA steps), "What SBC prepares from your details" (the
 * board resolution and every incorporation draft per signer, with its state)
 * and Activity (the real engagement activity).
 *
 * The prototype's "Reset demo" link is not ported: there is no demo here.
 */
import type { KeyboardEvent } from 'react';
import { usePortal } from '../../runtime';
import { fmtL, todayIso, fmtStamp } from '../../dates';
import { Btn, SecHead, SecLoading } from '../../ui';
import { useStepActions } from '../incorporation/actions';
import { BOARD_LABEL, type DeclDoc, type NewcStage } from './model';
import { useNewc } from './useNewc';
import '../../css/95-newc.css';

const CHIP: Record<DeclDoc['state'], { cls: string; tip: string }> = {
  signed: { cls: 'nk-signed', tip: 'Signed copy received' },
  sign: { cls: 'nk-sign', tip: 'Shared with you · to sign' },
  prep: { cls: 'nk-prep', tip: 'Drafted · SBC is checking it' },
  todo: { cls: '', tip: 'Not drafted yet' },
};

function timeOf(at: string): string {
  try {
    return new Date(at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
  } catch {
    return '';
  }
}

export function NewcHomeSection() {
  const { go } = usePortal();
  const n = useNewc();
  const { openStepWizard } = useStepActions();
  const { shell, status, stages, decl, board, activity } = n;

  if (n.loading) return <SecLoading label="Loading your incorporation…" />;

  const openStage = (st: NewcStage) => {
    if (st.go) go(st.go);
    else if (st.focus) openStepWizard(st.focus.id);
  };
  const key = (st: NewcStage) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openStage(st);
    }
  };
  const me = shell?.me.name;

  return (
    <>
      <SecHead title="Overview" />
      <div className="glass co-strip">
        <div className="co-row">
          <span className="eyebrow">{fmtL(todayIso()).toUpperCase()}</span>
          <span className="sp" />
          <span className={'pill ' + status.pill}>{status.label}</span>
        </div>
        <h1>{shell?.companyName}</h1>
        <div className="sub2">{status.sub}</div>
        {status.cta ? (
          <div className="chips">
            <Btn cls="pri" ico="ne" onClick={() => go(status.cta!.go)}>
              {status.cta.label}
            </Btn>
          </div>
        ) : null}
      </div>

      {n.stage === 'skipped' ? null : (
      <section className="glass ntrack" aria-label="Where your incorporation is">
        {stages.map((st, i) => (
          <div
            key={st.key}
            className={'nt nt-go ' + st.state}
            role="button"
            tabIndex={0}
            title={st.steps.map((s) => `${s.title}: ${s.kind === 'done' ? 'done' : s.kind === 'you' || s.kind === 'prog' ? 'your turn' : s.kind === 'with' ? (s.owner === 'mca' ? 'with MCA' : 'with SBC') : 'not started'}`).join('\n')}
            onClick={() => openStage(st)}
            onKeyDown={key(st)}
          >
            <span className="nt-n">{st.state === 'done' ? '✓' : i + 1}</span>
            <b>{st.title}</b>
            <span className={'w w-' + st.who}>{st.who}</span>
          </div>
        ))}
      </section>
      )}

      <div className="nhome">
        {n.stage === 'skipped' ? null : (
        <section className="glass panel">
          <div className="ph">
            <h3>What SBC prepares from your details</h3>
          </div>
          <div className="ndir">
            <b>Board resolution</b>
            <div className="ndir-c">
              <span className={'kind ' + (board === 'done' || board === 'sent' ? 'nk-signed' : board === 'sign' || board === 'approve' ? 'nk-sign' : '')} title={BOARD_LABEL[board]}>
                BOARD RESOLUTION · {BOARD_LABEL[board].toUpperCase()}
              </span>
            </div>
          </div>
          {n.stage === 'pre' && !decl.signers.some((s) => s.key !== 'company') ? (
            <div className="ndir">
              <b>Each proposed director</b>
              <p className="small">DIR-2, DIR-8, INC-9 and the declarations are listed per director once your proposed directors (Part B) are on file.</p>
            </div>
          ) : null}
          {decl.signers.length ? (
            decl.signers.map((s) => (
              <div key={s.key} className={'ndir' + (s.key === 'company' ? ' nco' : '')}>
                <b>
                  {s.name}
                  <span className="small nsub">{s.sub}</span>
                </b>
                <div className="ndir-c">
                  {s.docs.map((d) => (
                    <span key={d.rowKey} className={'kind ' + CHIP[d.state].cls} title={`${d.label} · ${CHIP[d.state].tip}${d.optional ? ' · if needed' : ''}`}>
                      {d.state === 'signed' ? '✓ ' : ''}
                      {d.label}
                    </span>
                  ))}
                </div>
              </div>
            ))
          ) : null}
          <div className="nlegend small">
            <span>
              <i className="kind nk-sign" /> shared with you
            </span>
            <span>
              <i className="kind nk-prep" /> drafted
            </span>
            <span>
              <i className="kind nk-signed" /> signed copy in
            </span>
          </div>
        </section>
        )}

        <section className="glass panel">
          <div className="ph">
            <h3>Activity</h3>
          </div>
          {activity.length ? (
            activity.slice(0, 8).map((a) => (
              <div key={a.id} className="nl">
                <span className="nl-w">
                  {fmtStamp(a.at)} {timeOf(a.at)}
                </span>
                <b>{a.actorKind === 'firm' ? 'SBC' : a.actorKind === 'system' ? 'VCFO' : a.actorName === me ? 'You' : a.actorName.split(/\s+/)[0]}</b>
                <span>
                  {a.label}
                  {a.actorKind === 'firm' && a.actorName ? <em className="nl-by"> · {a.actorName}</em> : null}
                </span>
              </div>
            ))
          ) : (
            <p className="small">{n.homeLoading ? 'Loading…' : 'Nothing yet. Activity on your incorporation appears here.'}</p>
          )}
        </section>
      </div>
    </>
  );
}
