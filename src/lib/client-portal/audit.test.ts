import { describe, expect, it } from 'vitest';
import { auditCategoryOf, istParts } from './audit';

describe('auditCategoryOf', () => {
  it('puts uploads, requests, shared drafts and the board resolution under Documents', () => {
    for (const a of [
      'client.need_uploaded',
      'client.need_upload_undone',
      'board_resolution.finalize',
      'incorporation_docs.share',
      'incorporation_docs.share_all',
      'doc_pack.download_zip',
      'document_request.create',
      'document_request.sent_back',
    ]) {
      expect(auditCategoryOf(a), a).toBe('Documents');
    }
  });

  it('keeps timeline changes and change requests with the milestones, not Team', () => {
    expect(auditCategoryOf('client.timeline_change_request')).toBe('Milestones');
    expect(auditCategoryOf('client.timeline_change_approved')).toBe('Milestones');
    expect(auditCategoryOf('client.change_request')).toBe('Milestones');
    expect(auditCategoryOf('checklist.accept')).toBe('Milestones');
    expect(auditCategoryOf('engagement.checklist.submit')).toBe('Milestones');
  });

  it('files invites, substitutions and the primary-contact change under Team', () => {
    expect(auditCategoryOf('client.invite')).toBe('Team');
    expect(auditCategoryOf('client.substitute')).toBe('Team');
    expect(auditCategoryOf('client.ask_handoff')).toBe('Team');
    expect(auditCategoryOf('project.client_changed')).toBe('Team');
  });

  it('files emails and credential access separately', () => {
    expect(auditCategoryOf('welcome_email.sent')).toBe('Email');
    expect(auditCategoryOf('email_templates.fire')).toBe('Email');
    expect(auditCategoryOf('credentials.reveal')).toBe('Credentials');
  });
});

describe('istParts', () => {
  it('reads an instant as an IST day and time', () => {
    expect(istParts(new Date('2026-10-27T20:00:00Z'))).toEqual({ day: '2026-10-28', time: '01:30' });
  });
});
