import { describe, expect, it } from 'vitest';
import { parseRobots, robotsAllows } from '../robots';

describe('robots rules', () => {
  it('uses the star group when nothing names us', () => {
    const robots = parseRobots('User-agent: *\nDisallow: /private\nAllow: /private/open\nCrawl-delay: 5\n');
    expect(robotsAllows(robots, '/private/x')).toBe(false);
    expect(robotsAllows(robots, '/private/open/a.pdf')).toBe(true);
    expect(robotsAllows(robots, '/public')).toBe(true);
    expect(robots.crawlDelayMs).toBe(5000);
  });

  it('prefers the group naming our product over the star group', () => {
    const robots = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: VCFO-Suite\nAllow: /\n');
    expect(robotsAllows(robots, '/anything')).toBe(true);
    // A User-agent line left empty names nobody, and does not stand in front of the wildcard.
    expect(robotsAllows(parseRobots('User-agent:\nAllow: /\n\nUser-agent: *\nDisallow: /\n'), '/a')).toBe(false);
    const shut = parseRobots('User-agent: *\nAllow: /\n\nUser-agent: vcfo-suite\nDisallow: /\n');
    expect(robotsAllows(shut, '/anything')).toBe(false);
  });

  it('takes a group only for our whole product token, never a shorter name that starts it', () => {
    const robots = parseRobots('User-agent: v\nAllow: /\n\nUser-agent: vcfo\nAllow: /\n\nUser-agent: *\nDisallow: /circulars\n');
    expect(robotsAllows(robots, '/circulars/a.pdf')).toBe(false);
  });

  it('handles wildcards, end anchors and comments, and an empty Disallow allows', () => {
    const robots = parseRobots('# hello\nUser-agent: *\nDisallow: /*.pdf$ # no pdfs\nDisallow:\n');
    expect(robotsAllows(robots, '/a/b.pdf')).toBe(false);
    expect(robotsAllows(robots, '/a/b.pdf?x=1')).toBe(true);
    expect(robotsAllows(parseRobots('User-agent: *\nDisallow:\n'), '/x')).toBe(true);
  });

  it('merges consecutive agent lines into one group', () => {
    const robots = parseRobots('User-agent: a\nUser-agent: *\nDisallow: /x\n');
    expect(robotsAllows(robots, '/x')).toBe(false);
  });

  it('matches a site\'s rule with many wildcards in a moment', () => {
    const started = Date.now();
    const robots = parseRobots(`User-agent: *\nDisallow: /${'*a'.repeat(12)}b\nDisallow: /${'*'.repeat(500)}x$\n`);
    expect(robotsAllows(robots, `/${'a'.repeat(40)}`)).toBe(true);
    expect(robotsAllows(robots, `/${'a'.repeat(5_000)}`)).toBe(true);
    expect(robotsAllows(robots, `/${'a'.repeat(40)}b`)).toBe(false);
    expect(robotsAllows(robots, '/ax')).toBe(false);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
