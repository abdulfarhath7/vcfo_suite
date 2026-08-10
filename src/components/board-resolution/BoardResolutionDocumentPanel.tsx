'use client';

type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export type BoardResolutionDocumentPanelProps = {
  saveStatus: SaveStatus;
};

function saveStatusLabel(status: SaveStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Unsaved changes…';
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'All changes saved';
    case 'error':
      return 'Save failed';
    default:
      return null;
  }
}

export function BoardResolutionDocumentPanel({ saveStatus }: BoardResolutionDocumentPanelProps) {
  const statusText = saveStatusLabel(saveStatus);

  return (
    <aside
      className="flex flex-col rounded-lg border border-border/60 bg-panel/40"
      aria-label="Document editing"
    >
      {statusText && (
        <div className="border-b border-border/50 px-4 py-3">
          <p className="text-[11px] text-text-tertiary" aria-live="polite" aria-atomic="true">
            {statusText}
          </p>
        </div>
      )}
    </aside>
  );
}
