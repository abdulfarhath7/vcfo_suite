/**
 * VCFO Spectrum parts for the side panel, drawn the way the Suite app draws them. The extension
 * never imports Suite code, so these are small copies of the app's components, styled by
 * panel.css with the generated tokens (spectrum-tokens.css):
 *
 * - `Section`: DashSection (src/components/dash/DashSection.tsx), a raised card with a head row of
 *   a 28px tinted icon tile and a 15px title. The tile's icon and tone come from the title through
 *   the same table as the app (src/lib/ui/card-head-icon.ts).
 * - `Chip`: the R-13 status chip (src/components/ui/spectrum-chip.tsx): 24px, 6px corners, a 7px
 *   square dot and one of seven tones. `Tag` is the same chip without the dot.
 * - `StepMark`: the ST5 step mark (src/components/ui/step-track.tsx). The line between marks
 *   (StepLink, R-58) is drawn by panel.css on the `.step` rows.
 * - `EmptyState`: R-48 (src/components/ui/empty-state.tsx).
 *
 * Icon paths are from Lucide (ISC licence), the icon set the app uses.
 */
import type { ReactNode } from 'react';

export type ChipTone = 'ok' | 'warn' | 'bad' | 'prog' | 'idle' | 'violet' | 'teal';

/** The six status meanings and their tones, as in the app's `toneFor`. */
export function toneFor(status: string): ChipTone {
  const s = status.toLowerCase();
  if (/(^|\b)(not[- ](started|due|asked|yet|filed|sent|begun)|unpaid|unfiled|incomplete|upcoming|planned|scheduled|queued)\b/.test(s)) return 'idle';
  if (/(done|complete|filed|approved|granted|active|paid|closed|resolved|\bok\b|healthy|connected|live|verified|on track)/.test(s)) return 'ok';
  if (/(overdue|late|fail|error|rejected|blocked|stuck|critical|down|expired|sent back|missing)/.test(s)) return 'bad';
  if (/(waiting|pending|with client|with sbc|with mca|hold|needs|asked|sent|awaiting)/.test(s)) return 'teal';
  if (/(due|soon|warn|degraded|expir|risk)/.test(s)) return 'warn';
  if (/(progress|current|running|filing|review|started|working|processing|open|mca)/.test(s)) return 'prog';
  return 'idle';
}

