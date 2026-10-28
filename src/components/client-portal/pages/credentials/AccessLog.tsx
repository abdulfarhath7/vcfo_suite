import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CredentialsLogEntry } from '@/lib/client-portal/credentials';
import { Ic } from './Ic';
import { fmtDate } from './format';

/** The Access log drawer: every preview, edit and reveal on this engagement. */
export function AccessLog({ engQ, onClose, onAudit }: { engQ: string; onClose: () => void; onAudit: () => void }) {
  const xRef = useRef<HTMLButtonElement>(null);
  const q = useQuery({
    queryKey: ['client-portal', 'credentials-log'],
    queryFn: async (): Promise<CredentialsLogEntry[]> => {
      const res = await fetch(`/api/client/credentials/log${engQ}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      return ((await res.json()) as { entries: CredentialsLogEntry[] }).entries;
    },
    refetchOnMount: 'always',
  });
  useEffect(() => {
    xRef.current?.focus();
  }, []);
  const rows = q.data ?? [];
  return (
    <div id="cr-drawer">
      <div className="cr-scrim" role="presentation" onClick={onClose} />
      <div className="cr-drawer" role="dialog" aria-label="Access log">
        <header className="cr-dh">
          <span className="sx-tile" data-tone="blue">
            <Ic n="history" s={15} />
          </span>
          <h2 className="cr-dt">Access log</h2>
          <span className="cr-dn">{rows.length}</span>
          <span className="cr-sp" />
          <button type="button" className="sx-btn sm" data-act="audit" onClick={onAudit}>
            <Ic n="file-text" s={13} />
            Open in Audit
          </button>
          <button type="button" id="cr-log-x" className="sx-ib sm" aria-label="Close access log" onClick={onClose} ref={xRef}>
            <Ic n="x" s={14} />
          </button>
        </header>
        <ol className="cr-log" aria-busy={q.isLoading}>
          {q.isLoading ? (
            <li className="cr-log-empty" aria-label="Loading">
              <span className="sx-sk" style={{ height: 44 }} />
              <span className="sx-sk" style={{ height: 44 }} />
              <span className="sx-sk" style={{ height: 44 }} />
            </li>
          ) : q.isError ? (
            <li className="cr-log-empty cr-log-err">Could not load the access log</li>
          ) : rows.length === 0 ? (
            <li className="sx-empty cr-log-none">No previews, edits or reveals yet</li>
          ) : (
            rows.map((e) => (
              <li key={e.id}>
                <time className="cr-num" dateTime={e.at}>
                  {fmtDate(e.at)}
                </time>
                <span>{e.text}</span>
              </li>
            ))
          )}
        </ol>
      </div>
    </div>
  );
}
