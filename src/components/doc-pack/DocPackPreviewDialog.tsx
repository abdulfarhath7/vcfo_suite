'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IncorporationDocxPreview } from '@/components/incorporation/IncorporationDocxPreview';
import { docPackRowName } from '@/lib/doc-pack/labels';
import type { DocPackItem } from '@/lib/doc-pack/types';

/** Read-only in-browser render of one pack item, fed by the same route that downloads it. */
export function DocPackPreviewDialog({
  item,
  previewUrl,
  onClose,
}: {
  item: DocPackItem | null;
  previewUrl: string | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(item)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] w-[min(96vw,60rem)] max-w-none overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-[16px]">{item ? docPackRowName(item) : 'Preview'}</DialogTitle>
          <DialogDescription>
            {item?.source === 'attached' ? 'The file stored for this document.' : 'Rendered now from the checklist answers.'}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(90vh-5.5rem)] overflow-auto bg-muted/30 p-4">
          {item && previewUrl ? (
            <IncorporationDocxPreview downloadUrl={previewUrl} previewLabel={docPackRowName(item)} refreshKey={item.key} />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
