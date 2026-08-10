import {
  BOARD_RESOLUTION_MERGE_FIELD_KEYS,
  type BoardResolutionMergeFields,
} from '@/lib/board-resolution';
import type {
  BoardResolutionParagraphAlignment,
  BoardResolutionParagraphPatch,
} from '@/lib/board-resolution-docx-body';
import { serializeBoardResolutionPatchContent } from '@/lib/board-resolution-docx-body';

/** Preview-only class — never written to stored .docx. */
export const BR_MERGE_FIELD_HIGHLIGHT_CLASS = 'br-merge-field-highlight';

const BR_MERGE_FIELD_HIGHLIGHT_ACTIVE_CLASS = 'br-merge-field-highlight-active';

const MIN_HIGHLIGHT_VALUE_LENGTH = 2;

function previewWrapper(root: HTMLElement): HTMLElement {
  return root.querySelector<HTMLElement>('.docx-wrapper') ?? root;
}

function isInsideHighlight(node: Node): boolean {
  return Boolean(
    node.parentElement?.closest(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`),
  );
}

function collectHighlightableTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (isInsideHighlight(node)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent ?? '';
      if (!text.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function wrapMatchesInTextNode(textNode: Text, value: string, fieldKey: string): void {
  const text = textNode.textContent ?? '';
  if (!text.includes(value)) return;

  const parent = textNode.parentNode;
  if (!parent) return;

  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let index = 0;

  while ((index = text.indexOf(value, lastIndex)) !== -1) {
    if (index > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
    }

    const span = document.createElement('span');
    span.className = BR_MERGE_FIELD_HIGHLIGHT_CLASS;
    span.dataset.brMergeField = fieldKey;
    span.textContent = value;
    fragment.appendChild(span);

    lastIndex = index + value.length;
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  parent.replaceChild(fragment, textNode);
}

function entriesByValueLength(fields: BoardResolutionMergeFields): Array<{
  key: (typeof BOARD_RESOLUTION_MERGE_FIELD_KEYS)[number];
  value: string;
}> {
  return BOARD_RESOLUTION_MERGE_FIELD_KEYS.reduce<
    Array<{ key: (typeof BOARD_RESOLUTION_MERGE_FIELD_KEYS)[number]; value: string }>
  >((acc, key) => {
    const value = fields[key].trim();
    if (value.length >= MIN_HIGHLIGHT_VALUE_LENGTH) {
      acc.push({ key, value });
    }
    return acc;
  }, []).sort((a, b) => b.value.length - a.value.length);
}

/** Remove preview-only highlight wrappers so re-apply starts from plain rendered text. */
export function unwrapMergeFieldHighlights(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`).forEach((el) => {
    const parent = el.parentNode;
    if (!parent) return;
    while (el.firstChild) {
      parent.insertBefore(el.firstChild, el);
    }
    parent.removeChild(el);
  });
}

/** Wrap known merge-field values in preview-only highlight spans. */
export function applyMergeFieldHighlights(
  root: HTMLElement,
  fields: BoardResolutionMergeFields,
): void {
  unwrapMergeFieldHighlights(root);

  const container = previewWrapper(root);
  const entries = entriesByValueLength(fields);
  if (entries.length === 0) return;

  for (const { key, value } of entries) {
    const textNodes = collectHighlightableTextNodes(container);
    for (const textNode of textNodes) {
      wrapMatchesInTextNode(textNode, value, key);
    }
  }
}

export function setActiveMergeFieldHighlight(
  root: HTMLElement,
  activeFieldKey: keyof BoardResolutionMergeFields | null | undefined,
): void {
  root.querySelectorAll<HTMLElement>(`.${BR_MERGE_FIELD_HIGHLIGHT_CLASS}`).forEach((el) => {
    const isActive = Boolean(activeFieldKey && el.dataset.brMergeField === activeFieldKey);
    el.classList.toggle(BR_MERGE_FIELD_HIGHLIGHT_ACTIVE_CLASS, isActive);
  });
}

export function scrollPreviewToMergeField(
  root: HTMLElement,
  fieldKey: keyof BoardResolutionMergeFields,
): boolean {
  const target = root.querySelector<HTMLElement>(`[data-br-merge-field="${fieldKey}"]`);
  if (!target) return false;
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return true;
}

type FormattedTextPart = { text: string; bold: boolean };

function isBoldElement(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === 'strong' || tag === 'b') return true;

  const inlineWeight = (el as HTMLElement).style?.fontWeight;
  if (inlineWeight === 'bold' || inlineWeight === '700' || Number.parseInt(inlineWeight, 10) >= 600) {
    return true;
  }

  if (typeof window !== 'undefined' && el instanceof HTMLElement) {
    const computed = window.getComputedStyle(el).fontWeight;
    if (computed === 'bold' || computed === '700' || Number.parseInt(computed, 10) >= 600) {
      return true;
    }
  }

  return false;
}

