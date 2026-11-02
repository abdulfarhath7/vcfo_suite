import { describe, expect, it } from 'vitest';
import { readServiceConfig } from '@/lib/dev/env-status';
import { firmIntegrations } from './integrations';

describe('firmIntegrations', () => {
  it('lists the firm-facing services in words and never env names', () => {
    const list = firmIntegrations(readServiceConfig({ RESEND_API_KEY: 'x', S3_BUCKET: 'b' }));
    expect(list.map((i) => i.id)).toEqual(['email', 'outlook', 'whatsapp', 'storage', 'jobs', 'ask']);
    expect(list.find((i) => i.id === 'email')!.status).toBe('Connected');
    expect(list.find((i) => i.id === 'storage')!.status).toBe('Needs set-up');
    expect(list.find((i) => i.id === 'whatsapp')!.status).toBe('Not set up');
    expect(JSON.stringify(list)).not.toContain('RESEND_API_KEY');
  });
});
