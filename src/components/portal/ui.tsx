'use client';

/**
 * Small building blocks shared by every portal section, each one the React
 * form of a prototype helper (a1_core.js): icon(), btn(), popHead(), goArrow(),
 * lawChip(), statusPill(), timerEl(), and the segmented control markup.
 * Class names are the prototype's, so the scoped prototype CSS styles them.
 */
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { dueMs, parts } from './dates';

/* ---------------------------------------------------------------- icons */

export type IconName =
  | 'home' | 'mega' | 'build' | 'calc' | 'cal' | 'folder' | 'lib' | 'key' | 'team' | 'hist' | 'gear' | 'search' | 'bell'
  | 'sun' | 'moon' | 'check' | 'chev' | 'down' | 'back' | 'x' | 'alert' | 'clock' | 'eye' | 'copy' | 'send' | 'doc'
  | 'brief' | 'ext' | 'lock' | 'up' | 'dl' | 'chat' | 'mail' | 'phone' | 'help' | 'step' | 'globe' | 'ne' | 'gantt'
  | 'bolt' | 'grid' | 'notes';

/** <svg><use href="#i-name"/></svg> into the sprite rendered by PortalRoot. */
export function Icon({ name, size, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg width={size} height={size} className={className} style={style} aria-hidden="true" focusable="false">
      <use href={`#i-${name}`} />
    </svg>
  );
}

/** A sprite symbol that is not an i-* icon (the logo, the mascots m-robot …). */
export function Sym({ id, width, height, className }: { id: string; width?: number; height?: number; className?: string }) {
  return (
    <svg width={width} height={height} className={className} aria-hidden="true" focusable="false">
      <use href={`#${id}`} />
    </svg>
  );
}

/* ---------------------------------------------------------------- buttons */

export function Btn({
  cls,
  ico,
  children,
  onClick,
  disabled,
  title,
  type = 'button',
  ariaLabel,
}: {
  /** extra classes after `btn`: 'pri', 'sm', 'warn', 'danger', 'sm pri' … */
  cls?: string;
  ico?: IconName;
  children?: ReactNode;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  title?: string;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}) {
  return (
    <button type={type} className={'btn' + (cls ? ' ' + cls : '')} onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel}>
      {ico ? <Icon name={ico} /> : null}
      {children}
    </button>
  );
}

/** Square icon button (`.ib`), with an optional red count. */
export function IconBtn({
  ico,
  label,
  onClick,
  count,
  dot,
  id,
  className,
}: {
  ico: IconName;
  label: string;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  count?: number;
  /** a red dot instead of a number */
  dot?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <button type="button" id={id} className={'ib' + (className ? ' ' + className : '')} aria-label={label} title={label} onClick={onClick}>
      <Icon name={ico} />
      {count && count > 0 ? <span className="n">{count > 99 ? '99+' : count}</span> : dot ? <span className="n dotn" /> : null}
    </button>
  );
}

/** Round arrow that slides open to show its destination (prototype goArrow). */
export function GoArrow({ label, onClick, href, ghost }: { label: string; onClick?: (e: MouseEvent) => void; href?: string; ghost?: boolean }) {
  const cls = 'goa' + (ghost ? ' ghost' : '');
  const inner = (
    <>
      <Icon name="ne" />
      <span>{label}</span>
    </>
  );
  if (href)
    return (
      <a className={cls} title={label} aria-label={label} href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
        {inner}
      </a>
    );
  return (
    <button type="button" className={cls} title={label} aria-label={label} onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      {inner}
    </button>
  );
}

/* ---------------------------------------------------------------- segmented control */