function collectFormattedParts(node: Node, parts: FormattedTextPart[], bold = false): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
    if (text) parts.push({ text, bold });
    return;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as Element;
  if (el.classList.contains(BR_MERGE_FIELD_HIGHLIGHT_CLASS)) {
    for (const child of el.childNodes) collectFormattedParts(child, parts, bold);
    return;
  }

  const childBold = bold || isBoldElement(el);
  for (const child of el.childNodes) collectFormattedParts(child, parts, childBold);
}

function serializeFormattedParts(parts: FormattedTextPart[]): string {
  const merged: FormattedTextPart[] = [];

  for (const part of parts) {
    const previous = merged[merged.length - 1];
    if (previous && previous.bold === part.bold) {
      previous.text += part.text;
    } else {
      merged.push({ ...part });
    }
  }

  return merged
    .map((part) => (part.bold ? `<strong>${part.text}</strong>` : part.text))
    .join('');
}

function extractFormattedTextFromElement(el: Element): string {
  const parts: FormattedTextPart[] = [];
  for (const child of el.childNodes) collectFormattedParts(child, parts);
  return serializeFormattedParts(parts);
}

function readExplicitBlockAlignment(
  el: Element,
): BoardResolutionParagraphAlignment | undefined {
  const inline = (el as HTMLElement).style.textAlign;
  if (inline === 'center' || inline === 'right' || inline === 'justify' || inline === 'left') {
    return inline;
  }
  return undefined;
}

function patchFromBlockElement(el: Element): BoardResolutionParagraphPatch {
  const line = extractFormattedTextFromElement(el);
  const text = line.replace(/<\/?(?:strong|b)(?:\s[^>]*)?>/gi, '');
  const align = readExplicitBlockAlignment(el);
  return {
    text,
    line,
    ...(align !== undefined ? { align } : {}),
  };
}

/** Extract paragraph patches from a docx-preview render (bold markers + optional alignment). */
function extractPreviewDocumentPatches(root: HTMLElement): BoardResolutionParagraphPatch[] {
  const wrapper = root.querySelector('.docx-wrapper');
  if (!wrapper) {
    const text = root.innerText.replace(/\u00a0/g, ' ').trim();
    return text ? [{ text }] : [{ text: '' }];
  }

  const blocks = Array.from(wrapper.querySelectorAll('p, li'));
  if (blocks.length === 0) {
    const text = (wrapper.textContent ?? '').replace(/\u00a0/g, ' ').trim();
    return text ? [{ text }] : [{ text: '' }];
  }

  return blocks.map((el) => patchFromBlockElement(el));
}

/** Extract formatted draft content for persistence and docx patching. */
export function extractPreviewDocumentContent(root: HTMLElement): string {
  return serializeBoardResolutionPatchContent(extractPreviewDocumentPatches(root));
}

/** Plain-text lines (no markup) for finalize fallback and display. */
export function extractPreviewDocumentText(root: HTMLElement): string {
  return extractPreviewDocumentPatches(root)
    .map((paragraph) => paragraph.text)
    .join('\n');
}

function editablePreviewWrapper(root: HTMLElement): HTMLElement | null {
  return root.querySelector<HTMLElement>('.docx-wrapper.br-editable-document');
}

function selectionAnchorInPreview(root: HTMLElement): boolean {
  const wrapper = editablePreviewWrapper(root);
  const sel = window.getSelection();
  if (!wrapper || !sel?.anchorNode) return false;
  return wrapper.contains(sel.anchorNode);
}

