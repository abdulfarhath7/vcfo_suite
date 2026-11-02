import { describe, expect, it } from 'vitest';
import { draftOf, emailChanging, isDirty, passwordProblem, profileBody, profileErrorText, profileFromApi, readOutlookReturn, roleLabelOf, savedProfile, whatsappTestText } from './settings-model';

const p = profileFromApi({ name: 'Anita Rao', email: 'anita@demo.local', phone: null, phoneE164: '+919876543210', whatsappOptIn: true, role: 'manager', avatarUrl: null });

describe('profile save — the live PATCH body', () => {
  it('sends trimmed fields, E.164 and consent only with a number', () => {
    const d = { ...draftOf(p), name: ' Anita R ', phone: ' ', whatsapp: '98765 43211' };
    expect(isDirty(p, d)).toBe(true);
    expect(profileBody(p, d)).toEqual({ name: 'Anita R', phone: null, phoneE164: '+919876543211', whatsappOptIn: true, email: 'anita@demo.local' });
    expect(profileBody(p, { ...d, whatsapp: '' })).toMatchObject({ phoneE164: null, whatsappOptIn: false });
  });
  it('asks for the current password only when the email changes', () => {
    const d = { ...draftOf(p), email: 'Anita@Demo.local' };
    expect(emailChanging(p, d)).toBe(false);
    const d2 = { ...draftOf(p), email: 'new@demo.local', password: 'pw' };
    expect(profileBody(p, d2)).toMatchObject({ email: 'new@demo.local', currentPassword: 'pw' });
  });
  it('keeps what the live view keeps after saving', () => {
    const d = { ...draftOf(p), whatsapp: '+91 98765 43210', optIn: false };
    expect(savedProfile(p, d, { name: 'Anita', email: 'anita@demo.local', phone: null })).toMatchObject({ phoneE164: '+919876543210', whatsappOptIn: false, phone: '', role: 'manager' });
    expect(isDirty(p, draftOf(p))).toBe(false);
  });
});

describe('the live messages', () => {
  it('maps errors and password checks word for word', () => {
    expect(profileErrorText('invalid_credentials')).toBe('Current password is incorrect.');
    expect(profileErrorText('email_already_registered')).toBe('That email is already in use.');
    expect(profileErrorText('other')).toBeNull();
    expect(passwordProblem('short', 'short')).toEqual({ title: 'Password too short', desc: 'Use at least 8 characters.' });
    expect(passwordProblem('longenough', 'different')?.title).toBe("Passwords don't match");
    expect(passwordProblem('longenough', 'longenough')).toBeNull();
    expect(whatsappTestText({ reason: 'too_soon' })).toBe('A test was just sent. Wait 30 seconds before sending another.');
    expect(whatsappTestText({ error: 'boom' })).toBe('boom');
    expect(whatsappTestText({})).toBe('The message could not be sent.');
    expect(roleLabelOf('manager')).toBe('Project manager');
  });
  it('reads the Outlook callback and strips it from the address', () => {
    expect(readOutlookReturn('?outlook=connected&section=outlook')).toEqual({ result: 'connected', reason: '', rest: 'section=outlook' });
    expect(readOutlookReturn('?outlook=error&reason=invalid_state')).toMatchObject({ result: 'error', reason: 'invalid_state', rest: '' });
    expect(readOutlookReturn('').result).toBeNull();
  });
});
