import { describe, expect, it } from 'vitest';
import { requiredFieldErrors, runStepValidation, validateStepAgainstState } from '@/lib/checklist-step-validation';
import { validatePre13Responses } from '@/lib/checklist-part-b-validation';
import { validatePre1Responses } from '@/lib/checklist-pre1-validation';

describe('runStepValidation', () => {
  it('uses the bespoke validator unchanged', () => {
    const responses = { equityShares: 'yes' };
    expect(runStepValidation({ itemId: 'pre-13', responses })).toEqual(validatePre13Responses(responses));
  });

  it('runs Part A against the company type sections', () => {
    const independent = runStepValidation({ itemId: 'pre-1', responses: {}, ownershipType: 'independent' });
    const subsidiary = runStepValidation({ itemId: 'pre-1', responses: {}, ownershipType: 'subsidiary' });
    expect(independent.errors.parentEntityName).toBeUndefined();
    expect(subsidiary.errors.parentEntityName).toBe('This field is required.');
    expect(Object.keys(subsidiary.errors).length).toBeGreaterThan(Object.keys(independent.errors).length);
    expect(validatePre1Responses({}).errors.nicCode).toBe(subsidiary.errors.nicCode);
  });

  it('adds the delivery uploads on pre-4 and pre-5', () => {
    const pre4 = runStepValidation({ itemId: 'pre-4', responses: {} });
    expect(pre4.ok).toBe(false);
    expect(pre4.errors.nameApplicationAcknowledgementUrl).toBe('Upload the ROC filing acknowledgement.');
    const pre5 = runStepValidation({ itemId: 'pre-5', responses: {} });
    expect(pre5.errors.approvedCompanyName).toBe('Enter the approved company name.');
  });

  it('keeps steps outside the direct flow passing', () => {
    expect(runStepValidation({ itemId: 'post-1', responses: {} }).ok).toBe(true);
    expect(runStepValidation({ itemId: 'reg-1', responses: {} }).ok).toBe(true);
  });

  it('gates legacy pre-6 on Part A', () => {
    const result = runStepValidation({ itemId: 'pre-6', responses: {}, pre1Submitted: false });
    expect(result.errors._pre1Gate).toBeTruthy();
  });
});

describe('requiredFieldErrors', () => {
  it('flags empty required fields and passes filled ones', () => {
    const errors = requiredFieldErrors('pre-3', {});
    const ids = Object.keys(errors);
    const filled = Object.fromEntries(ids.map((id) => [id, 'value']));
    expect(Object.keys(requiredFieldErrors('pre-3', filled))).toEqual([]);
  });
});

describe('validateStepAgainstState', () => {
  it('applies the Part A engagement defaults before checking', () => {
    const result = validateStepAgainstState({
      itemId: 'pre-1',
      responses: {},
      state: {},
      engagement: { ownershipType: 'subsidiary', parentEntityName: 'Parent Co' },
    });
    expect(result.errors.parentEntityName).toBeUndefined();
    expect(result.errors.authorisedShareCapital).toBeUndefined();
    expect(result.errors.nicCode).toBe('This field is required.');
  });
});
