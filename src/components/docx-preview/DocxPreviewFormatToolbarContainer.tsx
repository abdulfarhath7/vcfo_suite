'use client';

import { useEffect, useRef, useState } from 'react';

import { BoardResolutionFormatToolbar } from '@/components/board-resolution/BoardResolutionFormatToolbar';
import type { BoardResolutionParagraphAlignment } from '@/lib/board-resolution-docx-body';
import type { PreviewFormatSelectionState } from '@/lib/board-resolution-preview-editable';

const EMPTY_FORMAT_STATE: PreviewFormatSelectionState = {
  inPreview: false,
  hasTextSelection: false,
  inParagraph: false,
  paragraphAlignment: null,
  boldActive: false,
};

export type DocxPreviewFormatHandle = {
  getFormatSelectionState: () => PreviewFormatSelectionState;
  toggleBold: () => boolean;
  setParagraphAlignment: (align: BoardResolutionParagraphAlignment) => boolean;
  getDocumentContent: () => string;
};

export type DocxPreviewFormatToolbarContainerProps = {
  disabled?: boolean;
  previewRef: React.RefObject<DocxPreviewFormatHandle | null>;
  onFormatChange: () => void;
  className?: string;
};

/** Syncs selection state with a docx-preview editor ref and renders bold/alignment controls. */
export function DocxPreviewFormatToolbarContainer({
  disabled = false,
  previewRef,
  onFormatChange,
  className,
}: DocxPreviewFormatToolbarContainerProps) {
  const [formatState, setFormatState] = useState<PreviewFormatSelectionState>(EMPTY_FORMAT_STATE);
  const prevDisabledRef = useRef(disabled);

  if (disabled !== prevDisabledRef.current) {
    prevDisabledRef.current = disabled;
    if (disabled) setFormatState(EMPTY_FORMAT_STATE);
  }

  useEffect(() => {
    if (disabled) return;

    const syncFormatState = () => {
      const next = previewRef.current?.getFormatSelectionState();
      if (next) setFormatState(next);
    };

    syncFormatState();
    document.addEventListener('selectionchange', syncFormatState);
    return () => document.removeEventListener('selectionchange', syncFormatState);
  }, [disabled, previewRef]);

  const runFormat = (action: () => boolean) => {
    if (disabled || !previewRef.current) return;
    if (action()) {
      setFormatState(previewRef.current.getFormatSelectionState());
      onFormatChange();
    }
  };

  return (
    <BoardResolutionFormatToolbar
      disabled={disabled}
      formatState={formatState}
      className={className}
      onBold={() => runFormat(() => previewRef.current?.toggleBold() ?? false)}
      onAlign={(align) =>
        runFormat(() => previewRef.current?.setParagraphAlignment(align) ?? false)
      }
    />
  );
}