export interface SegOption<T extends string> {
  value: T;
  label: ReactNode;
  /** small count after the label (`<i>`) */
  n?: number | string;
  /** coloured square before the label */
  dot?: string;
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  id,
  className,
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  id?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={'seg' + (className ? ' ' + className : '')} id={id} role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.dot ? <span className="dot" style={{ background: o.dot }} /> : null}
          {o.label}
          {o.n !== undefined ? <i>{o.n}</i> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- areas of law and statuses */

/** The five areas of law, matching `AreaCode` in src/lib/client-portal/compliances.ts. */
export type LawKey = 'MCA' | 'GST' | 'PAY' | 'IT' | 'FEMA';

export const LAWS: { k: LawKey; name: string; tag: string; short: string }[] = [
  { k: 'MCA', name: 'Companies Act', tag: 'MCA', short: 'MCA' },
  { k: 'GST', name: 'GST', tag: 'GST', short: 'GST' },
  { k: 'PAY', name: 'Payroll · PF ESI PT', tag: 'PAYROLL', short: 'Payroll' },
  { k: 'IT', name: 'Income tax · TP', tag: 'INCOME TAX', short: 'Income tax' },
  { k: 'FEMA', name: 'FEMA · RBI · STPI', tag: 'FEMA · RBI', short: 'FEMA · RBI' },
];
export const LAW_BY: Record<LawKey, (typeof LAWS)[number]> = Object.fromEntries(LAWS.map((l) => [l.k, l])) as Record<LawKey, (typeof LAWS)[number]>;
export const lawVar = (k: LawKey): string => `var(--law-${k})`;

/** Coloured law tag. `text` overrides the tag (e.g. 'STPI' for an STPI filing). */
export function LawChip({ law, text, long }: { law: LawKey; text?: string; long?: boolean }) {
  const tag = text ?? (long ? LAW_BY[law].tag : law === 'PAY' ? 'PAYROLL' : law);
  return (
    <span className="law" style={{ background: lawVar(law) }}>
      {tag}
    </span>
  );
}

/** Filing status, as in the prototype: ok = filed, due = due within 7 days, over = overdue, up = upcoming. */
export type FilingSt = 'ok' | 'due' | 'over' | 'up';
export const ST_LABEL: Record<FilingSt, string> = { ok: 'Filed', due: 'Due soon', over: 'Overdue', up: 'Upcoming' };
const ST_PILL: Record<FilingSt, string> = { ok: 'done', due: 'due', over: 'over', up: 'up' };
const ST_ICON: Record<FilingSt, IconName> = { ok: 'check', due: 'clock', over: 'alert', up: 'clock' };
export const ST_COLOR: Record<FilingSt, string> = { over: 'var(--over)', due: 'var(--due)', up: 'var(--ice)', ok: 'var(--done)' };
export const ST_RANK: Record<FilingSt, number> = { over: 0, due: 1, up: 2, ok: 3 };

export function StatusPill({ st, label }: { st: FilingSt; label?: string }) {
  return (
    <span className={'pill ' + ST_PILL[st]}>
      <Icon name={ST_ICON[st]} />
      {label ?? ST_LABEL[st]}
    </span>
  );
}

/** A plain pill: kind is one of the prototype pill classes. */
export function Pill({ kind, children, icon }: { kind: 'over' | 'due' | 'done' | 'ok' | 'up' | 'mut' | 'na'; children: ReactNode; icon?: IconName }) {
  return (
    <span className={'pill ' + kind}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

/** Date tile (`.dtile`): big day number over the month. */
export function DateTile({ iso, st }: { iso: string; st?: 'over' | 'due' | 'ok' | null }) {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getUTCMonth()];
  return (
    <div className={'dtile' + (st ? ' s-' + st : '')}>
      <b>{d.getUTCDate()}</b>
      <span>{mon}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- live countdown */

/** Ticks every second; DAYS HRS MIN SEC to (or, `since`, from) the end of an ISO day in IST. */
export function Timer({ due, mode = 'to' }: { due: string; mode?: 'to' | 'since' }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const end = dueMs(due);
  const p = now === null ? [0, 0, 0, 0] : parts(mode === 'since' ? now - end : end - now);
  return (
    <div className={'timer' + (mode === 'since' ? ' red' : '')}>
      {['DAYS', 'HRS', 'MIN', 'SEC'].map((l, i) => (
        <div key={l}>
          <b>{String(p[i]).padStart(2, '0')}</b>
          <span>{l}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- section header */

/** `.sec-h`: title, optional count chip, then right-aligned controls. */
export function SecHead({ title, count, children, sub }: { title: string; count?: ReactNode; children?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="sec-h">
      <h2>{title}</h2>
      {count !== undefined && count !== null ? <span className="sec-count">{count}</span> : null}
      {children ? (
        <>
          <span className="sp" />
          {children}
        </>
      ) : null}
      {sub ? <p style={{ flexBasis: '100%', marginTop: 0 }}>{sub}</p> : null}
    </div>
  );
}

/** Loading / error placeholders inside a section. */
export function SecLoading({ label = 'Loading…' }: { label?: string }) {
  return <div className="sec-load">{label}</div>;
}
export function SecError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="sec-err" role="alert">
      <Icon name="alert" />
      <span>{message ?? 'This part could not load.'}</span>
      {onRetry ? (
        <>
          <span className="sp" />
          <button type="button" className="btn sm" onClick={onRetry}>
            Try again
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Initials of a name: "Priya Raman" → "PR". */
export function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return (p[0]![0]! + p[p.length - 1]![0]!).toUpperCase();
}
