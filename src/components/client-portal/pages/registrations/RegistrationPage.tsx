'use client';

/**
 * One registration (VCFO Spectrum RegistrationScreen): the record head (status, area,
 * owner, the due or done date and the stored number), the step's parts as ST5 marks from
 * the client's own answers, the registration details stored on the credentials workbook,
 * the documents the step needs, About, and the filings it starts on the client's register.
 * The client acts on the incorporation step page, so "Open step" goes there.
 */
import { useMemo } from 'react';
import { StepMark } from '@/components/ui/step-track';
import { Button } from '@/components/ui/button';
import { SkeletonRows } from '@/components/ui/empty-state';
import { clientIncorporationStepPath } from '@/lib/projects/project-step-path';
import { fmtDMY, todayIso } from '@/lib/client-portal/compliances';
import { usePortal, usePortalCrumbs } from '../../PortalProvider';
import { usePortalIncorporation } from '../../hooks';
import { portalHref } from '../../routes';
import { subList } from '../incorporation/data';
import { useAllFilings } from '../compliances/api';
import { groupObligations } from '../compliances/obligations';
import { obligationHref } from '../compliances/ObligationsPage';
import { Empty, FactRows, GoLink, Island, ListRow, RecordHead, SCard, StatusChip, WordPill } from '../compliances/spectrum';
import { buildRegistrations, startsFilings, type RegItem } from './model';
import { REGISTRATIONS_BASE, RegChip, RegOwner, useRegCredentials } from './parts';
import '../../css/compliances-board.css';

const HOLDER: Record<RegItem['owner'], string> = { client: 'You', sbc: 'SBC', mca: 'MCA' };

export function RegistrationRecordPage({ id }: { id: string }) {
  const { model, loading } = usePortalIncorporation();
  const creds = useRegCredentials();
  const r = useMemo(() => buildRegistrations(model, creds.data).find((x) => x.id === id || x.stepId === id) ?? null, [model, creds.data, id]);
  usePortalCrumbs(['Registrations', r?.name ?? 'Registration']);
  const back = (
    <GoLink href={REGISTRATIONS_BASE} className="text-[13px] font-medium text-brand-text hover:underline">
      All registrations
    </GoLink>
  );
  return (
    <div className="cp-compliances">
      <div className="cp-comp-root page">
        <Island className="grid gap-5">
          {loading ? (
            <div aria-busy="true" aria-label="Loading the registration">
              <SkeletonRows rows={6} />
            </div>
          ) : !r ? (
            <SCard title="Registration">
              <Empty action={back}>Not on your checklist</Empty>
            </SCard>
          ) : (
            <Record r={r} credsError={creds.isError} credsLoading={creds.isLoading} />
          )}
        </Island>
      </div>
    </div>
  );
}

