/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { nocDocType } from './doc-types';
import { todoStates } from './track';
import { DocTrack } from './DocTrack';
import { DocTodo } from './DocTodo';
import { DocPaper } from './DocPaper';
import { SignedCopyView } from './SignedCopyView';
import { DocPreviewCard } from './DocPreviewCard';
import { VersionCompare } from './VersionCompare';
import { ReceiveChecklist } from './ReceiveChecklist';
import { DocFiles } from './DocFiles';
import { EvidenceTable } from './EvidenceTable';
import { AuditLines } from './AuditLines';
import { nocEvidence } from './noc-doc';
import type { DocModel, MergeValue } from './types';

describe('DocTrack', () => {
  it('draws six steps for a foreign parent with who and when on done steps', () => {
    render(
      <DocTrack
        stages={nocDocType('foreign-parent').stages}
        records={{ drafted: { at: '2026-09-26', by: 'SBC' }, released: { at: '2026-09-28', by: 'SBC' } }}
        nowLabel="Waiting on Northwind"
        nowTone="teal"
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(6);
    expect(items[0]).toHaveTextContent('SBC · 26 Sep');
    expect(items[2]).toHaveAttribute('data-state', 'now');
    expect(items[2]).toHaveTextContent('Waiting on Northwind');
    expect(items[5]).toHaveAttribute('data-state', 'next');
  });

  it('draws four steps for an Indian parent', () => {
    render(<DocTrack stages={nocDocType('indian-investing').stages} records={{}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
  });
});

describe('DocTodo', () => {
  it('numbers the lines, fills the now line and shows the one button', () => {
    const items = todoStates(nocDocType('foreign-parent'), { released: { at: '2026-09-28' } });
    render(<DocTodo items={items} action={<button type="button">Download the Word file</button>} />);
    const lines = screen.getAllByRole('listitem');
    expect(lines[0]).toHaveAttribute('aria-current', 'step');
    expect(lines[0]!.className).toContain('bg-brand-soft');
    expect(screen.getByRole('button', { name: 'Download the Word file' })).toBeInTheDocument();
  });
});

const model: DocModel = {
  letterhead: { name: 'Northwind Inc.', address: 'San Francisco' },
  heading: 'CERTIFIED TRUE COPY OF THE BOARD OF NORTHWIND INC.',
  dates: [
    { label: 'Meeting', value: '24 Sep 2026' },
    { label: 'Certified', value: '30 Sep 2026' },
  ],
  sections: [
    { label: 'Decision', paragraphs: ['RESOLVED THAT Northwind Inc. sets up Northwind India.'] },
    { label: 'Certifies', paragraphs: ['Designation: [Designation]'] },
  ],
};
const values: MergeValue[] = [
  { key: 'PARENT_ENTITY_NAME', value: 'Northwind Inc.', source: 'Pre-1 · Parent company name' },
  { key: 'PROPOSED_NAME_1', value: 'Northwind India', source: 'Pre-1 · Proposed name 1' },
  { key: 'SIGNATORY_DESIGNATION', value: '[Designation]', source: 'Pre-1 · Designation', missing: true },
];

describe('DocPaper', () => {
  it('tints filled values, shows the margin labels and the two dated labels', () => {
    const { container } = render(<DocPaper model={model} values={values} />);
    expect(screen.getByText('Decision')).toBeInTheDocument();
    expect(screen.getByText('Meeting · 24 Sep 2026')).toBeInTheDocument();
    expect(screen.getByText('Certified · 30 Sep 2026')).toBeInTheDocument();
    const tinted = container.querySelectorAll('[data-field="PROPOSED_NAME_1"]');
    expect(tinted).toHaveLength(1);
    expect(tinted[0]!.className).toContain('bg-brand-soft');
    expect(container.querySelector('[data-field="SIGNATORY_DESIGNATION"]')!.getAttribute('aria-label')).toBe('Not given yet · Pre-1 · Designation');
    expect(container.querySelector('svg, canvas, img')).toBeNull();
  });

  it('opens the field when the viewer can edit it', () => {
    const onField = vi.fn();
    const { container } = render(<DocPaper model={model} values={values} onField={onField} />);
    fireEvent.click(container.querySelector('[data-field="PROPOSED_NAME_1"]')!);
    expect(onField).toHaveBeenCalledWith(values[1]);
  });

  it('names the field when the viewer cannot edit it', () => {
    const onField = vi.fn();
    const { container } = render(<DocPaper model={model} values={values} onField={onField} canEdit={() => false} />);
    const el = container.querySelector('[data-field="PROPOSED_NAME_1"]')!;
    fireEvent.keyDown(el, { key: 'Enter' });
    expect(onField).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('From Pre-1 · Proposed name 1');
  });
});

describe('SignedCopyView', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the empty state and never a drawn signature', () => {
    const { container } = render(<SignedCopyView file={null} />);
    expect(screen.getByText('No signed copy yet')).toBeInTheDocument();
    expect(container.querySelector('svg, canvas, img, iframe')).toBeNull();
  });

  it('shows the uploaded PDF in a frame from a blob', async () => {
    const createObjectURL = vi.fn(() => 'blob:signed');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Blob(['%PDF-1.4']), { status: 200 }));
    render(<SignedCopyView file={{ name: 'signed.pdf', url: '/api/x/download-signed', uploadedAt: '2026-10-06', uploadedBy: 'Northwind' }} />);
    const frame = await screen.findByTitle('Signed copy · signed.pdf');
    expect(frame.getAttribute('src')).toMatch(/^blob:signed/);
    expect(screen.getByText('Uploaded · Northwind · 6 Oct')).toBeInTheDocument();
  });

  it('offers Open for a file type it cannot show', () => {
    const onOpenFull = vi.fn();
    render(<SignedCopyView file={{ name: 'signed.docx', url: '/x' }} onOpenFull={onOpenFull} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(onOpenFull).toHaveBeenCalled();
  });
});

