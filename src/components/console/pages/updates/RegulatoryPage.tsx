'use client';

/**
 * REGULATORY UPDATES — the manager's review queue (this branch's "one review
 * road for every official update"; live view src/views/manager/RegulatoryUpdates.tsx),
 * in the console look. Every function kept:
 *   - Waiting for review (count) / Approved / Rejected;
 *   - each update: the act, title, source, published / found dates, the
 *     original on the government site, "What changed", a read failure,
 *     "still being read" (the list refreshes every 5 s until it is ready),
 *     the decision with its reason, how many pieces were read, the review
 *     document (PDF);
 *   - Approve (Ask VCFO uses it for everyone, an announcement is posted,
 *     everyone is notified, clients also by email) and Reject with a required
 *     reason (it stays hidden). Managers only; admins can read.
 * Both decisions now confirm in a dialog first (approval emails every client).
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { useConsole, useCrumbs } from '../../runtime';
import { ModalBody } from '../../overlays';
import { Btn, Empty, Field, Icon, Panel, Seg } from '../../ui';
import { useRegulatoryList, useRegulatoryPending } from './data';
import { canSeeRegulatory, decidable, plural, publishedLabel, shortStamp, stillReading, type RegUpdate, type ReviewStatus } from './model';

const TAB_LABEL: Record<ReviewStatus, string> = { pending: 'Waiting for review', approved: 'Approved', rejected: 'Rejected' };

function RejectModal({ u, onReject }: { u: RegUpdate; onReject: (note: string) => void }) {
  const { closeModal } = useConsole();
  const [note, setNote] = useState('');
  return (
    <ModalBody
      eyebrow="Regulatory update"
      title="Reject this update"
      sub={u.title}
      foot={
        <>
          <Btn onClick={closeModal}>Cancel</Btn>
          <span className="sp" />
          <Btn
            cls="danger"
            ico="x"
            disabled={!note.trim()}
            onClick={() => {
              closeModal();
              onReject(note.trim());
            }}
          >
            Reject
          </Btn>
        </>
      }
    >
      <div className="mx-form2 one">
        <Field label="Why is this being rejected?" hint="It stays hidden from Ask VCFO and clients. Your reason is saved so the fetching can be fixed.">
          <textarea
            className="mx-in"
            rows={3}
            maxLength={2000}
            value={note}
            placeholder="e.g. Not new — this is the 2025 notification; or the summary misreads the rate."
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      </div>
    </ModalBody>
  );
}

export function RegulatoryPage() {
  useCrumbs(['Regulatory updates']);
  const { user } = useApp();
  const { openModal, closeModal, toast } = useConsole();
  const qc = useQueryClient();
  const [tab, setTab] = useState<ReviewStatus>('pending');
  const allowed = canSeeRegulatory(user?.role);
  const list = useRegulatoryList(tab, user?.role);
  const pending = useRegulatoryPending(user?.role);
  const now = Date.now();

  const decide = useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: 'approve' | 'reject'; note?: string }) => {
      const res = await fetch(`/api/regulatory-updates/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(body?.error || 'Could not record the decision');
      return body;
    },
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['regulatory-updates'] });
      void qc.invalidateQueries({ queryKey: ['ask', 'sources'] });
      toast(v.decision === 'approve' ? 'Approved · Ask VCFO now answers from it, and clients and staff have been told' : 'Rejected · it stays hidden and your reason is saved');
    },
    onError: (e: Error) => toast(`Could not record the decision: ${e.message}`),
  });

  const approve = (u: RegUpdate) =>
    openModal(
      <ModalBody
        eyebrow="Regulatory update"
        title="Approve and publish this update?"
        sub={u.title}
        foot={
          <>
            <Btn onClick={closeModal}>Cancel</Btn>
            <span className="sp" />
            <Btn
              cls="pri"
              ico="check"
              onClick={() => {
                closeModal();
                decide.mutate({ id: u.id, decision: 'approve' });
              }}
            >
              Approve
            </Btn>
          </>
        }
      >
        <ul className="upd-list">
          <li>Ask VCFO starts answering from it, for your team and for clients.</li>
          <li>It is posted on Announcements for everyone.</li>
          <li>Everyone gets a notification, and every client also gets an email.</li>
        </ul>
      </ModalBody>,
      { label: 'Approve update' },
    );
  const reject = (u: RegUpdate) => openModal(<RejectModal u={u} onReject={(note) => decide.mutate({ id: u.id, decision: 'reject', note })} />, { label: 'Reject update' });

  const canDecide = list.data?.canDecide ?? false;
  const updates = list.data?.updates ?? [];

  if (!allowed)
    return (
      <Panel title="Regulatory updates">
        <Empty title="This queue is for managers and admins" sub="Approved official updates appear on Announcements for everyone." />
      </Panel>
    );

  return (
    <>
      <div className="sec-h">
        <h2>Regulatory updates</h2>
        <span className="sec-count">{typeof pending.data === 'number' ? `${pending.data} waiting` : 'Loading…'}</span>
        <span className="sp" />
        <Seg<ReviewStatus>
          className="sm wrap"
          ariaLabel="Review state"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: TAB_LABEL.pending, n: pending.data },
            { value: 'approved', label: TAB_LABEL.approved },
            { value: 'rejected', label: TAB_LABEL.rejected },
          ]}
        />
      </div>
      <p className="lede upd-lede">Government notifications and circulars the tool found. Nothing reaches Ask VCFO or clients until a manager approves it.</p>
      {!canDecide && list.data ? <p className="small upd-lede">You can read this queue. Only a manager can approve or reject.</p> : null}
      <Panel title={TAB_LABEL[tab]} sub={list.data ? plural(updates.length, 'update') : undefined}>
        {list.isError ? (
          <div className="upd-err" role="alert">
            {(list.error as Error).message}{' '}
            <button type="button" className="link" onClick={() => void list.refetch()}>
              Try again
            </button>
          </div>
        ) : list.isLoading ? (
          <p className="small">Loading the updates…</p>
        ) : updates.length === 0 ? (
          <Empty
            title={tab === 'pending' ? 'Nothing is waiting for review' : `No ${tab} updates yet`}
            sub={tab === 'pending' ? 'New notifications and circulars from the sources we watch land here first.' : undefined}
          />
        ) : (
          <div className="upd-regs">
            {updates.map((u) => {
              const reading = stillReading(u);
              const published = publishedLabel(u.publishedAt, now);
              return (
                <article key={u.id} className="upd-reg">
                  <div className="upd-regh">
                    {u.feed ? (
                      <span className="pill mut" title={u.feed.label}>
                        {u.feed.act}
                      </span>
                    ) : null}
                    <b>{u.title}</b>
                  </div>
                  <span className="small">
                    {u.feed?.label ?? 'Official source'}
                    {published ? ` · published ${published}` : ''}
                    {` · found ${shortStamp(u.createdAt, now)}`}
                    {u.sourceUrl ? (
                      <>
                        {' · '}
                        <a className="upd-srcl" href={u.sourceUrl} target="_blank" rel="noreferrer">
                          Original on the government site
                          <Icon name="ext" size={12} />
                        </a>
                      </>
                    ) : null}
                  </span>
                  {u.summary ? (
                    <p className="upd-what">
                      <span className="eyebrow">What changed</span>
                      {u.summary}
                    </p>
                  ) : null}
                  {u.status === 'failed' && u.error ? <p className="upd-err">Could not be read: {u.error}</p> : null}
                  {reading && u.status !== 'failed' ? <p className="small">Still being read… the review document appears here when it is ready.</p> : null}
                  {u.reviewStatus !== 'pending' ? (
                    <p className="small">
                      {u.reviewStatus === 'approved' ? 'Approved' : 'Rejected'} {shortStamp(u.reviewedAt, now)}
                      {u.reviewNote ? ` · “${u.reviewNote}”` : ''}
                    </p>
                  ) : null}
                  <div className="mx-chips">
                    <span className="pill mut" title="Pieces of the document Ask VCFO has read">
                      {plural(u.chunkCount, 'piece')} read
                    </span>
                    {u.hasReviewPdf ? (
                      <a className="btn sm" href={`/api/regulatory-updates/${u.id}/review-pdf`} target="_blank" rel="noreferrer">
                        <Icon name="doc" />
                        Open review document
                      </a>
                    ) : null}
                    {decidable(u, canDecide) ? (
                      <>
                        <span className="sp" />
                        <Btn cls="sm pri" ico="check" disabled={decide.isPending} onClick={() => approve(u)}>
                          Approve
                        </Btn>
                        <Btn cls="sm danger-ghost" ico="x" disabled={decide.isPending} onClick={() => reject(u)}>
                          Reject
                        </Btn>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </>
  );
}