export function Chip({
  tone,
  dot = true,
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone; dot?: boolean }) {
  const t = tone ?? (typeof children === 'string' ? toneFor(children) : 'idle');
  return (
    <span className={`chip chip-${t}${className ? ` ${className}` : ''}`} {...rest}>
      {dot ? <i className="chip-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/** Soft tag without a dot, for categories (who does a step, a field's tier). */
export function Tag({ tone = 'idle', className, children }: { tone?: ChipTone; className?: string; children: ReactNode }) {
  return <span className={`chip tag chip-${tone}${className ? ` ${className}` : ''}`}>{children}</span>;
}

export type StepState = 'done' | 'now' | 'next';
export type StepTone = 'prog' | 'teal' | 'warn' | 'bad';

/** ST5 step mark, 22px: done is a green square with a tick, now a ring with a square dot, next an empty square. */
export function StepMark({ state, tone = 'prog' }: { state: StepState; tone?: StepTone }) {
  return (
    <span className={`step-mark mark-${state} mark-${tone}`} aria-hidden="true">
      {state === 'done' ? <Icon name="check" size={13} stroke={2.6} /> : null}
      {state === 'now' ? <i className="mark-dot" /> : null}
    </span>
  );
}

/** R-48: a plain-edged area with the message and the action. */
export function EmptyState({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span>{title}</span>
      {action}
    </div>
  );
}

type HeadTone = 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet';
type IconName =
  | 'alert-triangle'
  | 'bell'
  | 'circle-check'
  | 'calendar'
  | 'inbox'
  | 'file'
  | 'shield-check'
  | 'clipboard-check'
  | 'user'
  | 'id-card'
  | 'clock'
  | 'list'
  | 'bar-chart'
  | 'mail'
  | 'book-open'
  | 'layout-grid'
  | 'check';

/* The app's card-head table (src/lib/ui/card-head-icon.ts): the first row whose words start a word in the title wins. */
const TABLE: Array<[IconName, HeadTone, string[]]> = [
  ['alert-triangle', 'red', ['risk', 'stuck', 'overdue', 'incident', 'escalation', 'broken']],
  ['bell', 'amber', ['alert', 'update', 'notification', 'announcement']],
  ['circle-check', 'green', ['approval', 'decision', 'granted']],
  ['calendar', 'teal', ['timeline', 'week', 'calendar', 'what is next', 'coming', 'deadline', 'schedule', 'renewal', 'plan', 'due', 'reminder']],
  ['inbox', 'blue', ['inbox', 'triage', 'message', 'thread']],
  ['file', 'amber', ['need', 'document', 'docs', 'vault', 'upload', 'file']],
  ['shield-check', 'green', ['compliance', 'filing', 'obligation', 'statute', 'status']],
  ['clipboard-check', 'teal', ['what sbc is doing', 'holds', 'pending with', 'progress flow', 'reassign', 'assign', 'capacity']],
  ['user', 'violet', ['waiting', 'client', 'people', 'lead', 'manager', 'team', 'who', 'firm profile', 'access', 'session']],
  ['id-card', 'violet', ['registration', 'ids', 'identity', 'credential', 'key']],
  ['clock', 'violet', ['activity', 'audit', 'recent', 'history', 'log', 'deploy', 'job']],
  ['list', 'blue', ['step', 'queue', 'work', 'task', 'action', 'post-incorporation', 'pipeline']],
  ['bar-chart', 'blue', ['phase', 'practice', 'analytics', 'growth', 'report', 'chart', 'health', 'area', 'service', 'cost', 'source', 'connection', 'integration']],
  ['mail', 'blue', ['email', 'mail']],
  ['book-open', 'teal', ['library', 'knowledge', 'sop', 'book']],
];
const MATCHERS = TABLE.map(([icon, tone, words]) => ({
  icon,
  tone,
  re: new RegExp(`(^|[^a-z])(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'i'),
}));

export function headIcon(title: string): { icon: IconName; tone: HeadTone } {
  const t = title.replace(/[’']/g, "'");
  for (const m of MATCHERS) if (m.re.test(t)) return { icon: m.icon, tone: m.tone };
  return { icon: 'layout-grid', tone: 'blue' };
}

type Node = ['path', string] | ['circle', number, number, number] | ['rect', number, number, number, number, number] | ['polyline', string];
const ICONS: Record<IconName, Node[]> = {
  'alert-triangle': [['path', 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3'], ['path', 'M12 9v4'], ['path', 'M12 17h.01']],
  bell: [['path', 'M10.268 21a2 2 0 0 0 3.464 0'], ['path', 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326']],
  'circle-check': [['circle', 12, 12, 10], ['path', 'm9 12 2 2 4-4']],
  calendar: [['path', 'M8 2v3'], ['path', 'M16 2v3'], ['rect', 3, 3, 18, 18, 2], ['path', 'M3 9h18']],
  inbox: [['polyline', '22 12 16 12 14 15 10 15 8 12 2 12'], ['path', 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z']],
  file: [
    ['path', 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z'],
    ['path', 'M14 2v5a1 1 0 0 0 1 1h5'],
    ['path', 'M10 9H8'],
    ['path', 'M16 13H8'],
    ['path', 'M16 17H8'],
  ],
  'shield-check': [
    ['path', 'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z'],
    ['path', 'm9 12 2 2 4-4'],
  ],
  'clipboard-check': [['rect', 8, 2, 8, 4, 1], ['path', 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2'], ['path', 'm9 14 2 2 4-4']],
  user: [['path', 'M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'], ['circle', 12, 7, 4]],
  'id-card': [['path', 'M16 10h2'], ['path', 'M16 14h2'], ['path', 'M6.17 15a3 3 0 0 1 5.66 0'], ['circle', 9, 11, 2], ['rect', 2, 5, 20, 14, 2]],
  clock: [['circle', 12, 12, 10], ['path', 'M12 6v6l4 2']],
  list: [['path', 'M3 5h.01'], ['path', 'M3 12h.01'], ['path', 'M3 19h.01'], ['path', 'M8 5h13'], ['path', 'M8 12h13'], ['path', 'M8 19h13']],
  'bar-chart': [['path', 'M3 3v16a2 2 0 0 0 2 2h16'], ['path', 'M18 17V9'], ['path', 'M13 17V5'], ['path', 'M8 17v-3']],
  mail: [['path', 'm22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7'], ['rect', 2, 4, 20, 16, 2]],
  'book-open': [['path', 'M12 5v16'], ['path', 'M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z']],
  'layout-grid': [['rect', 3, 3, 7, 7, 1], ['rect', 14, 3, 7, 7, 1], ['rect', 14, 14, 7, 7, 1], ['rect', 3, 14, 7, 7, 1]],
  check: [['path', 'M20 6 9 17l-5-5']],
};

export function Icon({ name, size = 16, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name].map((n, i) =>
        n[0] === 'path' ? (
          <path key={i} d={n[1]} />
        ) : n[0] === 'circle' ? (
          <circle key={i} cx={n[1]} cy={n[2]} r={n[3]} />
        ) : n[0] === 'rect' ? (
          <rect key={i} x={n[1]} y={n[2]} width={n[3]} height={n[4]} rx={n[5]} />
        ) : (
          <polyline key={i} points={n[1]} />
        ),
      )}
    </svg>
  );
}

/**
 * DashSection: a raised card with a head (icon tile, title, optional meta and right slot) and a
 * body. `as="details"` makes the head the summary of a collapsible card (Fields, Activity).
 */
export function Section({
  title,
  heading,
  meta,
  right,
  className,
  bodyClassName,
  as = 'section',
  open,
  children,
  ...rest
}: {
  /** The title text; the icon tile follows it. */
  title: string;
  /** What the head shows when it is not the plain title (keeps the title for the tile). */
  heading?: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
  as?: 'section' | 'details';
  open?: boolean;
  children: ReactNode;
} & Record<`data-${string}`, string>) {
  const { icon, tone } = headIcon(title);
  const head = (
    <>
      <span className={`head-tile tile-${tone}`} aria-hidden="true">
        <Icon name={icon} size={15} />
      </span>
      <h2 className="card-title">{heading ?? title}</h2>
      {meta ? <span className="card-meta">{meta}</span> : null}
      {right ? <span className="card-right">{right}</span> : null}
    </>
  );
  const body = <div className={`card-body${bodyClassName ? ` ${bodyClassName}` : ''}`}>{children}</div>;
  if (as === 'details')
    return (
      <details className={`card section${className ? ` ${className}` : ''}`} open={open} {...rest}>
        <summary className="card-head">{head}</summary>
        {body}
      </details>
    );
  return (
    <section className={`card section${className ? ` ${className}` : ''}`} aria-label={title} {...rest}>
      <div className="card-head">{head}</div>
      {body}
    </section>
  );
}
