import type { AnswerEnvelope } from '@/data/ask/schema';

export const BRIEF_DISCLAIMER = 'Informational only. Your firm confirms decisions for your company.';

export interface BriefItem {
  title: string;
  answer: AnswerEnvelope;
}