function Record({ r, credsError, credsLoading }: { r: RegItem; credsError: boolean; credsLoading: boolean }) {
  const { go, openChat, after } = usePortal();
  const today = todayIso();
  const parts = subList(r.step);
  const filings = useAllFilings(after && Boolean(startsFilings(r.stepId)));
  const starts = useMemo(() => {
    const rule = startsFilings(r.stepId);
    if (!rule) return [];
    return groupObligations(filings.data?.rows ?? [], today).filter((o) => o.area === rule.area && (!rule.name || rule.name.test(`${o.name} ${o.particular}`)));
  }, [filings.data, r.stepId, today]);
  const date = r.status === 'Done' ? r.doneOn : r.due;
  const numberEmpty = credsLoading ? 'Loading' : credsError ? 'Could not load' : 'Not stored yet';

  const actions = (
    <>
      {r.step.canOpen ? <Button onClick={() => go(clientIncorporationStepPath(r.step.item))}>Open step</Button> : null}
      <Button variant="secondary" onClick={() => go(portalHref('credentials'))}>
        Credentials
      </Button>
    </>
  );

  return (
    <>
      <RecordHead
        title={r.name}
        sub={
          <>
            {r.forms.length ? <span className="font-mono text-[13px]">{r.forms.join(' · ')}</span> : null}
            {r.forms.length ? ' · ' : ''}
            {r.group} · step {r.n} of the registration phase
          </>
        }
        chips={
          <>
            <RegChip r={r} />
            <WordPill word={r.area} />
            <RegOwner r={r} />
          </>
        }
        facts={[
          { k: r.status === 'Done' ? 'Done' : 'Due', v: date ? fmtDMY(date) : '-', tone: r.status === 'Overdue' ? 'bad' : undefined },
          { k: 'Number', v: r.number ? <span className="font-mono text-[13px]">{r.number}</span> : '-' },
        ]}
        actions={actions}
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-4">
          {!r.notNeeded ? (
            <SCard title="Steps" meta={`${parts.filter((p) => p.s === 'done').length} of ${parts.length} done`} flush>
              <ol>
                {parts.map((p, i) => (
                  <li key={`${p.l}-${i}`} className={`grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-3 border-t border-line-soft px-4 py-2.5 first:border-t-0 md:px-5${p.s === 'now' ? ' bg-surface-sunken' : ''}`}>
                    <StepMark state={p.s === 'done' ? 'done' : p.s === 'now' ? 'now' : 'next'} tone={r.step.kind === 'you' ? 'teal' : 'prog'} label={p.s === 'done' ? 'Done' : p.s === 'now' ? 'Now' : 'Upcoming'} />
                    <span className="min-w-0">
                      <b className={`block truncate text-[14px] font-medium ${p.s === 'todo' ? 'font-normal text-ink-muted' : 'text-ink'}`}>{p.l}</b>
                      {p.s === 'now' ? (
                        <small className={`block truncate text-[12.5px] ${r.step.kind === 'you' ? 'text-waiting' : 'text-brand-text'}`}>With {r.step.kind === 'you' ? 'you' : r.owner === 'mca' ? 'MCA' : 'SBC'}</small>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            </SCard>
          ) : null}
          <SCard title="Registration details" meta="Read only" flush>
            <FactRows
              rows={[
                { k: 'Number', v: r.number ?? numberEmpty, mono: Boolean(r.number), empty: !r.number },
                { k: 'Date of registration', v: r.registeredOn ?? '-', empty: !r.registeredOn },
                { k: 'Certificate', v: r.certificate ?? '-', mono: Boolean(r.certificate), empty: !r.certificate },
              ]}
            />
          </SCard>
          <SCard title="What the step needs" meta={r.needs.length || undefined} flush>
            {r.needs.length ? (
              <ul>
                {r.needs.map((n) => (
                  <li key={n} className="border-t border-line-soft px-4 py-2.5 text-[14px] text-ink first:border-t-0 md:px-5">
                    {n}
                  </li>
                ))}
              </ul>
            ) : (
              <Empty />
            )}
          </SCard>
        </div>
        <div className="grid min-w-0 gap-4">
          <SCard title="About" flush>
            <FactRows
              rows={[
                { k: 'Group', v: r.group },
                { k: 'Status', v: <RegChip r={r} /> },
                { k: 'With', v: r.status === 'Done' ? '-' : HOLDER[r.owner], empty: r.status === 'Done' },
                { k: 'Window', v: r.windowFrom && r.due ? `${fmtDMY(r.windowFrom)} to ${fmtDMY(r.due)}` : '-', empty: !(r.windowFrom && r.due) },
                ...(r.late && r.status !== 'Done' ? [{ k: 'Late by', v: `${r.lateDays} ${r.lateDays === 1 ? 'day' : 'days'}` }] : []),
              ]}
            />
            <div className="border-t border-line-soft px-4 py-3 md:px-5">
              <button type="button" className="text-[13px] font-medium text-brand-text hover:underline" onClick={() => openChat(`Tell me about ${r.name}`)}>
                Ask VCFO about {r.name}
              </button>
            </div>
          </SCard>
          {startsFilings(r.stepId) ? (
            <SCard title="What it starts" meta={starts.length || undefined} flush>
              {starts.length ? (
                starts.map((o) => (
                  <ListRow key={o.id} onClick={() => go(obligationHref(o.id))} label={`${o.name} · open the obligation`}>
                    <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                    <span className="flex-none text-[12.5px] text-ink-muted">{o.freqLabel}</span>
                    <StatusChip s={o.status} compact />
                  </ListRow>
                ))
              ) : (
                <Empty>{after ? 'None on your register yet' : 'After the certificate'}</Empty>
              )}
            </SCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
