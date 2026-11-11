/**
 * The portal recorder's rules (tools/recorder/README.md), checked on its redaction helpers and on
 * its own source: no stealth, no value stored, no secret header or body, no PII in saved pages.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_RECORDER_CODE, elementRecord, eventRecord, maskPii, networkRecord, redactHtml, stripQuery } from '../../tools/recorder/redact.mjs';

const DIR = path.resolve(__dirname, '../../tools/recorder');
const source = readFileSync(path.join(DIR, 'recorder.mjs'), 'utf8');

describe('recorder source', () => {
  it('hides nothing and defeats no portal control: no webdriver override, no AutomationControlled flag, no script blocking, no stealth', () => {
    for (const re of FORBIDDEN_RECORDER_CODE) expect(source, String(re)).not.toMatch(re);
    expect(source).not.toMatch(/\.route\(/);
    expect(source).not.toMatch(/defineProperty\(\s*navigator/);
  });

  it('runs no arbitrary code from a control file and writes outside any git repository by default', () => {
    expect(source).not.toMatch(/cmd\.txt|eval\(/);
    expect(source).toMatch(/vcfo-captures/);
    expect(source).toMatch(/inside the git repository/);
    expect(source).toMatch(/keepProfile/);
    expect(source).toMatch(/rmSync\(PROFILE_DIR/);
  });

  it('logs the network only on request, and only through networkRecord', () => {
    expect(source).toMatch(/if \(OPTS\.network\)/);
    expect(source).not.toMatch(/headers\(\)\)|postData|\.text\(\)|\.body\(\)/);
  });
});

describe('redaction', () => {
  it('keeps method, path, status and content type of a request, and nothing else', () => {
    const rec = networkRecord({ ts: 't', step: 1, type: 'xhr', method: 'POST', url: 'https://www.mca.gov.in/bin/api?token=abc&session=x', status: 200, contentType: 'application/json; charset=utf-8' });
    expect(rec).toEqual({ ts: 't', step: 1, type: 'xhr', method: 'POST', path: 'https://www.mca.gov.in/bin/api', status: 200, contentType: 'application/json' });
    expect(JSON.stringify(rec)).not.toMatch(/token|session|cookie|authorization/i);
    expect(stripQuery('https://x.gov.in/a/b.html?sid=1#frag')).toBe('https://x.gov.in/a/b.html');
  });

  it('strips values, scripts, selections, secret meta tags and query strings from a saved page', () => {
    const html = `<html><head><meta name="csrf-token" content="SECRET123"><script>var token="abc";</script></head><body>
      <input name="pan" value="ABCDE1234F"><input type="hidden" name="jsessionid" value="XYZ">
      <textarea>typed text</textarea><select><option value="M" selected>Male</option></select>
      <input type="radio" checked><a href="/next?token=abc">Next</a><form action="/post?sid=1"></form></body></html>`;
    const out = redactHtml(html);
    expect(out).not.toMatch(/ABCDE1234F|XYZ|SECRET123|var token|typed text|selected|checked|token=abc|sid=1/);
    expect(out).toContain('href="/next"');
  });

  it('masks PAN, Aadhaar, DIN, email and phone shaped text unless the capture is of a dummy client', () => {
    const page = '<p>Ravi ABCDE1234F 1234 5678 9012 din 01234567 ravi@example.in +91 9876543210</p>';
    const masked = redactHtml(page);
    expect(masked).toContain('[PAN]');
    expect(masked).toContain('[AADHAAR]');
    expect(masked).toContain('[DIN]');
    expect(masked).toContain('[EMAIL]');
    expect(masked).toContain('[PHONE]');
    expect(masked).not.toMatch(/ABCDE1234F|9012|01234567|ravi@example|9876543210/);
    expect(redactHtml(page, { dummyClient: true })).toContain('ABCDE1234F');
    // Ids and keys stay readable.
    expect(maskPii('din7a')).toBe('din7a');
  });

  it('records a field as filled yes or no, never its value, and masks people in option lists', () => {
    const rec = elementRecord({ tag: 'select', name: 'Directornamelist', label: 'Director', hasValue: true, options: [{ v: '', t: 'Select Here' }, { v: 'SUNIL-08325560', t: 'SUNIL-08325560' }] });
    expect(rec.filled).toBe('yes');
    expect(JSON.stringify(rec)).not.toContain('08325560');
    expect(rec).not.toHaveProperty('value');
    const otp = elementRecord({ tag: 'input', name: 'MobileOTP', hasValue: true });
    expect(otp).toMatchObject({ secret: true, filled: 'yes' });
  });

  it('records a change as filled yes or no, and a button by its text, never what was typed', () => {
    const change = eventRecord({ kind: 'change', target: { tag: 'input', name: 'pan6c', label: 'PAN' }, hasValue: true, value: 'ABCDE1234F' });
    expect(change).toMatchObject({ kind: 'change', filled: 'yes' });
    expect(JSON.stringify(change)).not.toContain('ABCDE1234F');
    const click = eventRecord({ kind: 'click', target: { tag: 'button', isButton: true, text: 'Save' } });
    expect(click.target.text).toBe('Save');
    const nav = eventRecord({ kind: 'navigate', url: 'https://www.mca.gov.in/x.html?token=1' });
    expect(nav.url).toBe('https://www.mca.gov.in/x.html');
  });
});
