/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest';
import type { BoardResolutionMergeFields } from '@/lib/board-resolution';
import {
  applyMergeFieldHighlights,
  BR_MERGE_FIELD_HIGHLIGHT_CLASS,
  extractPreviewDocumentContent,
  extractPreviewDocumentText,
  getPreviewFormatState,
  setActiveMergeFieldHighlight,
  setPreviewAlignment,
  togglePreviewBold,
  unwrapMergeFieldHighlights,
} from '@/lib/board-resolution-preview-editable';

const sampleFields: BoardResolutionMergeFields = {
  PARENT_ENTITY_NAME: 'ABC Holdings LLC',
  PARENT_ENTITY_ADDRESS: '100 Market Street, Salt Lake City, Utah, USA',
  RESOLUTION_EFFECTIVE_DATE: 'MAY 25, 2026',
  PARENT_JURISDICTION: 'the United States of America',
  PARENT_STATE: 'Utah',
  PROPOSED_NAME_1: 'ABC India Private Limited',
  NIC_CODES: '62099- sample NIC',
  AUTHORISED_CAPITAL: '10,00,000 (Indian Rupees Ten Lakh Only)',
  PAID_UP_CAPITAL: '1,00,000 (Indian Rupees One Lakh Only)',
  INDIAN_DIRECTOR_LINE: 'Jane Doe',
  SECOND_DIRECTOR_LINE: 'John Smith',
  SIGNATORY_NAME: 'Alex Authorised',
  SIGNATORY_DESIGNATION: 'Director',
  CERTIFICATION_DATE: '25th May, 2026',
  CERTIFICATION_PLACE: 'USA',
};

function renderPreviewHtml(text: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `<div class="docx-wrapper"><p>${text}</p></div>`;
  return root;
}

describe('applyMergeFieldHighlights', () => {
  afterEach(() => {
    document.getSelection()?.removeAllRanges();
    document.body.innerHTML = '';
  });

  it('wraps merge field values in preview-only spans', () => {
    const root = renderPreviewHtml(
      'Board of DIRECTORS OF ABC Holdings LLC ("THE COMPANY"), incorporated as ABC India Private Limited.',
    );

    applyMergeFieldHighlights(root, sampleFields);

    const highlights = root.querySelectorAll(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`);
    expect(highlights.length).toBeGreaterThanOrEqual(2);
    expect(
      Array.from(highlights).some((el) => el.textContent === 'ABC Holdings LLC'),
    ).toBe(true);
    expect(
      Array.from(highlights).some((el) => el.textContent === 'ABC India Private Limited'),
    ).toBe(true);
  });

  it('does not nest highlights on re-apply', () => {
    const root = renderPreviewHtml('ABC Holdings LLC and ABC Holdings LLC again.');
    applyMergeFieldHighlights(root, sampleFields);
    applyMergeFieldHighlights(root, sampleFields);

    expect(root.querySelectorAll(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`).length).toBe(2);
  });

  it('extractPreviewDocumentText ignores highlight markup', () => {
    const root = renderPreviewHtml('ABC Holdings LLC');
    applyMergeFieldHighlights(root, sampleFields);

    expect(extractPreviewDocumentText(root)).toBe('ABC Holdings LLC');
  });

  it('extractPreviewDocumentContent preserves inline bold as strong tags', () => {
    const root = document.createElement('div');
    root.innerHTML =
      '<div class="docx-wrapper"><p>Hello <strong>world</strong></p></div>';

    expect(extractPreviewDocumentContent(root)).toBe('Hello <strong>world</strong>');
    expect(extractPreviewDocumentText(root)).toBe('Hello world');
  });

  it('extractPreviewDocumentContent serializes explicit alignment', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="docx-wrapper"><p style="text-align: center">Title</p></div>';

    const content = extractPreviewDocumentContent(root);
    expect(content.startsWith('{"br":')).toBe(true);
  });

  it('togglePreviewBold and getPreviewFormatState work on editable preview', () => {
    // jsdom lacks execCommand/queryCommandState; shim a minimal real 'bold'
    // that wraps the current selection in <strong>, matching browser behavior.
    const editableDoc = document as unknown as {
      execCommand?: (command: string) => boolean;
      queryCommandState?: (command: string) => boolean;
    };
    editableDoc.execCommand = (command: string) => {
      if (command !== 'bold') return false;
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) return false;
      const activeRange = selection.getRangeAt(0);
      const strong = document.createElement('strong');
      strong.appendChild(activeRange.extractContents());
      activeRange.insertNode(strong);
      return true;
    };
    editableDoc.queryCommandState = () => true;

    const root = document.createElement('div');
    root.innerHTML = '<div class="docx-wrapper br-editable-document"><p>Hello world</p></div>';
    document.body.appendChild(root);

    document.getSelection()?.removeAllRanges();
    const paragraph = root.querySelector('p');
    if (!paragraph?.firstChild) throw new Error('missing paragraph');

    const range = document.createRange();
    range.selectNodeContents(paragraph.firstChild);
    document.getSelection()?.addRange(range);

    expect(togglePreviewBold(root)).toBe(true);
    expect(extractPreviewDocumentContent(root)).toContain('<strong>');
    expect(getPreviewFormatState(root).bold).toBe(true);
  });

  it('setPreviewAlignment records explicit paragraph alignment', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="docx-wrapper br-editable-document"><p>Title</p></div>';
    document.body.appendChild(root);

    document.getSelection()?.removeAllRanges();
    const paragraph = root.querySelector('p');
    if (!paragraph?.firstChild) throw new Error('missing paragraph');

    const range = document.createRange();
    range.selectNodeContents(paragraph.firstChild);
    document.getSelection()?.addRange(range);

    expect(setPreviewAlignment(root, 'center')).toBe(true);
    expect(paragraph.style.textAlign).toBe('center');
    expect(getPreviewFormatState(root).alignment).toBe('center');
  });

  it('setActiveMergeFieldHighlight toggles active class', () => {
    const root = renderPreviewHtml('ABC Holdings LLC');
    applyMergeFieldHighlights(root, sampleFields);

    setActiveMergeFieldHighlight(root, 'PARENT_ENTITY_NAME');
    const span = root.querySelector<HTMLElement>(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`);
    expect(span?.classList.contains('br-merge-field-highlight-active')).toBe(true);

    setActiveMergeFieldHighlight(root, null);
    expect(span?.classList.contains('br-merge-field-highlight-active')).toBe(false);
  });

  it('unwrapMergeFieldHighlights restores plain text nodes', () => {
    const root = renderPreviewHtml('ABC Holdings LLC');
    applyMergeFieldHighlights(root, sampleFields);
    unwrapMergeFieldHighlights(root);

    expect(root.querySelector(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`)).toBeNull();
    expect(root.textContent).toContain('ABC Holdings LLC');
  });
});
