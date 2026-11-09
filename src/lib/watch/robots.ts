/**
 * robots.txt for the Watch crawler. A pure parser and matcher per RFC 9309: the group naming our
 * product token wins over `*`, the longest matching path rule decides and Allow wins a tie.
 * `Crawl-delay` is not in the RFC, but it is honoured because the owner asked for rate limits.
 */
export const ROBOTS_AGENT_TOKEN = 'vcfo-suite';

export interface RobotsRules {
  rules: Array<{ allow: boolean; path: string }>;
  crawlDelayMs: number | null;
}

interface Group {
  agents: string[];
  rules: RobotsRules['rules'];
  crawlDelayMs: number | null;
}

export const ALLOW_ALL: RobotsRules = { rules: [], crawlDelayMs: null };
export const DENY_ALL: RobotsRules = { rules: [{ allow: false, path: '/' }], crawlDelayMs: null };

export function parseRobots(text: string): RobotsRules {
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelayMs: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value) current.rules.push({ allow: key === 'allow', path: value });
    } else if (key === 'crawl-delay') {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelayMs = seconds * 1000;
    }
  }
  // RFC 9309 matches the whole product token, in any letter case, so "User-agent: v" is another crawler's group.
  const named = groups.filter((g) => g.agents.includes(ROBOTS_AGENT_TOKEN));
  const chosen = named.length > 0 ? named : groups.filter((g) => g.agents.includes('*'));
  return {
    rules: chosen.flatMap((g) => g.rules),
    crawlDelayMs: chosen.reduce<number | null>((max, g) => (g.crawlDelayMs == null ? max : Math.max(max ?? 0, g.crawlDelayMs)), null),
  };
}

/**
 * A rule's `*` matches any run and a final `$` anchors the end. A site writes the rule, so it is matched
 * by a scan that goes back only to the last `*`, at most rule times path steps: as a regular expression,
 * a rule with a dozen stars takes a minute on a forty-character path.
 */
function ruleMatches(rulePath: string, target: string): boolean {
  const pattern = rulePath.endsWith('$') ? rulePath.slice(0, -1) : `${rulePath}*`;
  let p = 0;
  let t = 0;
  let star = -1;
  let resume = 0;
  while (t < target.length) {
    if (pattern[p] === '*') {
      star = p++;
      resume = t;
    } else if (p < pattern.length && pattern[p] === target[t]) {
      p += 1;
      t += 1;
    } else if (star >= 0) {
      p = star + 1;
      t = ++resume;
    } else return false;
  }
  while (pattern[p] === '*') p += 1;
  return p === pattern.length;
}

export function robotsAllows(robots: RobotsRules, pathAndQuery: string): boolean {
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of robots.rules) {
    if (!ruleMatches(rule.path, pathAndQuery)) continue;
    if (!best || rule.path.length > best.length || (rule.path.length === best.length && rule.allow)) {
      best = { allow: rule.allow, length: rule.path.length };
    }
  }
  return best ? best.allow : true;
}
