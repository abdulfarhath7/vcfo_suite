'use client';

/**
 * The Status brief (prototype #briefm): a plain-text summary of where the
 * company stands today — set-up progress, overdue filings, what waits on the
 * client, the next 14 days, what was filed this FY and the SBC team — built
 * from the same live data as Home, with "Copy the text" and the PDF status
 * report (/api/client/report) the previous portal already offered.
 *
 * CONTRACT (used by the top bar — keep the signature):
 *   useBriefAction() → () => void   opens the Status brief modal.
 */
import { useCallback, useMemo } from 'react';
import { usePortal } from '../../runtime';
import { ModalBox } from '../../overlays';
import { Btn, Icon, SecLoading } from '../../ui';
import { fmtL } from '../../dates';
import { useHomeData } from './HomeSection';
import { briefText } from './model';

export function useBriefAction(): () => void {
  const { openModal } = usePortal();
  return useCallback(() => openModal(<BriefModal />, { label: 'Status brief' }), [openModal]);
}

export function BriefModal() {
  const { toast } = usePortal();
  const { shell, rows, all, model, today, dock, loading } = useHomeData();
  const text = useMemo(
    () =>
      shell
        ? briefText({
            companyName: shell.companyName,
            companyShort: shell.companyShort,
            model,
            rows,
            all,
            dock,
            team: shell.team,
            today,
          })
        : '',
    [shell, model, rows, all, dock, today],
  );
  const copy = () => {
    try {
      void navigator.clipboard.writeText(text).then(
        () => toast('Status brief copied'),
        () => toast('Select the text to copy it'),
      );
    } catch {
      toast('Select the text to copy it');
    }
  };
  const reportHref = shell ? `/api/client/report?${new URLSearchParams({ engagementId: shell.engagementId })}` : undefined;
  return (
    <ModalBox
      eyebrow={fmtL(today)}
      title="Status brief"
      label="Status brief"
      foot={
        <>
          <button type="button" className="btn" data-close>
            Close
          </button>
          {reportHref ? (
            <a className="btn" href={reportHref} title="This month’s status report as a PDF">
              <Icon name="dl" />
              PDF report
            </a>
          ) : null}
          <Btn cls="pri" ico="copy" onClick={copy} disabled={!text}>
            Copy the text
          </Btn>
        </>
      }
    >
      {loading && !shell ? <SecLoading /> : <div className="brief">{text}</div>}
    </ModalBox>
  );
}
