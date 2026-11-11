import { describe, expect, it } from 'vitest';
import { SUITE_PATHS, SuiteClient, parseAttestation, parseCatalog, parseSignedRecipe } from './suite-client';

describe('suite client', () => {
  it('"Fix in Suite" opens Suite\'s step link, which redirects to the role\'s own step page', () => {
    expect(SUITE_PATHS.fixInSuite('acme-labs', 'pre-14')).toBe('/api/assist/step-link/acme-labs?step=pre-14');
    expect(SUITE_PATHS.fixInSuite('eng 1')).toBe('/api/assist/step-link/eng%201');
    expect(SUITE_PATHS.fixInSuite('')).toBe('/');
  });

  it('keeps the signature, algorithm and key id of a served recipe', () => {
    expect(parseSignedRecipe({ ok: true, recipe: { id: 'x' }, sig: 'abc', alg: 'ed25519', keyId: 'dev' })).toEqual({ recipe: { id: 'x' }, sig: 'abc', alg: 'ed25519', keyId: 'dev' });
    expect(() => parseSignedRecipe({ ok: true })).toThrow();
  });

  it("reads each sub-agent's step id from the catalog", () => {
    const c = parseCatalog({ liveEnabled: false, agents: [{ id: 'incorporation', title: 'Incorporation', subAgents: [{ id: 'spice-b', title: 'Incorporation form', form: 'SPICe+ Part B', recipeId: 'spice-b', stepId: 'pre-10' }] }] });
    expect(c.agents[0]!.subAgents[0]).toMatchObject({ id: 'spice-b', recipeId: 'spice-b', stepId: 'pre-10' });
  });

  it('sends a resolver call once with the run id, with no retry', async () => {
    const calls: unknown[] = [];
    const client = new SuiteClient(async (_p, init) => {
      calls.push(init.body);
      return { status: 422, json: { ok: false, error: 'personal_data' } };
    });
    const runId = '12345678-1234-4234-8234-123456789012';
    await expect(client.resolve({ fieldKey: 'company.type', fieldLabel: 'Type', candidates: [{ i: 0, label: 'Type' }] }, { recipeId: 'spice-a', runId })).rejects.toThrow(/personal_data/);
    expect(calls).toEqual([expect.objectContaining({ runId })]);
  });
});

describe('suite client: safeguards', () => {
  it('reads the kill switch, the version floor and the firm contacts from the catalog', () => {
    const c = parseCatalog({ agents: [], extensionDisabled: true, minExtensionVersion: '0.3.0', firmContacts: { emails: ['Desk@Firm.in'], phones: ['+91 98765 01234'] } });
    expect(c).toMatchObject({ extensionDisabled: true, minExtensionVersion: '0.3.0', firmContacts: { emails: ['desk@firm.in'], phones: ['9876501234'] } });
    expect(parseCatalog({ agents: [] })).toMatchObject({ extensionDisabled: false, minExtensionVersion: null });
  });

  it('reads the certifier’s checks off the run, and links "Open in Suite" to that run', () => {
    expect(parseAttestation({ ok: true, run: { id: 'r', attestation: null } })).toEqual({ recorded: false });
    expect(parseAttestation({ ok: true, run: { attestation: { id: 'a1', certifierName: 'CA', createdAt: '2026-11-10T00:00:00Z' } } })).toEqual({
      recorded: true,
      certifierName: 'CA',
      at: '2026-11-10T00:00:00Z',
    });
    expect(SUITE_PATHS.certifierLink('acme', 'r-1')).toBe('/api/assist/step-link/acme?run=r-1');
  });
});
