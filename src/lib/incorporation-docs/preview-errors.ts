export type IncorpDocPreviewErrorKind =
  | 'corrupt_xml'
  | 'not_found'
  | 'forbidden'
  | 'load_failed'
  | 'unknown';

export type IncorpDocPreviewError = {
  kind: IncorpDocPreviewErrorKind;
  title: string;
  message: string;
  steps: string[];
  technicalDetail?: string;
  downloadMayWork?: boolean;
};

function isIncorpDocxXmlParseError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('xml:space') ||
    (lower.includes('attribute') && lower.includes('redefined')) ||
    lower.includes('error on line') ||
    (lower.includes('xml') && lower.includes('parse'))
  );
}

export function buildIncorpDocPreviewError(
  raw: string,
  options?: { httpStatus?: number },
): IncorpDocPreviewError {
  const status = options?.httpStatus;

  if (status === 404 || raw.toLowerCase().includes('not been generated')) {
    return {
      kind: 'not_found',
      title: 'No Word document yet',
      message: 'This draft has not been generated for the selected director.',
      steps: ['Click Generate all drafts (or DIR-2 only) to create the document.'],
    };
  }

  if (status === 403 || raw.toLowerCase().includes('do not have access')) {
    return {
      kind: 'forbidden',
      title: 'Preview not available',
      message: 'You do not have permission to load this document preview.',
      steps: ['Sign in with the correct role or ask your manager for access.'],
    };
  }

  if (isIncorpDocxXmlParseError(raw)) {
    return {
      kind: 'corrupt_xml',
      title: 'The stored document could not be previewed',
      message:
        'The stored Word file has invalid XML. We attempted an automatic repair for preview. If this still fails, re-generate this draft once.',
      steps: [
        'Click Re-generate this draft below.',
        'If needed, use Generate all drafts to rebuild every Pre-7 document.',
      ],
      technicalDetail: raw,
      downloadMayWork: true,
    };
  }

  if (status && status >= 500) {
    return {
      kind: 'load_failed',
      title: 'Could not load preview',
      message: 'The server could not return the Word file for preview.',
      steps: ['Refresh the page and try again.', 'If the problem continues, re-generate the draft.'],
      technicalDetail: raw,
    };
  }

  return {
    kind: 'unknown',
    title: 'Preview could not be shown',
    message: raw.trim() || 'An unexpected error occurred while rendering the document.',
    steps: ['Refresh the page.', 'Try Download Word file instead.', 'Re-generate this draft if needed.'],
    technicalDetail: raw !== 'Preview failed.' ? raw : undefined,
  };
}
