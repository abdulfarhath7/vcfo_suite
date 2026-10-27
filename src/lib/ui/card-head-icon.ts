/**
 * The icon tile before a card title comes from the title (rule R-16 and the
 * icon table in the prototype's docs/RULES.md). The first row whose words
 * appear in the title sets the icon and tone; a title that matches nothing
 * gets the grid icon in blue. Matching ignores case and works on whole words
 * or word starts, so "Approvals" matches "approval".
 */
export type CardHeadIconName =
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
  | 'layout-grid';

export type CardHeadTone = 'red' | 'amber' | 'green' | 'teal' | 'blue' | 'violet';

const TABLE: Array<[CardHeadIconName, CardHeadTone, string[]]> = [
  ['alert-triangle', 'red', ['risk', 'stuck', 'overdue', 'incident', 'escalation', 'broken']],
  ['bell', 'amber', ['alert', 'update', 'notification', 'announcement']],
  ['circle-check', 'green', ['approval', 'decision', 'granted']],
  ['calendar', 'teal', ['timeline', 'week', 'calendar', 'what is next', 'coming', 'deadline', 'schedule', 'renewal', 'plan']],
  ['inbox', 'blue', ['inbox', 'triage', 'message']],
  ['file', 'amber', ['need', 'document', 'docs', 'vault', 'upload', 'file']],
  ['shield-check', 'green', ['compliance', 'filing', 'obligation', 'statute', 'status']],
  ['clipboard-check', 'teal', ['what sbc is doing', 'holds', 'pending with', 'progress flow']],
  ['user', 'violet', ['waiting', 'client', 'people', 'lead', 'manager', 'team', 'who']],
  ['id-card', 'violet', ['registration', 'ids', 'identity', 'credential']],
  ['clock', 'violet', ['activity', 'audit', 'recent', 'history', 'log']],
  ['list', 'blue', ['step', 'queue', 'work', 'task', 'action', 'post-incorporation']],
  ['bar-chart', 'blue', ['phase', 'practice', 'analytics', 'growth', 'report', 'chart', 'health', 'area', 'service']],
  ['mail', 'blue', ['email', 'mail']],
  ['book-open', 'teal', ['library', 'knowledge', 'sop', 'book']],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MATCHERS = TABLE.map(([icon, tone, words]) => ({
  icon,
  tone,
  re: new RegExp(`(^|[^a-z])(${words.map(escape).join('|')})`, 'i'),
}));

export function cardHeadIcon(title: string): { icon: CardHeadIconName; tone: CardHeadTone } {
  const t = title.replace(/[’']/g, "'");
  for (const m of MATCHERS) if (m.re.test(t)) return { icon: m.icon, tone: m.tone };
  return { icon: 'layout-grid', tone: 'blue' };
}

/** Token pair (soft ground, text-safe glyph) for each tile tone. */
export const CARD_HEAD_TONE_TOKENS: Record<CardHeadTone, { bg: string; fg: string }> = {
  red: { bg: 'danger-soft', fg: 'danger' },
  amber: { bg: 'warning-soft', fg: 'warning' },
  green: { bg: 'positive-soft', fg: 'positive' },
  teal: { bg: 'info-soft', fg: 'info' },
  blue: { bg: 'brand-soft', fg: 'brand' },
  violet: { bg: 'identity-soft', fg: 'identity' },
};
