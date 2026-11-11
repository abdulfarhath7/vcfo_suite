import { generateKeyPairSync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import spiceA from './recipes/spice-a.json';
import spiceB from './recipes/spice-b.json';
import { canonicalJson, fieldRejectsPlaceholder, findRecipeField, parseRecipe, recipeSchema } from './recipe';
import { guideKeysOf } from './mock-fields';
import { getPack, getRecipe, listPacks, listRecipes, rawRecipeFiles } from './registry';
import { resolveRecipe } from './recipe';
import { DEV_KEY_ID, devRecipeSigner, rawPublicKey, recipeSigner, signRecipe, verifyRecipeSignature } from './signing';
import { createPublicKey } from 'node:crypto';

/** The captured MCA schemas the recipes were rewritten from (abdulfarhath7/vcfo_assist@5e58bcf). */
const SCHEMAS = path.resolve(__dirname, '../../../extensions/vcfo-assist/portal-data/mca-v3/schemas');
const schemaKeys = (form: string): Set<string> => {
  const raw = JSON.parse(readFileSync(path.join(SCHEMAS, `${form}.json`), 'utf8')) as { fields: Array<{ semantic: string[] }> };
  return new Set(raw.fields.flatMap((f) => f.semantic));
};
const FORM_OF: Record<string, string> = { 'spice-a': 'spice-part-a', 'spice-b': 'spice-part-b', 'agile-pro-s': 'agile-pro-s', emoa: 'inc-33-emoa', eaoa: 'inc-34-eaoa' };

describe('spice-a recipe (real MCA keys)', () => {
  const recipe = parseRecipe(spiceA);

  it('parses as v2.0.0, checked against the capture, on the mca-v3 pack', () => {
    expect(recipe).toMatchObject({ id: 'spice-a', version: '2.0.0', verifiedAgainst: 'capture', pack: 'mca-v3' });
    expect(recipe.capturedFrom).toMatch(/5e58bcf/);
    // Part A is a web form with no DSC: the person logs in, submits and pays.
    expect(recipe.gates).toEqual(['LOGIN', 'CAPTCHA', 'OTP', 'SUBMIT', 'PAY']);
  });

  it('takes the real URL, ready check and info pop-up from the pack', () => {
    const page = getRecipe('spice-a')!.pages[0]!;
    expect(page.urlPattern).toBe('/content/mca/global/en/mca/e-filing/incorporation-change-services/spice.html');
    expect(page.mockUrlPattern).toBe('/spice-a*.html');
    expect(page.ready).toEqual({ css: '#guideContainer-rootPanel__ .guideFieldNode.type-of-company' });
    expect(page.closePopups).toEqual([{ css: '#okInfoModalBtn' }]);
    expect(getRecipe('spice-a')!.waits).toEqual({ readyMs: 30000, optionsMs: 8000, afterPincodeMs: 2000 });
  });

  it('uses the real keys: type-of-company, proposedname1, proposedname2, nic-text-box', () => {
    const css = Object.fromEntries(recipe.fields.map((f) => [f.key, f.css]));
    expect(css['company.type']).toBe('.guideFieldNode.type-of-company');
    expect(css['company.proposedNames[0]']).toBe('.guideFieldNode.proposedname1');
    expect(css['company.proposedNames[1]']).toBe('.guideFieldNode.proposedname2');
    expect(css['company.nicCode']).toBe('.guideFieldNode.nic-text-box');
    expect(recipe.fields.filter((f) => f.waitForOptions).map((f) => f.key)).toEqual(['company.class', 'company.category', 'company.subCategory']);
  });

  it('carries the real buttons: Save and Auto check are safe; Submit and Pay are human', () => {
    expect(recipe.actions.map((a) => [a.id, a.kind])).toEqual([['save-draft', 'safe'], ['auto-check', 'safe'], ['submit', 'human'], ['pay', 'human']]);
  });

  it('leaves the fields the capture lacks to the user', () => {
    for (const key of ['company.nameSignificance', 'company.trademarkSimilar']) {
      const f = recipe.fields.find((x) => x.key === key)!;
      expect(f.askUser).toBe(true);
      expect(f.note).toMatch(/not in the 2026-09-23 capture/);
    }
  });

  it('reads profile keys only, never a value', () => {
    for (const field of recipe.fields) expect(field.key.startsWith('company.')).toBe(true);
    expect(JSON.stringify(recipe)).not.toMatch(/"value"/);
  });

  it('has an SRN pattern that finds an MCA reference', () => {
    const srn = recipe.expect.find((e) => e.kind === 'srn')!;
    expect('Your SRN is AA1234567 for this form'.match(new RegExp(srn.pattern))?.[0]).toBe('AA1234567');
  });

  it('is served by the registry', () => {
    expect(getRecipe('spice-a')?.version).toBe('2.0.0');
    expect(getRecipe('nope')).toBeNull();
    expect(listRecipes().map((r) => r.id)).toEqual(['spice-a', 'spice-b', 'agile-pro-s', 'emoa', 'eaoa']);
  });
});

describe('every MCA recipe binds real captured keys', () => {
  it.each(Object.entries(FORM_OF))('%s: every verified key exists in the capture, and its node id too', (id, form) => {
    const recipe = getRecipe(id)!;
    const keys = schemaKeys(form);
    const raw = JSON.parse(readFileSync(path.join(SCHEMAS, `${form}.json`), 'utf8')) as { fields: Array<{ id: string }> };
    const ids = new Set(raw.fields.map((f) => f.id));
    for (const field of recipe.fields) {
      if (field.note?.startsWith('Unverified')) continue;
      const key = /^\.guideFieldNode\.(.+)$/.exec(field.css ?? '')?.[1];
      expect(key && keys.has(key), `${id} ${field.key} → ${field.css}`).toBe(true);
      if (field.nodeId) expect(ids.has(field.nodeId), `${id} ${field.nodeId}`).toBe(true);
    }
    expect(recipe).toMatchObject({ verifiedAgainst: 'capture', pack: 'mca-v3' });
    expect(guideKeysOf(recipe).length).toBeGreaterThan(0);
  });

  it('binds only keys the Assist profile has (src/lib/assist-profile/types.ts)', () => {
    const allowed = /^(company\.(proposedNames\[\d\]|type|class|category|subCategory|nicCode|nameSignificance|trademarkSimilar|aoaEntrenched|capital\.equity\.(classes|className|authorizedShares|subscribedShares|faceValue))|registeredOffice\.(line1|line2|pincode|area|city|district|state|countryCode|mobile|email|longitude|latitude|rocOffice)|agile\.numberOfDirectors|moa\.witness\.(name|address)|aoa\.witness\.(name|addressDescriptionOccupation|dinPanMembership)|(subscribers|directors)\[\{i\}\]\.(din|firstName|middleName|surName|father\.(firstName|middleName|surName)|gender|dob|nationality|placeOfBirth|pan|email|mobile|citizenOfIndia|residentInIndia|designation|place|shares\.equity\.number))$/;
    for (const recipe of listRecipes()) for (const f of recipe.fields) expect(f.key, `${recipe.id}`).toMatch(allowed);
  });
});

describe('recipe schema', () => {
  const base = parseRecipe(spiceA);

  it('refuses a safe Submit, OTP, Confirm or Delete action', () => {
    for (const label of ['Submit', 'Send OTP', 'Confirm', 'Delete', 'e-Verify']) {
      const bad = { ...base, actions: [{ id: 'x', label, kind: 'safe', match: { text: label } }] };
      expect(recipeSchema.safeParse(bad).success, label).toBe(false);
    }
  });

  it('refuses duplicate field keys, unknown pages and a bad version', () => {
    expect(recipeSchema.safeParse({ ...base, fields: [base.fields[0], base.fields[0]] }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...base.fields[0], page: 'other' }] }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...base, version: '1.0' }).success).toBe(false);
  });

  it('refuses unknown keys, so a recipe cannot smuggle a value in', () => {
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...base.fields[0], value: 'X' }] }).success).toBe(false);
  });

  it('needs a locator on every field, and a pack for a pack page', () => {
    const { css: _css, nodeId: _n, ...bare } = base.fields[0]!;
    expect(recipeSchema.safeParse({ ...base, fields: [bare] }).success).toBe(false);
    const { pack: _pack, ...noPack } = base;
    expect(recipeSchema.safeParse(noPack).success).toBe(false);
  });

  it('noPlaceholder (G16) defaults to true for mandatory fields and may be declared', () => {
    expect(fieldRejectsPlaceholder({ required: true })).toBe(true);
    expect(fieldRejectsPlaceholder({ required: false })).toBe(false);
    expect(fieldRejectsPlaceholder({ required: false, noPlaceholder: true })).toBe(true);
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...base.fields[0], noPlaceholder: true }] }).success).toBe(true);
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...base.fields[0], noPlaceholder: 'yes' }] }).success).toBe(false);
  });

  it('stays backwards compatible: a recipe with its own URL, ready check and SOM paths and no pack parses', () => {
    const legacy = {
      id: 'legacy', version: '1.0.0', title: 'Legacy', subAgent: 'spice-a', verifiedAgainst: 'mock',
      pages: [{ id: 'p', title: 'P', urlPattern: '/x*.html', ready: { som: 'guide[0]' } }],
      fields: [{ key: 'company.type', page: 'p', som: 'guide[0].a[0]', css: '[name="a"]', label: 'A', required: true }],
      actions: [], gates: ['LOGIN', 'DSC', 'SUBMIT', 'PAY'], expect: [],
    };
    expect(parseRecipe(legacy).pack).toBeUndefined();
    expect(resolveRecipe(parseRecipe(legacy), new Map())).toEqual(parseRecipe(legacy));
  });
});

