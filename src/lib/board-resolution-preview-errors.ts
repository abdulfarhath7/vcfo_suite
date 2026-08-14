export type BoardResolutionPreviewErrorKind =
  | 'corrupt_xml'
  | 'not_found'
  | 'forbidden'
  | 'load_failed'
  | 'unknown';

export type BoardResolutionPreviewError = {
  kind: BoardResolutionPreviewErrorKind;
  title: string;
  message: string;
  steps: string[];
  /** Raw parser or fetch detail for support / dev. */
  technicalDetail?: string;
  downloadMayWork?: boolean;
};

export function isDocxXmlParseError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('xml:space') ||
    (lower.includes('attribute') && lower.includes('redefined')) ||
    lower.includes('error on line') ||
    (lower.includes('xml') && lower.includes('parse'))
  );
}

export function buildBoardResolutionPreviewError(
  raw: string,
  options?: { httpStatus?: number },
): BoardResolutionPreviewError {
  const status = options?.httpStatus;

  if (status === 404 || raw.toLowerCase().includes('not been generated')) {
    return {
      kind: 'not_found',
      title: 'No Word document yet',
      message: 'The stored board resolution file has not been generated for this project.',
      steps: [
        'Complete Step 1 (Name Application) if the client has not submitted it.',
        'Click Generate Word document from Pre-1 on this page.',
      ],
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

  if (isDocxXmlParseError(raw)) {
    return {
      kind: 'corrupt_xml',
      title: 'The stored document could not be previewed',
      message:
        'The Word file in storage has invalid XML inside it (often from an older inline edit or save). The file may still open in Microsoft Word, but the in-browser preview cannot render it.',
      steps: [
        'Click Apply latest template to rebuild the stored file from the current template (keeps Pre-1 merge data).',
        'If that does not fix the preview, click Re-generate from Pre-1 to merge Step 1 data again.',
        'Use Download Word document below to inspect the file Word can still read.',
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
      steps: ['Refresh the page and try again.', 'If the problem continues, contact your engagement team.'],
      technicalDetail: raw,
    };
  }

  return {
    kind: 'unknown',
    title: 'Preview could not be shown',
    message: raw.trim() || 'An unexpected error occurred while rendering the document.',
    steps: ['Refresh the page.', 'Try Download Word document below.', 'Use Apply latest template if the file may be damaged.'],
    technicalDetail: raw !== 'Preview failed.' ? raw : undefined,
  };
}

/** @deprecated Use buildBoardResolutionPreviewError — kept for toast string matching during transition. */
