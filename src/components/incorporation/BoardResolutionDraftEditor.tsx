'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { BoardResolutionDocPreview } from '@/components/board-resolution/BoardResolutionDocPreview';
import { parseBoardResolutionPatchContent } from '@/lib/board-resolution/board-resolution-docx-body';
import type { ClientEditView } from '@/lib/board-resolution/client-edit-flow';

/** Sent on `window` after a save here, so the client edit panel on the same page reloads. */
export const BR_CLIENT_EDIT_SAVED_EVENT = 'br-client-edit-saved';

const clientEditBase = (engagementId: string) => `/api/engagements/${encodeURIComponent(engagementId)}/board-resolution/client-edit`;

/** The client edit view for this viewer, or null while it loads or when there is none. */
export function useClientEditView(engagementId: string, refreshKey?: string) {
  const [view, setView] = useState<ClientEditView | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch(clientEditBase(engagementId), { cache: 'no-store' });
      setView(res.ok ? (((await res.json()) as { view: ClientEditView | null }).view ?? null) : null);
    } catch {
      setView(null);
    }
  }, [engagementId]);
  useEffect(() => {
    void load();
    const reload = () => void load();
    window.addEventListener(BR_CLIENT_EDIT_SAVED_EVENT, reload);
    return () => window.removeEventListener(BR_CLIENT_EDIT_SAVED_EVENT, reload);
  }, [load, refreshKey]);
  return view;
}

/** True when this viewer may change the wording now (BR-04 the client; BR-05 the Lead or client after a return). */
export const canEditWording = (view: ClientEditView | null) => Boolean(view && (view.actions.includes('save') || view.actions.includes('correct')));

/**
 * BR-04 / BR-05: the board resolution as one document the person edits in place. They click in
 * the text, delete or type, and press "Save changes". There is no separate edit form. The firm's
 * original stays on file; the save is stored as the client's version, one paragraph per entry,
 * through the client edit route (audited, with tracked changes for staff). When this viewer may
 * not edit, the read-only preview passed as `fallback` shows instead.
 */
export function BoardResolutionDraftEditor({
  engagementId,
  refreshKey,
  previewLabel,
  fallback,
  onSaved,
}: {
  engagementId: string;
  refreshKey?: string;
  previewLabel?: string;
  fallback: ReactNode;
  onSaved?: () => void;
}) {
  const view = useClientEditView(engagementId, refreshKey);
  const [texts, setTexts] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState(0);
  if (!canEditWording(view)) return <>{fallback}</>;

  const base = clientEditBase(engagementId);
  // After a first save the person keeps editing their own version, not the firm's original.
  const downloadUrl = view!.edited ? `${base}?download=1&v=${savedKey}` : undefined;
  const dirty = texts !== null;

  const save = async () => {
    if (!texts) return;
    setSaving(true);
    try {
      const res = await fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paragraphs: texts }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? 'The changes were not saved. Try again.');
        return;
      }
      toast.success('Changes saved. The firm’s original version is kept.');
      setTexts(null);
      setSavedKey((k) => k + 1);
      window.dispatchEvent(new Event(BR_CLIENT_EDIT_SAVED_EVENT));
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="br-draft-editor">
      <div className="flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken px-3 py-2 text-[12.5px] text-ink-muted">
        <span className="min-w-0 flex-1">Click in the document to change the wording: delete or type as in Word. Then press “Save changes”. The firm keeps its original version.</span>
        <Button type="button" size="sm" variant="ghost" disabled={!dirty || saving} onClick={() => { setTexts(null); setSavedKey((k) => k + 1); }}>
          Undo changes
        </Button>
        <Button type="button" size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-line-soft">
        <BoardResolutionDocPreview
          engagementId={engagementId}
          downloadUrl={downloadUrl}
          refreshKey={`${refreshKey ?? ''}:${savedKey}`}
          previewLabel={previewLabel}
          editable
          onDocumentChange={(content) => setTexts(parseBoardResolutionPatchContent(content).map((p) => p.text))}
        />
      </div>
    </div>
  );
}
