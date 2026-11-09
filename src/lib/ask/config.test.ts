import { afterEach, describe, expect, it } from 'vitest';
import { askBudgets, askConfig } from './config';

const NAMES = ['ASK_DAILY_TOKEN_BUDGET', 'ASK_RUN_MAX_TURNS', 'ASK_RUN_MAX_TOKENS', 'ASK_ANSWER_MAX_TOKENS', 'ASK_AGENT_RUNS_PER_HOUR', 'ASK_VCFO_RATE_LIMIT_HOUR', 'ASK_VCFO_RATE_LIMIT_DAY', 'ASK_VCFO_RETRIEVAL_TOP_K'];

afterEach(() => {
  for (const name of NAMES) delete process.env[name];
});

describe('spending limits', () => {
  it('takes an explicit 0 as a limit of nothing', () => {
    for (const name of NAMES) process.env[name] = '0';
    expect(askBudgets()).toEqual({ runMaxTurns: 0, runMaxTokens: 0, answerMaxTokens: 0, dailyTokens: 0, agentRunsPerHour: 0 });
    expect(askConfig().rateLimit).toEqual({ hour: 0, day: 0 });
  });

  it('keeps the defaults for an empty or unusable value', () => {
    process.env.ASK_DAILY_TOKEN_BUDGET = '';
    process.env.ASK_RUN_MAX_TURNS = 'many';
    process.env.ASK_RUN_MAX_TOKENS = '-5';
    expect(askBudgets()).toMatchObject({ dailyTokens: 2_000_000, runMaxTurns: 12, runMaxTokens: 200_000 });
  });

  it('does not let 0 empty the retrieval count, which is no spending limit', () => {
    process.env.ASK_VCFO_RETRIEVAL_TOP_K = '0';
    expect(askConfig().retrievalTopK).toBe(4);
  });
});