describe('recipes reference their pack', () => {
  it('every recipe names a pack the registry holds, its pages exist there, and its gates are the pack\'s', () => {
    for (const recipe of rawRecipeFiles()) {
      const pack = getPack(recipe.pack!)!;
      expect(pack, recipe.id).toBeTruthy();
      for (const page of recipe.pages) expect(pack.pages.some((p) => p.id === page.packPage), `${recipe.id} ${page.packPage}`).toBe(true);
      for (const gate of recipe.gates) expect(pack.gates, `${recipe.id} ${gate}`).toContain(gate);
    }
  });

  it('refuses a recipe whose pack or pack page is unknown', () => {
    const raw = parseRecipe(spiceA);
    const packs = new Map(listPacks().map((p) => [p.id, p]));
    expect(() => resolveRecipe({ ...raw, pack: 'nope' }, packs)).toThrow(/unknown pack/);
    expect(() => resolveRecipe({ ...raw, pages: [{ id: 'part-a', packPage: 'nope' }] }, packs)).toThrow(/unknown pack page/);
  });
});

describe('spice-b recipe (real MCA keys)', () => {
  const recipe = parseRecipe(spiceB);

  it('parses as v2.0.0 against the capture, with the four wizard sections as pack pages', () => {
    expect(recipe).toMatchObject({ id: 'spice-b', version: '2.0.0', subAgent: 'spice-b', verifiedAgainst: 'capture', pack: 'mca-v3' });
    expect(recipe.pages.map((p) => p.packPage)).toEqual(['spice-b-structure', 'spice-b-address', 'spice-b-subscribers', 'spice-b-directors']);
    const served = getRecipe('spice-b')!;
    for (const page of served.pages) {
      expect(page.urlPattern).toBe('/content/mca/global/en/mca/e-filing/incorporation-change-services/SpicePartB.html');
      expect(page.step).toMatch(/section|Add\/Edit/);
    }
    expect(recipe.gates).toEqual(['LOGIN', 'CAPTCHA', 'OTP', 'DSC', 'SUBMIT', 'PAY']);
  });

  it('uses the real keys for capital, office and the subscriber and director blocks', () => {
    const css = (key: string, slot?: string) => recipe.fields.find((f) => f.key === key && f.slot === slot)?.css;
    expect(css('company.capital.equity.authorizedShares')).toBe('.guideFieldNode.numberofeshares_1');
    expect(css('company.capital.equity.faceValue')).toBe('.guideFieldNode.amountpershare_1');
    expect(css('registeredOffice.line1')).toBe('.guideFieldNode.correspondenceaddressline1');
    expect(css('registeredOffice.pincode')).toBe('.guideFieldNode.correspondenceaddress_pinCode');
    expect(css('registeredOffice.email')).toBe('.guideFieldNode.correspondenceaddress_emailID');
    expect(css('subscribers[{i}].din', '6b')).toBe('.guideFieldNode.din6b');
    expect(css('subscribers[{i}].firstName', '6c')).toBe('.guideFieldNode.firstName6c');
    expect(css('directors[{i}].din', '7a')).toBe('.guideFieldNode.din7a');
    expect(css('directors[{i}].pan', '7b')).toBe('.guideFieldNode.pan7b');
    expect(css('directors[{i}].firstName', '7b')).toBe('.guideFieldNode.firstName7bp');
    expect(recipe.fields.find((f) => f.key === 'registeredOffice.pincode')?.lookup).toBe(true);
  });

  it('splits subscribers and directors by DIN with `where`, and shares the director blocks with subscriber-directors', () => {
    const where = (key: string, slot: string) => recipe.fields.find((f) => f.key === key && f.slot === slot)?.where;
    expect(where('subscribers[{i}].din', '6b')).toEqual({ kind: 'individual', din: true });
    expect(where('subscribers[{i}].firstName', '6c')).toEqual({ kind: 'individual', din: false });
    expect(where('subscribers[{i}].din', '7a')).toEqual({ kind: 'individual', isDirector: true, din: true });
    expect(where('directors[{i}].din', '7a')).toEqual({ din: true });
    // Subscriber-directors come first, so they take the first director blocks.
    const order = recipe.fields.map((f) => `${f.each}:${f.slot}`);
    expect(order.indexOf('subscribers:7a')).toBeLessThan(order.indexOf('directors:7a'));
  });

  it('leaves the director designation to the user (Suite does not hold it)', () => {
    for (const f of recipe.fields.filter((x) => x.key.endsWith('.designation'))) expect(f.askUser).toBe(true);
  });

  it('finds the template for a concrete repeating key, with its slot', () => {
    expect(findRecipeField(recipe, 'directors[1].din@7a')?.key).toBe('directors[{i}].din');
    expect(findRecipeField(recipe, 'subscribers[0].shares.equity.number@6b')?.slot).toBe('6b');
    expect(findRecipeField(recipe, 'registeredOffice.pincode')?.key).toBe('registeredOffice.pincode');
    expect(findRecipeField(recipe, 'directors[1].din')).toBeNull();
    expect(findRecipeField(recipe, 'directors[x].din@7a')).toBeNull();
    expect(findRecipeField(recipe, 'directors[1].nope@7a')).toBeNull();
  });
});