describe('DocPreviewCard', () => {
  it('switches between the Draft and Signed copy tabs', () => {
    const onTab = vi.fn();
    const { rerender } = render(<DocPreviewCard tab="draft" onTab={onTab} draft={<p>draft body</p>} signed={<p>signed body</p>} meta="Version 2" />);
    expect(screen.getByText('draft body')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Signed copy' }));
    expect(onTab).toHaveBeenCalledWith('signed');
    rerender(<DocPreviewCard tab="signed" onTab={onTab} draft={<p>draft body</p>} signed={<p>signed body</p>} />);
    expect(screen.getByText('draft body').closest('[role="tabpanel"]')).toHaveAttribute('hidden');
  });
});

describe('VersionCompare', () => {
  it('lists the changed values between the last two versions', () => {
    render(
      <VersionCompare
        versions={[
          { id: 'v1', label: 'Version 1', values: { NOMINEE: 'A. Lee', CAP: '10' } },
          { id: 'v2', label: 'Version 2', values: { NOMINEE: 'J. Carter', CAP: '10' } },
        ]}
        labels={{ NOMINEE: 'Nominee' }}
      />,
    );
    const list = screen.getByRole('list', { name: 'Changed values' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(list).toHaveTextContent('Nominee');
    expect(list).toHaveTextContent('A. Lee');
    expect(list).toHaveTextContent('J. Carter');
  });

  it('says when there is one version only', () => {
    render(<VersionCompare versions={[{ id: 'v1', label: 'Version 1', values: {} }]} />);
    expect(screen.getByText('One version only')).toBeInTheDocument();
  });
});

describe('ReceiveChecklist', () => {
  const checks = nocDocType('foreign-parent').checks;

  it('keeps Accept disabled until every check is ticked', () => {
    const onAccept = vi.fn();
    const { rerender } = render(<ReceiveChecklist checks={checks} ticked={checks.slice(0, 5).map((c) => c.key)} onTick={vi.fn()} onAccept={onAccept} onSendBack={vi.fn()} />);
    expect(screen.getByText('5 of 6')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeDisabled();
    rerender(<ReceiveChecklist checks={checks} ticked={checks.map((c) => c.key)} onTick={vi.fn()} onAccept={onAccept} onSendBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));
    expect(onAccept).toHaveBeenCalled();
  });

  it('reports a tick', () => {
    const onTick = vi.fn();
    render(<ReceiveChecklist checks={checks} ticked={[]} onTick={onTick} onAccept={vi.fn()} onSendBack={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Notary stamp' }));
    expect(onTick).toHaveBeenCalledWith('notary', true);
  });

  it('needs a reason to send back', () => {
    const onSendBack = vi.fn();
    render(<ReceiveChecklist checks={checks} ticked={[]} onTick={vi.fn()} onAccept={vi.fn()} onSendBack={onSendBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Send back' }));
    const send = screen.getByRole('button', { name: 'Send back' });
    expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'The apostille is missing' } });
    act(() => send.click());
    expect(onSendBack).toHaveBeenCalledWith('The apostille is missing');
  });

  it('locks the list after Accept', () => {
    render(<ReceiveChecklist checks={checks} ticked={[]} done onTick={vi.fn()} onAccept={vi.fn()} onSendBack={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Accept' })).toBeNull();
    expect(screen.getAllByRole('checkbox').every((c) => c.hasAttribute('disabled'))).toBe(true);
  });
});

describe('DocFiles', () => {
  const files = [{ id: 'd', title: 'Draft · Word', name: 'noc-foreign-parent.docx', status: 'Released', by: 'SBC', at: '2026-09-28' }];

  it('hides the internal file name from the client', () => {
    render(<DocFiles files={files} />);
    expect(screen.getByText('Draft · Word')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('noc-foreign-parent.docx');
  });

  it('shows it to staff', () => {
    render(<DocFiles files={files} showInternalName onDownload={vi.fn()} />);
    expect(document.body).toHaveTextContent('noc-foreign-parent.docx · SBC · 28 Sep');
  });
});

describe('EvidenceTable and AuditLines', () => {
  it('shows each answer with the Project setup label', () => {
    render(<EvidenceTable rows={nocEvidence({ ownershipType: 'subsidiary', companyType: 'domestic' }).rows} result="This choice adds 0 steps" />);
    expect(screen.getByText('Project setup · Parent’s role')).toBeInTheDocument();
    expect(screen.getByText('Not chosen yet').className).toContain('text-ink-faint');
    expect(screen.getByText('This choice adds 0 steps')).toBeInTheDocument();
  });

  it('lists audit lines newest first', () => {
    render(
      <AuditLines
        lines={[
          { id: '1', at: '2026-09-28T05:00:00Z', who: 'SBC', text: 'Released' },
          { id: '2', at: '2026-10-08T05:00:00Z', who: 'Bharath', text: 'Accepted' },
        ]}
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('8 Oct');
    expect(items[0]).toHaveTextContent('Accepted');
  });
});

