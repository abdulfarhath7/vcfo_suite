import type { ReactNode } from 'react';
import { CRED_SRC_TIP, CRED_STATUS, type WireCell } from '@/lib/client-portal/credentials';
import { Ic } from './Ic';
import { fmtS } from './format';
import type { CredentialsState } from './use-credentials-state';

/** Small render helpers for cells and toolbars: grant chips, mode buttons, copy / hide / reveal, status and source chips. */
export function createCellControls(ctx: CredentialsState) {
  const {
    now,
    until,
    modeOf,
    label,
    openOtp,
    endScope,
    copyText,
  } = ctx;

  const sessChip = (scope: string) => {
    const m = modeOf(scope);
    if (!m) return null;
    return (
      <span className={`cr-vis${m === 'Edit' ? ' ed' : ''}`}>
        {m} · {fmtS(until(scope) - now)}
      </span>
    );
  };
  const modeBtns = (scope: string, sm: string, ids: boolean) => {
    const m = modeOf(scope);
    return (
      <>
        {m ? sessChip(scope) : null}
        {m !== 'Preview' && m !== 'Edit' ? (
          <button type="button" className={`cr-btn${sm}`} data-act="preview" data-key={scope} onClick={() => openOtp('preview', scope, { act: 'preview', key: scope })}>
            <Ic n="eye" s={14} />
            {ids ? 'Preview' : 'Preview sheet'}
          </button>
        ) : null}
        {m !== 'Edit' ? (
          <button type="button" className={`cr-btn cr-btn-p${sm}`} data-act="editmode" data-key={scope} onClick={() => openOtp('edit', scope, { act: 'editmode', key: scope })}>
            <Ic n="pencil" s={14} />
            {ids ? 'Edit' : 'Edit sheet'}
          </button>
        ) : null}
        {m ? (
          <button type="button" className={`cr-btn${sm}`} data-act="lock" data-key={scope} onClick={() => void endScope(scope, { act: 'preview', key: scope })}>
            <Ic n="lock" s={14} />
            Lock
          </button>
        ) : null}
      </>
    );
  };

  const copyBtn = (key: string, v: string) => (
    <button type="button" className="cr-ib cr-s cr-ibp" data-act="copy" data-key={key} aria-label={`Copy ${label(key)}`} onClick={() => copyText(v)}>
      <Ic n="copy" s={13} />
    </button>
  );
  const hideBtn = (key: string) => (
    <button
      type="button"
      className="cr-ib cr-s"
      data-act="hide"
      data-key={key}
      aria-label={`Hide ${label(key)}`}
      onClick={() => void endScope(`cell:${key}`, { act: 'reveal-cell', key })}
    >
      <Ic n="eye-off" s={13} />
    </button>
  );
  const cellChip = (key: string) => <span className="cr-vis">Visible · {fmtS(until(`cell:${key}`) - now)}</span>;
  const revealBtn = (key: string, icon: 'lock' | 'eye') => (
    <button
      type="button"
      className="cr-ib cr-s"
      data-act="reveal-cell"
      data-key={key}
      aria-label={`Reveal ${label(key)}`}
      onClick={() => openOtp('reveal', `cell:${key}`, { act: 'reveal-cell', key })}
    >
      <Ic n={icon} s={13} />
    </button>
  );

  const statusChip = (v: string) => {
    const s = CRED_STATUS.find((x) => x[0] === v);
    return s ? <span className={`cr-chip ${s[1]}`}>{v}</span> : <span className="cr-dash">—</span>;
  };
  const plain = (v: string | null | undefined): ReactNode => {
    if (!v) return <span className="cr-dash">—</span>;
    if (v === 'Proof pending') return <span className="cr-chip due">Proof pending</span>;
    if (v === 'Not registered yet' || v === 'Pending COI') return <span className="cr-chip up">{v}</span>;
    return v;
  };
  const srcChip = (cell: WireCell | undefined) => {
    if (!cell?.src || !(cell.v || cell.has) || cell.v === 'Pending COI') return null;
    if (cell.edited)
      return (
        <span className="cr-src ed" title={`Changed by hand. It was filled from the ${cell.src}.`}>
          Edited
        </span>
      );
    return (
      <span className="cr-src" title={CRED_SRC_TIP[cell.src]} aria-label={`Auto from ${cell.src}. ${CRED_SRC_TIP[cell.src]}`}>
        Auto · from {cell.src}
      </span>
    );
  };

  return {
    sessChip,
    modeBtns,
    copyBtn,
    hideBtn,
    cellChip,
    revealBtn,
    statusChip,
    plain,
    srcChip,
  };
}

export type CellControls = ReturnType<typeof createCellControls>;
