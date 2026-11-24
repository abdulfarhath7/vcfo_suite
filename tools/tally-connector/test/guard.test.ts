import { describe, expect, it } from 'vitest';
import { assertReadOnlyRequest, WriteGuardError } from '../src/guard';
import { postToTally } from '../src/tally';

const exportReq = '<ENVELOPE><HEADER><TALLYREQUEST>Export</TALLYREQUEST></HEADER><BODY/></ENVELOPE>';

describe('write guard', () => {
  it('allows a plain export request', () => {
    expect(() => assertReadOnlyRequest(exportReq)).not.toThrow();
  });

  it('refuses Import requests', () => {
    const xml = `<ENVELOPE><HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
      <BODY><IMPORTDATA><REQUESTDATA><TALLYMESSAGE><VOUCHER/></TALLYMESSAGE></REQUESTDATA></IMPORTDATA></BODY></ENVELOPE>`;
    expect(() => assertReadOnlyRequest(xml)).toThrow(WriteGuardError);
    expect(() => assertReadOnlyRequest(exportReq.replace('Export', ' import '))).toThrow(WriteGuardError);
  });

  it('refuses create, alter and delete actions even inside an export', () => {
    for (const action of ['Create', 'Alter', 'Delete', 'alter']) {
      const xml = exportReq.replace('<BODY/>', `<BODY><VOUCHER ACTION="${action}"/></BODY>`);
      expect(() => assertReadOnlyRequest(xml)).toThrow(WriteGuardError);
    }
  });

  it('refuses import data smuggled into an export and requests with no or two TALLYREQUESTs', () => {
    expect(() => assertReadOnlyRequest(exportReq.replace('<BODY/>', '<BODY><IMPORTDATA/></BODY>'))).toThrow();
    expect(() => assertReadOnlyRequest('<ENVELOPE/>')).toThrow();
    expect(() => assertReadOnlyRequest(exportReq + exportReq.replace('Export', 'Import'))).toThrow();
  });

  it('is enforced by postToTally before any network call', async () => {
    await expect(postToTally(1, exportReq.replace('Export', 'Import'))).rejects.toThrow(WriteGuardError);
  });
});
