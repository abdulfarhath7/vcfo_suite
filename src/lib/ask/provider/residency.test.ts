// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  assertIndiaModelId,
  assertIndiaRegion,
  AskResidencyError,
  INDIA_DEFAULT_MODELS,
  isIndiaModelId,
  parseDataResidency,
  residencyProblems,
} from './residency';

const models = { guard: INDIA_DEFAULT_MODELS.fast, agent: INDIA_DEFAULT_MODELS.smart };
const india = { provider: 'bedrock' as const, dataResidency: 'india' as const, bedrockRegion: 'ap-south-1', models };

describe('the model id guard', () => {
  it.each([
    'global.anthropic.claude-sonnet-5',
    'apac.anthropic.claude-sonnet-5',
    'us.anthropic.claude-sonnet-5',
    'eu.anthropic.claude-sonnet-5',
    'anthropic.claude-sonnet-5',
    'claude-haiku-5-5',
    'in.',
    '',
    ' in.anthropic.claude-sonnet-5',
  ])('refuses %j', (model) => {
    expect(isIndiaModelId(model)).toBe(false);
    expect(() => assertIndiaModelId(model)).toThrow(AskResidencyError);
  });

  it.each(['in.anthropic.claude-sonnet-5', 'in.anthropic.claude-opus-5', 'in.anthropic.claude-haiku-4-5-20251001-v1:0'])('accepts %j', (model) => {
    expect(isIndiaModelId(model)).toBe(true);
    expect(() => assertIndiaModelId(model)).not.toThrow();
  });

  it('ships India defaults', () => {
    expect(isIndiaModelId(INDIA_DEFAULT_MODELS.fast)).toBe(true);
    expect(isIndiaModelId(INDIA_DEFAULT_MODELS.smart)).toBe(true);
  });
});

describe('the region guard', () => {
  it('accepts Mumbai and Hyderabad only', () => {
    expect(() => assertIndiaRegion('ap-south-1')).not.toThrow();
    expect(() => assertIndiaRegion('ap-south-2')).not.toThrow();
    for (const region of ['us-east-1', 'ap-southeast-1', 'eu-west-1', '', null, undefined]) {
      expect(() => assertIndiaRegion(region)).toThrow(AskResidencyError);
    }
  });
});

describe('the residency mode', () => {
  it('defaults to india on Bedrock and to none on the Anthropic API', () => {
    expect(parseDataResidency(undefined, 'bedrock')).toBe('india');
    expect(parseDataResidency('', 'bedrock')).toBe('india');
    expect(parseDataResidency(undefined, 'anthropic')).toBe('none');
  });

  it('fails closed on anything but none', () => {
    expect(parseDataResidency('none', 'bedrock')).toBe('none');
    expect(parseDataResidency('NONE', 'bedrock')).toBe('none');
    expect(parseDataResidency('india', 'anthropic')).toBe('india');
    expect(parseDataResidency('indai', 'bedrock')).toBe('india');
  });
});

describe('the startup check', () => {
  it('passes a correct India configuration', () => {
    expect(residencyProblems(india)).toEqual([]);
  });

  it('names every bad tier and the region', () => {
    const problems = residencyProblems({ ...india, bedrockRegion: 'us-east-1', models: { guard: 'global.anthropic.claude-haiku-4-5', agent: models.agent } });
    expect(problems).toHaveLength(2);
    expect(problems.join(' ')).toMatch(/us-east-1/);
    expect(problems.join(' ')).toMatch(/guard/);
  });

  it('refuses a missing region', () => {
    expect(residencyProblems({ ...india, bedrockRegion: null })[0]).toMatch(/not set/);
  });

  it('refuses the Anthropic API in india mode', () => {
    expect(residencyProblems({ ...india, provider: 'anthropic' })[0]).toMatch(/Anthropic API has no India/);
  });

  it('checks nothing when residency is none', () => {
    expect(residencyProblems({ ...india, dataResidency: 'none', bedrockRegion: null, models: { guard: 'claude-haiku-5-5' } })).toEqual([]);
  });
});