describe('repeating fields (each)', () => {
  const base = parseRecipe(spiceB);
  const template = base.fields.find((f) => f.each === 'directors')!;

  it('needs the key to start with the array and {i}, and an instance in the selector (nth or a placeholder)', () => {
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...template, key: 'directors[0].firstName' }] }).success).toBe(false);
    const { nth: _nth, ...noNth } = template;
    expect(recipeSchema.safeParse({ ...base, fields: [noNth] }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...template, som: 'a[0].director[0].firstName[0]' }] }).success).toBe(false);
  });

  it('refuses a placeholder or a `where` on a field without each', () => {
    const { each: _each, nth: _nth, where: _where, ...plain } = template;
    expect(recipeSchema.safeParse({ ...base, fields: [plain] }).success).toBe(false);
    const single = base.fields.find((f) => !f.each)!;
    expect(recipeSchema.safeParse({ ...base, fields: [{ ...single, where: { din: true } }] }).success).toBe(false);
  });
});

describe('canonical JSON', () => {
  it('sorts keys at every depth', () => {
    expect(canonicalJson({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
  });
});

describe('Ed25519 recipe signatures', () => {
  const recipe = parseRecipe(spiceA);
  const pair = generateKeyPairSync('ed25519');
  const PROD = { ASSIST_RECIPE_PRIVATE_KEY: pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString() };

  it('signs with the dev key when no private key is set, deterministically', () => {
    const signed = signRecipe(recipe, {});
    expect(signed).toMatchObject({ alg: 'ed25519', keyId: DEV_KEY_ID });
    expect(Buffer.from(signed.sig, 'base64')).toHaveLength(64);
    expect(signRecipe(recipe, {}).sig).toBe(signed.sig);
    expect(verifyRecipeSignature(recipe, signed.sig, devRecipeSigner().publicKey)).toBe(true);
  });

  it('signs with ASSIST_RECIPE_PRIVATE_KEY as "prod", or its own key id, and the dev key cannot verify it', () => {
    const signed = signRecipe(recipe, PROD);
    expect(signed.keyId).toBe('prod');
    expect(verifyRecipeSignature(recipe, signed.sig, pair.publicKey)).toBe(true);
    expect(verifyRecipeSignature(recipe, signed.sig, devRecipeSigner().publicKey)).toBe(false);
    expect(signRecipe(recipe, { ...PROD, ASSIST_RECIPE_KEY_ID: 'prod-2027' }).keyId).toBe('prod-2027');
  });

  it('reads a PEM given on one line with literal \\n', () => {
    const oneLine = PROD.ASSIST_RECIPE_PRIVATE_KEY.trim().replace(/\n/g, '\\n');
    expect(rawPublicKey(recipeSigner({ ASSIST_RECIPE_PRIVATE_KEY: oneLine }).publicKey)).toBe(rawPublicKey(pair.publicKey));
  });

  it('refuses a non-Ed25519 key and the reserved dev key id', () => {
    const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    expect(() => signRecipe(recipe, { ASSIST_RECIPE_PRIVATE_KEY: ec })).toThrow(/Ed25519/);
    expect(() => signRecipe(recipe, { ...PROD, ASSIST_RECIPE_KEY_ID: 'dev' })).toThrow(/dev/);
  });

  it('fails on one changed byte and on a malformed signature', () => {
    const { sig } = signRecipe(recipe, {});
    const key = devRecipeSigner().publicKey;
    const tampered = { ...recipe, fields: recipe.fields.map((f, i) => (i === 0 ? { ...f, som: 'evil' } : f)) };
    expect(verifyRecipeSignature(tampered, sig, key)).toBe(false);
    expect(verifyRecipeSignature(recipe, 'not base64!', key)).toBe(false);
    expect(verifyRecipeSignature(recipe, Buffer.alloc(64).toString('base64'), key)).toBe(false);
  });
});

/**
 * One recipe source: the extension ships `src/recipes/bundled.json`, which
 * `scripts/assist-recipes-bundle.ts` writes from this registry. This fails when they drift.
 */
describe('the extension bundle matches the registry', () => {
  const root = path.resolve(__dirname, '../../..');
  const bundle = JSON.parse(readFileSync(path.join(root, 'extensions/vcfo-assist/src/recipes/bundled.json'), 'utf8')) as {
    devPublicKey: string;
    recipes: Record<string, { recipe: unknown; sig: string; alg: string; keyId: string }>;
  };
  const extensionKeys = readFileSync(path.join(root, 'extensions/vcfo-assist/src/engine/recipe.ts'), 'utf8');
  const devKey = rawPublicKey(devRecipeSigner().publicKey);

  it('holds every registry recipe, byte for byte, with the dev signature Suite makes', () => {
    expect(Object.keys(bundle.recipes).sort()).toEqual(listRecipes().map((r) => r.id).sort());
    for (const recipe of listRecipes()) {
      const entry = bundle.recipes[recipe.id]!;
      expect(canonicalJson(entry.recipe), `${recipe.id}: rerun scripts/assist-recipes-bundle.ts`).toBe(canonicalJson(recipe));
      expect(entry).toMatchObject({ alg: 'ed25519', keyId: 'dev', sig: signRecipe(recipe, {}).sig });
    }
  });

  it("names Suite's dev public key, and the extension's key map holds the same key", () => {
    expect(bundle.devPublicKey).toBe(devKey);
    expect(extensionKeys).toContain(`dev: '${devKey}'`);
    expect(createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: devKey }, format: 'jwk' }).equals(devRecipeSigner().publicKey)).toBe(true);
  });
});
