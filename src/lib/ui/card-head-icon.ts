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
  teal: { bg: 'waiting-soft', fg: 'waiting' },
  blue: { bg: 'brand-soft', fg: 'brand' },
  violet: { bg: 'identity-soft', fg: 'identity' },
};

/**
 * Glyphs for the home card's number tiles (R-18). The prototype picks a fitting glyph per tile
 * (Building2 for clients, Rocket for incorporating, CheckCheck for done today); this table does
 * the same from the tile label. The first row whose words start a word in the label wins; a
 * label that matches nothing falls back to the card-head table above.
 */
export type TileIconName =
  | CardHeadIconName
  | 'building'
  | 'rocket'
  | 'list-checks'
  | 'calendar-days'
  | 'calendar-check'
  | 'check-check'
  | 'check-circle'
  | 'circle-alert'
  | 'message-warning'
  | 'award'
  | 'key'
  | 'gauge'
  | 'trending-up'
  | 'trophy'
  | 'circle-dashed';

const TILE_TABLE: Array<[TileIconName, string[]]> = [
  ['message-warning', ['messages failed', 'message failed']],
  ['circle-alert', ['jobs failed', 'failed', 'errors']],
  ['check-check', ['done today', 'completed today']],
  ['check-circle', ['filed', 'done to date', 'done', 'granted', 'approved']],
  ['circle-dashed', ['not started']],
  ['alert-triangle', ['overdue', 'stuck', 'need attention', 'needs attention', 'at risk', 'late']],
  ['list-checks', ['needs action', 'need action', 'awaiting review', 'review', 'open steps', 'tasks', 'actions']],
  ['user', ['waiting']],
  ['calendar-days', ['due this week', 'due this month', 'this week', 'this month']],
  ['calendar-check', ['due soon', 'due in', 'filings due', 'filings in', 'due']],
  ['clock', ['in progress', 'still to file', 'pending']],
  ['building', ['clients', 'client', 'with sbc', 'companies', 'firms']],
  ['rocket', ['incorporating', 'incorporations', 'setup']],
  ['shield-check', ['in compliance', 'incorporated', 'compliant', 'on time']],
  ['award', ['coi', 'days to']],
  ['file', ['documents', 'docs', 'files', 'uploads']],
  ['id-card', ['registrations', 'ids', 'credentials']],
  ['key', ['secrets', 'denied', 'keys']],
  ['gauge', ['error rate', 'room', 'capacity', 'services', 'working', 'healthy', 'uptime']],
  ['trending-up', ['prospects', 'pipeline', 'growth']],
  ['trophy', ['won', 'proposals']],
  ['mail', ['mailboxes', 'outlook', 'email', 'mail']],
  ['calendar', ['renewals', 'upcoming']],
];

const TILE_MATCHERS = TILE_TABLE.map(([icon, words]) => ({
  icon,
  re: new RegExp(`(^|[^a-z])(${words.map(escape).join('|')})`, 'i'),
}));

export function tileIconName(label: string): TileIconName {
  const t = label.replace(/[’']/g, "'");
  for (const m of TILE_MATCHERS) if (m.re.test(t)) return m.icon;
  return cardHeadIcon(label).icon;
}
