import { describe, expect, it } from 'vitest';
import { aiNoticeText, isAiAnswer, REVIEW_STATE_LABEL, reviewRequestBody, reviewStateFromTaskStatus } from './ai-review';

describe('AI notice and review', () => {
  it('uses the agreed sentence', () => {
    expect(aiNoticeText()).toBe('Prepared by AI. Your SBC team reviews advice about your own tax or legal position before you act on it.');
  });

  it('marks only model-written answers as AI', () => {
    expect(isAiAnswer({ origin: 'generated' })).toBe(true);
    for (const origin of ['reviewed', 'deterministic', 'refusal', 'work']) expect(isAiAnswer({ origin })).toBe(false);
  });

  it('builds the review request from the question and the answer shown', () => {
    const body = reviewRequestBody('Do we need GST?', 'GST depends on turnover.');
    expect(body.question).toMatch(/^Please confirm this Ask VCFO answer/);
    expect(body.question).toContain('Do we need GST?');
    expect(body.context).toBe('Ask VCFO (AI) answered: GST depends on turnover.');
    expect(reviewRequestBody(undefined, 'x'.repeat(5000)).context.length).toBe(4000);
  });

  it('maps task statuses to what the client sees', () => {
    expect(reviewStateFromTaskStatus('not-started')).toBe('sent');
    expect(reviewStateFromTaskStatus('in-progress')).toBe('in_review');
    expect(reviewStateFromTaskStatus('completed')).toBe('reviewed');
    expect(REVIEW_STATE_LABEL.reviewed).toMatch(/Reviewed by your CA/);
  });
});
