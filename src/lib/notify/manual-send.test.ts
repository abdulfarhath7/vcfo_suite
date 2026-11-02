import { describe, expect, it } from 'vitest';
import { ALL_EVENTS_COVERED, checkManualSend, manualTemplate, maskLast4, renderTemplateBody, whatsappStateOf } from './manual-send';
import { isValidE164 } from './phone';

describe('manual WhatsApp send helpers', () => {
  it('has a template for every notify event', () => {
    expect(ALL_EVENTS_COVERED).toBe(true);
  });
  it('renders the approved body with the fields in variable order, brackets for empty ones', () => {
    const t = manualTemplate('client_action_needed')!;
    expect(renderTemplateBody(t, { firstName: 'Mei', companyName: 'Tidewater', stepTitle: 'Registered Office' })).toBe(
      'Hello Mei, we need some details from you for "Registered Office" (Tidewater). Please sign in to VCFO Suite to fill them in.',
    );
    expect(renderTemplateBody(t, { firstName: 'Mei' })).toContain('[Step]');
  });
  it('checks the event and every field, and drops extra keys', () => {
    expect(checkManualSend('nope', {})).toEqual({ ok: false, error: 'unknown_template' });
    expect(checkManualSend('coi_issued', { companyName: '  ' })).toEqual({ ok: false, error: 'missing_field', field: 'companyName' });
    expect(checkManualSend('coi_issued', { companyName: ' Acme \n Ltd ', password: 'x' })).toEqual({ ok: true, event: 'coi_issued', variables: { companyName: 'Acme Ltd' } });
  });
  it('masks to the last four digits', () => {
    expect(maskLast4('+919876543210')).toBe('•••• 3210');
    expect(maskLast4(null)).toBe('');
  });
  it('reads WhatsApp state in the dispatcher guard order', () => {
    const on = new Date();
    expect(whatsappStateOf({ phoneE164: null, whatsappOptInAt: on, whatsappOptOutAt: null }, isValidE164)).toBe('no_phone');
    expect(whatsappStateOf({ phoneE164: '+919876543210', whatsappOptInAt: null, whatsappOptOutAt: null }, isValidE164)).toBe('no_consent');
    expect(whatsappStateOf({ phoneE164: '+919876543210', whatsappOptInAt: on, whatsappOptOutAt: on }, isValidE164)).toBe('opted_out');
    expect(whatsappStateOf({ phoneE164: '+919876543210', whatsappOptInAt: on, whatsappOptOutAt: null }, isValidE164)).toBe('ready');
  });
});
