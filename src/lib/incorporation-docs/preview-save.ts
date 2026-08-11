export type IncorpDocSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

export const INCORP_DOC_AUTOSAVE_DEBOUNCE_MS = 5000;

export function incorpDocSaveStatusLabel(status: IncorpDocSaveStatus): string | null {
  switch (status) {
    case 'pending':
      return 'Unsaved changes';
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
