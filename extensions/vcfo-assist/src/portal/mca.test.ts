/**
 * The MCA fill knowledge ported from the old filler (abdulfarhath7/vcfo_assist@5e58bcf,
 * legacy/extension/content/filler.js): the key class → node id → label lookup ladder, the event
 * order, dependent dropdown polling, value/text/prefix/contains option matching, Yes/No radios,
 * readiness and the information pop-up.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { PortalAgent } from './agent';
import { fillElement, fillWhenReady, selectIndex } from './filler';
import { scanDocument } from './scanner';
import { resolveField } from '../heal/ladder';
import type { RecipeField } from '../shared/types';

const AEM = `
<div id="guideContainer-rootPanel__">
  <div class="guideFieldNode guideTextBox proposedname1" id="node-p1"><div class="guideFieldLabel"><label for="w-p1">I.</label></div><input id="w-p1" name="x_jqName" type="text"></div>
  <div class="guideFieldNode guideDropDownList class-of-company" id="node-class"><div class="guideFieldLabel"><label for="w-class">Class of the company</label></div><select id="w-class" name="c_jqName"><option value="">Select Here</option></select></div>
  <div class="guideFieldNode guideDropDownList nic" id="node-nic"><div class="guideFieldLabel"><label for="w-nic">NIC</label></div><select id="w-nic" name="n_jqName"><option value="">Select Here</option><option value="62">62 - Computer programming</option><option value="69">69 - Legal and accounting</option></select></div>
  <div class="guideFieldNode guideCheckBox aoaEntrenched" id="node-aoa"><div class="guideFieldLabel">Whether AOA is entrenched?</div><label><input type="radio" name="aoa" value="1"> Yes</label><label><input type="radio" name="aoa" value="0"> No</label></div>
  <div class="guideFieldNode guideTextBox din7a" id="node-din-a"><div class="guideFieldLabel"><label for="w-d1">DIN</label></div><input id="w-d1" name="d1" type="text"></div>
  <div class="guideFieldNode guideTextBox din7a" id="node-din-b" style="display:none"><div class="guideFieldLabel"><label for="w-d2">DIN</label></div><input id="w-d2" name="d2" type="text"></div>
</div>
<div id="infoModal"><button id="okInfoModalBtn" type="button">OK</button></div>
<button id="send-otp" type="button">Send OTP</button>`;

const field = (f: Partial<RecipeField>): RecipeField => ({ key: 'k', label: 'L', ...f });

describe('MCA lookup ladder (T0 by key class and instance, then node id; T1 by label)', () => {
  beforeEach(() => {
    document.body.innerHTML = AEM;
  });

  it('finds a control by its .guideFieldNode key class, inside the box', async () => {
    const f = field({ key: 'company.proposedNames[0]', css: '.guideFieldNode.proposedname1', label: 'Proposed name I' });
    const scan = scanDocument(document, { probes: [f] });
    const r = await resolveField(f, scan, { claimed: new Set() });
    expect(r).toMatchObject({ found: true, tier: 'T0' });
    expect(r.found && r.candidate.id).toBe('w-p1');
  });

  it('falls back to the captured node id when the class is renamed', async () => {
    document.getElementById('node-p1')!.className = 'guideFieldNode guideTextBox renamed';
    const f = field({ key: 'a', css: '.guideFieldNode.proposedname1', nodeId: 'node-p1', label: 'Proposed name I' });
    const r = await resolveField(f, scanDocument(document, { probes: [f] }), { claimed: new Set() });
    expect(r).toMatchObject({ found: true, tier: 'T0' });
  });

  it('heals by label (T1) when neither the class nor the id is there', async () => {
    document.getElementById('node-class')!.className = 'guideFieldNode other';
    document.getElementById('node-class')!.id = 'other';
    const f = field({ key: 'company.class', css: '.guideFieldNode.class-of-company', nodeId: 'node-class', label: 'Class of the company', control: 'select' });
    const r = await resolveField(f, scanDocument(document, { probes: [f] }), { claimed: new Set() });
    expect(r).toMatchObject({ found: true, tier: 'T1' });
  });

  it('a hidden instance is "hidden"; a missing one is "noinstance"; neither is healed by label', async () => {
    const second = field({ key: 'directors[1].din', css: '.guideFieldNode.din7a', nth: 1, label: 'DIN' });
    const hidden = await resolveField(second, scanDocument(document, { probes: [second] }), { claimed: new Set() });
    expect(hidden).toMatchObject({ found: false, notHere: 'hidden' });
    const third = field({ key: 'directors[2].din', css: '.guideFieldNode.din7a', nth: 2, label: 'DIN' });
    const none = await resolveField(third, scanDocument(document, { probes: [third] }), { claimed: new Set() });
    expect(none).toMatchObject({ found: false, notHere: 'noinstance' });
  });
});

describe('MCA filler', () => {
  beforeEach(() => {
    document.body.innerHTML = AEM;
  });

  it('fires input, keyup, change and blur, in that order, through the native setter', () => {
    const el = document.getElementById('w-p1') as HTMLInputElement;
    const seen: string[] = [];
    for (const t of ['focus', 'input', 'keyup', 'change', 'blur']) el.addEventListener(t, () => seen.push(t));
    expect(fillElement(el, 'SENTINEL ALPHA PRIVATE LIMITED')).toMatchObject({ ok: true });
    expect(seen).toEqual(['focus', 'input', 'keyup', 'change', 'blur']);
    expect(el.value).toBe('SENTINEL ALPHA PRIVATE LIMITED');
  });

  it('matches options by value, then text, prefix and a unique contains', () => {
    const sel = document.getElementById('w-nic') as HTMLSelectElement;
    expect(selectIndex(sel, '69')).toBe(2);
    expect(selectIndex(sel, '62 - Computer programming')).toBe(1);
    expect(selectIndex(sel, 'legal')).toBe(2);
    expect(selectIndex(sel, 'nothing like it')).toBe(-1);
  });

  it('polls a dependent dropdown until its option loads', async () => {
    const sel = document.getElementById('w-class') as HTMLSelectElement;
    setTimeout(() => sel.add(new Option('Private', 'Private')), 350);
    expect(fillElement(sel, 'Private')).toMatchObject({ ok: false });
    const res = await fillWhenReady(sel, 'Private', 2000);
    expect(res).toMatchObject({ ok: true });
    expect(sel.value).toBe('Private');
  });

  it('answers Yes/No radios from Yes, No, true, false, y and n', () => {
    const radio = document.querySelector('input[name="aoa"]')!;
    for (const [value, want] of [['No', '0'], ['true', '1'], ['n', '0'], ['Yes', '1']]) {
      expect(fillElement(radio, value!)).toMatchObject({ ok: true });
      expect((document.querySelector('input[name="aoa"]:checked') as HTMLInputElement).value).toBe(want);
    }
  });
});

describe('MCA page helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = AEM;
  });

  it('is ready when #guideContainer-rootPanel__ shows the field, not before', () => {
    const agent = new PortalAgent(document);
    expect(agent.pageReady('#guideContainer-rootPanel__ .guideFieldNode.proposedname1')).toBe(true);
    (document.getElementById('guideContainer-rootPanel__') as HTMLElement).hidden = true;
    expect(agent.pageReady('#guideContainer-rootPanel__ .guideFieldNode.proposedname1')).toBe(false);
    expect(agent.pageReady('::bad selector')).toBe(false);
  });

  it('closes the #okInfoModalBtn information pop-up, and never a pop-up button that reads like Send OTP', () => {
    const agent = new PortalAgent(document);
    const clicked: string[] = [];
    document.addEventListener('click', (e) => clicked.push((e.target as HTMLElement).id), true);
    expect(agent.closePopups(['#okInfoModalBtn', '#send-otp', '#missing'])).toBe(1);
    expect(clicked).toEqual(['okInfoModalBtn']);
  });
});
