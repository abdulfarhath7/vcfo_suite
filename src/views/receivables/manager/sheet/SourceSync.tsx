'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { FilterSelect } from '@/components/ui/native-select';
import { Modal } from '@/components/ui/modal';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import { useSheetSource, useSheetSourceActions } from '@/hooks/use-zoho-sheet-sync';
import { TallySync } from './TallySync';
import { ZohoSync } from './ZohoSync';

/**
 * The Sheet tab's Sync button for the sheet's source (docs/specs/integrations/ZOHO.md): Sync from
 * Tally for an Excel or Tally sheet (as before), Sync from Zoho for a Zoho sheet. A firm-wide admin
 * switches the source from the caret menu, picking the Zoho Books organisation behind the sheet.
 */
type Props = { sheetId: string; today: string; onImportExcel: () => void; onReview: () => void };

export function SourceSync(props: Props) {
  const status = useSheetSource(props.sheetId);
  const actions = useSheetSourceActions(props.sheetId);
  const [choose, setChoose] = useState(false);
  const data = status.data;
  const isZoho = data?.source === 'zoho';

  const switchToTally = () =>
    actions.setSource.mutate({ source: 'tally' }, { onSuccess: () => toastSuccess('This sheet now syncs from Tally'), onError: (e) => toastError('Not changed', e instanceof Error ? e.message : undefined) });

  const menuExtra = data?.canChoose ? (
    isZoho ? (
      <>
        <DropdownMenuItem onSelect={() => setChoose(true)}>Change Zoho organisation…</DropdownMenuItem>
        <DropdownMenuItem onSelect={switchToTally}>Use Tally instead</DropdownMenuItem>
      </>
    ) : data.connected ? (
      <DropdownMenuItem onSelect={() => setChoose(true)}>Use Zoho Books…</DropdownMenuItem>
    ) : null
  ) : null;

  return (
    <>
      {isZoho ? <ZohoSync {...props} menuExtra={menuExtra} /> : <TallySync {...props} menuExtra={menuExtra} />}
      {choose && data ? <ChooseZohoOrg sheetId={props.sheetId} orgs={data.orgs} current={data.zohoOrgId ? `${data.zohoApp}:${data.zohoOrgId}` : ''} onClose={() => setChoose(false)} /> : null}
    </>
  );
}

function ChooseZohoOrg({ sheetId, orgs, current, onClose }: { sheetId: string; orgs: Array<{ app: 'books' | 'invoice'; externalOrgId: string; name: string; isFirm: boolean }>; current: string; onClose: () => void }) {
  const actions = useSheetSourceActions(sheetId);
  const firm = orgs.find((o) => o.isFirm);
  const [pick, setPick] = useState(current || (firm ? `${firm.app}:${firm.externalOrgId}` : ''));
  const [app, orgId] = pick.split(':') as ['books' | 'invoice', string];
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Sync this sheet from Zoho"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!pick || actions.setSource.isPending}
            onClick={() =>
              actions.setSource.mutate(
                { source: 'zoho', zohoApp: app, zohoOrgId: orgId },
                {
                  onSuccess: () => {
                    toastSuccess('This sheet now syncs from Zoho');
                    onClose();
                  },
                  onError: (e) => toastError('Not changed', e instanceof Error ? e.message : undefined),
                },
              )
            }
          >
            Use this organisation
          </Button>
        </>
      }
    >
      {orgs.length ? (
        <div className="grid gap-3">
          <FilterSelect
            size="md"
            aria-label="Zoho organisation"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            options={[{ value: '', label: 'Pick an organisation…' }, ...orgs.map((o) => ({ value: `${o.app}:${o.externalOrgId}`, label: `${o.name} · ${o.app === 'books' ? 'Books' : 'Invoice'}${o.isFirm ? ' · the firm' : ''}` }))]}
          />
          <p className="text-[12.5px] text-ink-muted">Invoices and payments of this organisation come in for approval, the same as a Tally sync. Excel import keeps working.</p>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">No Zoho Books organisation was found. Run the check again in Firm settings &gt; Integrations.</p>
      )}
    </Modal>
  );
}
