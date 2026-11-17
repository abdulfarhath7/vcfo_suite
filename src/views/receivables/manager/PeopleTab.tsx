'use client';

import { useState } from 'react';
import { SpectrumTabs } from '@/components/ui/spectrum-tabs';
import { toastError, toastSuccess } from '@/lib/toast-errors';
import type { EmailSettingsDto } from '@/lib/receivables/v2-wire';
import type { ManagerSheetDto, OutlookStatusDto } from '@/lib/receivables/wire';
import { usePeople, usePeopleActions } from '@/hooks/use-receivables-v2';
import { ClientsPane } from './people/ClientsPane';
import { LeadersPane } from './people/LeadersPane';
import { LogPane } from './people/LogPane';
import { PartnersPane } from './people/PartnersPane';
import { EmailSwitches, Integrations } from './people/TopBar';
import { errorText, type Actions } from './people/shared';

/**
 * The People tab (receivables v2, docs/specs/receivables/V2.md), which replaced the Partners tab.
 * One compact top row holds four sub-tabs on the left and, on the right, the sheet-wide email
 * switches (new invoice, revised, roll-up interval and hour, with the next sends) and the Outlook
 * and WhatsApp (DoubleTick) status dots, which open their details and actions.
 *  - Partners: a master–detail split. The partner list with open counts and short totals on the
 *    left; the picked partner's switches, Edit, their clients and "Manage clients" on the right.
 *  - Clients: every client with partner and credit days edited in place, and "Send statement".
 *  - Leaders: the leadership digest switch, weekday and hour, and its typed-in recipients.
 *  - Log: the last 50 emails, one line each, with Retry on a failed or skipped one.
 * The sub-tabs live in `./people/`.
 */

type Sub = 'partners' | 'clients' | 'leaders' | 'log';

export function PeopleTab({ data, actions, outlook, settingsHref }: { data: ManagerSheetDto; actions: Actions; outlook: OutlookStatusDto | undefined; settingsHref: string }) {
  const sheetId = data.sheet.id;
  const people = usePeople(sheetId);
  const act = usePeopleActions(sheetId);
  const [sub, setSub] = useState<Sub>('partners');
  if (people.isLoading) return <p className="py-10 text-center text-ink-muted">Loading people…</p>;
  if (people.error || !people.data) return <p className="py-10 text-center text-danger">{people.error?.message ?? 'Could not load the People tab.'}</p>;
  const p = people.data;
  const saveSettings = (patch: Partial<EmailSettingsDto>) => act.saveSettings.mutate(patch, { onError: (e) => toastError('Not saved', errorText(e)) });
  const failed = p.emailLog.filter((l) => l.status === 'failed').length;
  const items = [
    { key: 'partners', label: 'Partners', count: data.partners.length },
    { key: 'clients', label: 'Clients', count: p.clients.length },
    { key: 'leaders', label: 'Leaders', count: p.digestRecipients.filter((r) => r.active).length },
    { key: 'log', label: 'Log', count: failed ? `${failed} failed` : undefined },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <SpectrumTabs label="People" items={items} value={sub} onChange={(k) => setSub(k as Sub)} />
        <span className="flex-1" />
        <EmailSwitches people={p} saveSettings={saveSettings} />
        <Integrations
          outlook={outlook}
          whatsapp={p.whatsapp}
          settingsHref={settingsHref}
          testing={act.testWhatsApp.isPending}
          onTest={() => act.testWhatsApp.mutate(undefined, { onSuccess: (r) => toastSuccess('Test sent', `To ${r.to}. Check WhatsApp on that phone.`), onError: (e) => toastError('Not sent', errorText(e)) })}
        />
      </div>
      {sub === 'partners' ? <PartnersPane data={data} people={p} actions={actions} act={act} /> : null}
      {sub === 'clients' ? <ClientsPane data={data} people={p} act={act} /> : null}
      {sub === 'leaders' ? <LeadersPane people={p} act={act} saveSettings={saveSettings} /> : null}
      {sub === 'log' ? <LogPane people={p} act={act} /> : null}
    </div>
  );
}