function getSelectionBlockElement(root: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel?.anchorNode) return null;

  const wrapper = editablePreviewWrapper(root) ?? previewWrapper(root);
  if (!wrapper?.contains(sel.anchorNode)) return null;

  let node: Node | null = sel.anchorNode;
  while (node && node !== wrapper) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === 'p' || tag === 'li') return node as HTMLElement;
    }
    node = node.parentNode;
  }

  return null;
}

export type PreviewTextAlignment = BoardResolutionParagraphAlignment;

export type PreviewFormatSelectionState = {
  inPreview: boolean;
  hasTextSelection: boolean;
  inParagraph: boolean;
  paragraphAlignment: BoardResolutionParagraphAlignment | null;
  boldActive: boolean;
};

/** @deprecated Use PreviewFormatSelectionState */
export type PreviewFormatState = {
  bold: boolean;
  alignment: PreviewTextAlignment;
  hasTextSelection: boolean;
  inParagraph: boolean;
};

/** Toolbar enablement + active states from the current preview selection. */
export function getPreviewFormatSelectionState(root: HTMLElement): PreviewFormatSelectionState {
  const inPreview = selectionAnchorInPreview(root);
  const sel = window.getSelection();
  const hasTextSelection = Boolean(inPreview && sel && !sel.isCollapsed);
  const blockEl = inPreview ? getSelectionBlockElement(root) : null;
  const inParagraph = Boolean(blockEl);
  const paragraphAlignment = blockEl
    ? (readExplicitBlockAlignment(blockEl) ?? 'left')
    : null;

  return {
    inPreview,
    hasTextSelection,
    inParagraph,
    paragraphAlignment,
    boldActive: inPreview && isPreviewBoldActive(),
  };
}

/** Toggle bold on the current selection in the editable preview. */
export function togglePreviewBold(root: HTMLElement): boolean {
  const target = editablePreviewWrapper(root);
  if (!target) return false;

  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return false;

  target.focus();
  document.execCommand('bold');
  return true;
}

/** Whether the current selection in the editable preview is bold. */
function isPreviewBoldActive(): boolean {
  try {
    return document.queryCommandState('bold');
  } catch {
    return false;
  }
}

/** Apply paragraph alignment to the block containing the current caret/selection. */
export function setPreviewParagraphAlignment(
  root: HTMLElement,
  align: BoardResolutionParagraphAlignment,
): boolean {
  const target = editablePreviewWrapper(root);
  const blockEl = getSelectionBlockElement(root);
  if (!target || !blockEl) return false;

  target.focus();
  blockEl.style.textAlign = align;
  return true;
}

/** Simplified format state for toolbar consumers. */
export function getPreviewFormatState(root: HTMLElement): PreviewFormatState {
  const state = getPreviewFormatSelectionState(root);
  return {
    bold: state.boldActive,
    alignment: state.paragraphAlignment ?? 'left',
    hasTextSelection: state.hasTextSelection,
    inParagraph: state.inParagraph,
  };
}

/** @deprecated Use setPreviewParagraphAlignment */
export const setPreviewAlignment = setPreviewParagraphAlignment;

interface FullDocumentEditHandlers {
  onDocumentChange: (content: string) => void;
  onDocumentBlur?: () => void;
}

/** Makes the rendered docx-preview body fully editable. */
export function attachFullDocumentEditing(
  root: HTMLElement,
  handlers: FullDocumentEditHandlers,
): () => void {
  const wrapper = root.querySelector<HTMLElement>('.docx-wrapper');
  const target = wrapper ?? root;

  target.contentEditable = 'true';
  target.spellcheck = true;
  target.classList.add('br-editable-document', 'outline-none', 'cursor-text');

  const sync = () => {
    handlers.onDocumentChange(extractPreviewDocumentContent(root));
  };

  const handleInput = () => {
    sync();
  };

  const handleBlur = () => {
    sync();
    handlers.onDocumentBlur?.();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'b') return;
    event.preventDefault();
    document.execCommand('bold');
    sync();
  };

  target.addEventListener('input', handleInput);
  target.addEventListener('blur', handleBlur);
  target.addEventListener('keydown', handleKeyDown);

  return () => {
    target.contentEditable = 'false';
    target.spellcheck = false;
    target.classList.remove('br-editable-document', 'outline-none', 'cursor-text');
    target.removeEventListener('input', handleInput);
    target.removeEventListener('blur', handleBlur);
    target.removeEventListener('keydown', handleKeyDown);
  };
}
