'use client';

import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
} from 'lucide-react';
import type { BoardResolutionParagraphAlignment } from '@/lib/board-resolution-docx-body';
import type { PreviewFormatSelectionState } from '@/lib/board-resolution-preview-editable';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type BoardResolutionFormatToolbarProps = {
  disabled?: boolean;
  formatState: PreviewFormatSelectionState;
  onBold: () => void;
  onAlign: (align: BoardResolutionParagraphAlignment) => void;
  className?: string;
};

const ALIGNMENTS: Array<{
  align: BoardResolutionParagraphAlignment;
  label: string;
  Icon: typeof AlignLeft;
}> = [
  { align: 'left', label: 'Align left', Icon: AlignLeft },
  { align: 'center', label: 'Align center', Icon: AlignCenter },
  { align: 'right', label: 'Align right', Icon: AlignRight },
  { align: 'justify', label: 'Justify', Icon: AlignJustify },
];

export function BoardResolutionFormatToolbar({
  disabled = false,
  formatState,
  onBold,
  onAlign,
  className,
}: BoardResolutionFormatToolbarProps) {
  const toolbarDisabled = disabled || !formatState.inPreview;

  const iconButtonClass = cn(
    'h-7 w-7 shrink-0 text-text-secondary hover:text-ink hover:bg-raised/80',
    'disabled:opacity-50 disabled:text-text-secondary',
  );

  const activeIconButtonClass =
    'bg-primary/15 text-blue-600 ring-1 ring-gold/40 hover:bg-primary/15 hover:text-blue-600';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md border border-border bg-panel p-0.5 shadow-sm',
        className,
      )}
      role="toolbar"
      aria-label="Document formatting"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          iconButtonClass,
          formatState.boldActive && activeIconButtonClass,
        )}
        aria-label="Bold"
        aria-pressed={formatState.boldActive}
        disabled={toolbarDisabled || !formatState.hasTextSelection}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onBold}
      >
        <Bold className="h-3.5 w-3.5" aria-hidden />
      </Button>

      <span className="mx-0.5 h-4 w-px bg-border/70" aria-hidden />

      {ALIGNMENTS.map(({ align, label, Icon }) => (
        <Button
          key={align}
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            iconButtonClass,
            formatState.paragraphAlignment === align && activeIconButtonClass,
          )}
          aria-label={label}
          aria-pressed={formatState.paragraphAlignment === align}
          disabled={toolbarDisabled || !formatState.inParagraph}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onAlign(align)}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </Button>
      ))}
    </div>
  );
}
