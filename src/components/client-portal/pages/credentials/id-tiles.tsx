import type { ReactNode } from 'react';
import { Ic } from './Ic';
import type { CredentialsState } from './use-credentials-state';
import type { CellControls } from './cell-controls';

/** The six identifier tiles above the workbook (CIN, PAN, TAN, GSTIN, Registrations, DSC holders). */
export function createIdTiles(ctx: CredentialsState & CellControls) {
  const {
    after,
    data,
    previewed,
    selectTab,
    copyBtn,
    hideBtn,
    revealBtn,
  } = ctx;

  /* six tiles */
  const PEND = <span className="cr-ctv cr-cpend">Pending COI</span>;
  const tile = (auth: string, title: string, value: ReactNode, act?: ReactNode) => (
    <article className="cr-ctile" data-auth={auth} key={title}>
      <div className="cr-ctt">
        <span className="cr-ctn">{title}</span>
        {act}
      </div>
      {value}
    </article>
  );
  const idTiles = () =>
    (data?.ids ?? []).map((t) => {
      if (!after) return tile(t.auth, t.name, PEND);
      const key = `ids|${t.key}|value`;
      if (!t.value && !t.masked) return tile(t.auth, t.name, t.key === 'gstin' ? <span className="cr-ctv cr-cpend">Not registered yet</span> : PEND);
      if (!t.secret) return tile(t.auth, t.name, <span className="cr-ctv">{t.value}</span>, copyBtn(key, t.value!));
      const rev = previewed(key) && t.value;
      if (!rev) return tile(t.auth, t.name, <span className="cr-ctv">{t.masked}</span>, revealBtn(key, 'eye'));
      return tile(t.auth, t.name, <span className="cr-ctv">{t.value}</span>, (
        <>
          {copyBtn(key, t.value!)}
          {hideBtn(key)}
        </>
      ));
    });
  const regTile = () => {
    if (!after) return tile('oth', 'Registrations', PEND);
    return tile(
      'oth',
      'Registrations',
      data?.registrationsSummary ? <span className="cr-ctv cr-sans">{data.registrationsSummary}</span> : <span className="cr-ctv cr-cpend">Not registered yet</span>,
      <button type="button" className="cr-ib cr-s" data-act="tab" data-key="reg" aria-label="Open the registrations sheet" onClick={() => selectTab('reg')}>
        <Ic n="arrow-right" s={13} />
      </button>,
    );
  };
  const dscTile = () => {
    if (!after) return tile('oth', 'DSC holders', PEND);
    const n = data?.directors ?? 0;
    return tile(
      'oth',
      'DSC holders',
      <span className="cr-ctv cr-sans">
        {n} holder{n === 1 ? '' : 's'}
      </span>,
      <button type="button" className="cr-ib cr-s" data-act="tab" data-key="kyc" aria-label="Open the directors KYC sheet" onClick={() => selectTab('kyc')}>
        <Ic n="arrow-right" s={13} />
      </button>,
    );
  };

  return {
    PEND,
    tile,
    idTiles,
    regTile,
    dscTile,
  };
}

export type IdTiles = ReturnType<typeof createIdTiles>;
