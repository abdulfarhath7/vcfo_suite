import { describe, expect, it } from 'vitest';
import { ROTATION_SECRETS, addCadence, dailyCronIst, dueStatus, isAccessDenied, rdsInstanceId, rotationRow, secretIdFor } from './rotation';

const def = (key: string) => ROTATION_SECRETS.find((d) => d.key === key)!;
const NOW = new Date('2026-10-30T12:00:00Z');

describe('the tracked secrets', () => {
  it('holds the three accepted exceptions with their cadence and review date', () => {
    expect(def('auth')).toMatchObject({ finding: '371', everyDays: 90, reviewAt: '2027-01-31', defaultId: 'vcfo-suite/AUTH_SECRET' });
    expect(def('azure')).toMatchObject({ finding: '372', everyMonths: 6, reviewAt: '2027-04-30' });
    expect(def('anthropic')).toMatchObject({ finding: '376', everyDays: 90, reviewAt: '2027-01-31', defaultId: '/vcfo/ask-vcfo/anthropic-api-key' });
    expect(def('db')).toMatchObject({ mode: 'auto', everyDays: 7, idEnv: 'DB_SECRET_ARN' });
  });

  it('takes the secret id from its env var, else the default name', () => {
    expect(secretIdFor(def('anthropic'), { ANTHROPIC_API_KEY_SECRET_ID: 'arn:x' })).toBe('arn:x');
    expect(secretIdFor(def('auth'), {})).toBe('vcfo-suite/AUTH_SECRET');
    expect(secretIdFor(def('db'), {})).toBeNull();
  });
});

describe('due dates', () => {
  it('adds days or calendar months', () => {
    expect(addCadence(def('auth'), new Date('2026-11-02T00:00:00Z')).toISOString()).toBe('2027-01-31T00:00:00.000Z');
    expect(addCadence(def('azure'), new Date('2026-10-30T00:00:00Z')).toISOString()).toBe('2027-04-30T00:00:00.000Z');
    expect(addCadence(def('azure'), new Date('2026-08-31T00:00:00Z')).toISOString()).toBe('2027-02-28T00:00:00.000Z');
  });

  it('is red only when past due', () => {
    expect(dueStatus(new Date('2026-10-29T00:00:00Z'), NOW)).toBe('past_due');
    expect(dueStatus(new Date('2026-11-05T00:00:00Z'), NOW)).toBe('due_soon');
    expect(dueStatus(new Date('2027-01-31T00:00:00Z'), NOW)).toBe('ok');
    expect(dueStatus(null, NOW)).toBe('ok');
  });
});

describe('rotationRow', () => {
  it('uses the last change for a manual secret and adds the cadence', () => {
    const row = rotationRow(def('auth'), { name: 'vcfo-suite/AUTH_SECRET', lastChangedDate: new Date('2026-11-02T00:00:00Z'), createdDate: new Date('2026-01-01T00:00:00Z') }, NOW);
    expect(row).toMatchObject({ name: 'vcfo-suite/AUTH_SECRET', lastFrom: 'changed', dueAt: '2027-01-31T00:00:00.000Z', status: 'ok', finding: '371' });
  });

  it('marks a manual secret past due after its cadence', () => {
    const row = rotationRow(def('anthropic'), { lastChangedDate: new Date('2026-07-01T00:00:00Z') }, NOW);
    expect(row.status).toBe('past_due');
  });

  it('shows RDS auto-rotation from the next rotation date', () => {
    const on = rotationRow(def('db'), { name: 'rds!db-1', lastRotatedDate: new Date('2026-10-28T00:00:00Z'), nextRotationDate: new Date('2026-11-04T00:00:00Z'), rotationEnabled: true }, NOW);
    expect(on).toMatchObject({ status: 'auto', lastFrom: 'rotated', dueAt: '2026-11-04T00:00:00.000Z', mode: 'auto' });
    const off = rotationRow(def('db'), { lastRotatedDate: new Date('2026-10-28T00:00:00Z'), rotationEnabled: false }, NOW);
    expect(off.status).toBe('auto_off');
    const late = rotationRow(def('db'), { nextRotationDate: new Date('2026-10-20T00:00:00Z'), rotationEnabled: true }, NOW);
    expect(late.status).toBe('past_due');
  });
});

describe('helpers', () => {
  it('reads an IAM refusal or missing credentials as not connected', () => {
    expect(isAccessDenied('AccessDeniedException: User is not authorized to perform: backup:GetBackupPlan')).toBe(true);
    expect(isAccessDenied('UnauthorizedOperation: You are not authorized')).toBe(true);
    expect(isAccessDenied('CredentialsProviderError: Could not load credentials from any providers')).toBe(true);
    expect(isAccessDenied('No answer in 5 s')).toBe(false);
  });

  it('turns the 02:00 IST backup cron into words', () => {
    expect(dailyCronIst('cron(30 20 * * ? *)')).toBe('02:00 IST');
    expect(dailyCronIst('rate(1 day)')).toBeNull();
  });

  it('finds the RDS instance id from RDS_INSTANCE_ID or the DB_HOST endpoint', () => {
    expect(rdsInstanceId({ RDS_INSTANCE_ID: 'vcfo-suite-db' })).toBe('vcfo-suite-db');
    expect(rdsInstanceId({ DB_HOST: 'vcfo-suite-db.abc123.ap-south-1.rds.amazonaws.com' })).toBe('vcfo-suite-db');
    expect(rdsInstanceId({ DB_HOST: 'localhost' })).toBeNull();
  });
});
