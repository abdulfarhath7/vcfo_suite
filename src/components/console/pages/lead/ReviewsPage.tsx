'use client';

/**
 * LEAD · REVIEWS (prototype #lsec-reviews): what a project lead really
 * reviews. Step submissions are not here — accepting or rejecting a step is
 * the manager's (POST /checklist/review allows managers and admins only).
 *
 *   Document uploads   a client uploaded the file a document request asked for.
 *                      Approve / Send back set the request's status through
 *                      PATCH /api/requests/:id (staff may; the client portal
 *                      then shows Approved, or drops it).
 *   Files on steps     a client fulfilled a file request on a step that is still
 *                      open; there is no decision to record, so the card opens
 *                      the step where the file is checked.
 */
import type { CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { SecLoading } from '@/components/portal/ui';
import { Btn, Empty, hueOf } from '../../ui';
import { useConsole, useCrumbs } from '../../runtime';
import { dShort, plural, stepPath } from '../today/model';
import { useLeadDesk, useLeadReviews, type ReviewItem } from './useLead';
import '../../css/96-today.css';
import '../../css/96-lead.css';

export function ReviewsPage() {
  useCrumbs(['Reviews']);
  const { model: m, loading } = useLeadDesk();
  const { items, loading: filesLoading } = useLeadReviews(m);
  const { approveDoc, user } = useApp();
  const { go, base, toast } = useConsole();
  const qc = useQueryClient();

  const sendBack = async (r: ReviewItem) => {
    if (!r.requestId) return;
    const res = await fetch(`/api/requests/${encodeURIComponent(r.requestId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected' }),
    });
    if (!res.ok) {
      toast('Could not send it back. Try again.');
      return;
    }
    await qc.invalidateQueries({ queryKey: ['requests', user?.id] });
    toast(`Sent back: ${r.title}`);
  };

  return (
    <>
      <div className="sec-h">
        <h2>Reviews</h2>
        <span className="sec-count">{loading || filesLoading ? 'Loading…' : `${plural(items.length, 'item')} waiting for you`}</span>
        <span className="sp" />
        <span className="small">Client uploads to approve or send back · step decisions are your manager&apos;s</span>
      </div>
      {loading ? (
        <SecLoading label="Loading your reviews…" />
      ) : items.length === 0 ? (
        <section className="glass panel">
          <Empty title="Nothing to review" sub="When a client uploads a requested document or a file on a step, it shows here." />
        </section>
      ) : (
        <div className="lreviews">
          {items.map((r) => {
            const c = m.byId[r.clientId]!;
            return (
              <section key={r.id} className="glass rv" style={{ ['--cc' as string]: hueOf(c.id) } as CSSProperties}>
                <div className="rv-h">
                  <span className={'ftype' + (r.kind === 'file' ? ' JPG' : '')} style={{ marginTop: 3 }}>
                    {r.kind === 'file' ? 'FILE' : 'DOC'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{r.title}</b>
                    <span className="s">
                      {r.sub}
                      {r.at && r.kind === 'file' ? ` · ${dShort(r.at, m.today)}` : ''}
                    </span>
                  </div>
                  <span className="cc" title={c.name}>
                    <i />
                    {c.short}
                  </span>
                </div>
                <div className="co-row">
                  <span className="kind">{r.kind === 'file' ? 'FILE ON A STEP' : 'DOCUMENT REQUEST'}</span>
                </div>
                {r.kind === 'upload' ? (
                  <div className="acts">
                    <Btn
                      cls="pri sm"
                      ico="check"
                      onClick={() => {
                        approveDoc(r.requestId!);
                        toast(`Approved: ${r.title}`);
                      }}
                    >
                      Approve
                    </Btn>
                    <Btn cls="sm" ico="back" onClick={() => void sendBack(r)}>
                      Send back
                    </Btn>
                    <Btn cls="sm" ico="eye" onClick={() => go(c.href)}>
                      Open client
                    </Btn>
                  </div>
                ) : (
                  <div className="acts">
                    <Btn cls="pri sm" ico="eye" onClick={() => go(stepPath(base, c.e, r.stepId!))}>
                      Check on the step
                    </Btn>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
