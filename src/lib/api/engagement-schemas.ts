import { z } from 'zod';

export const engagementStageSchema = z.enum([
  'Pre-Incorporation',
  'Post-Incorporation',
  'Operational Readiness',
]);

export const engagementHealthSchema = z.enum(['on-track', 'at-risk', 'overdue']);

export const internIdSchema = z.string().trim().min(1).max(64);
