import type { CardAgentLevel } from '@/lib/card-agents/card-agents';

/** One plain sentence on what each level means, for the panel. */
export const LEVEL_LINE: Record<CardAgentLevel, string> = {
  ready: 'I fill the live portal from Suite. You log in, type the captcha and OTP, sign and submit.',
  practice: 'I fill the practice (mock) portal only. The live portal waits for the legal clearance.',
  prepare: 'I check and gather the data in Suite. You type it on the portal for now.',
  coming: 'Not built yet.',
};
