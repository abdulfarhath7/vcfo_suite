'use client';

import { useState } from 'react';
import { Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { IncorporationDocxPreview } from '@/components/incorporation/IncorporationDocxPreview';
import { NOC_TEMPLATES, nocTemplatePreviewUrl } from '@/lib/noc/templates';
import type { NocVariant } from '@/lib/noc/variant';

/**
 * The muted "NOC: …" line under the ownership pickers, plus a read-only render
 * of the blank template the answers select. The variant is never chosen by
 * hand — it follows Ownership / Parent company is / Parent's role.
 */
export function NocTemplateLine({ variant }: { variant: NocVariant }) {
  const [open, setOpen] = useState(false);
  const def = NOC_TEMPLATES[variant];
  const previewUrl = nocTemplatePreviewUrl(variant);
  // Registry labels read "NOC — …"; drop the prefix so the line isn't "NOC: NOC — …".
  const shortLabel = def.label.replace(/^NOC — /, '');

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p className="text-[11.5px] text-muted-foreground">
        NOC: {shortLabel}
        {previewUrl ? null : ' · template not provided yet'}
      </p>
      {previewUrl ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2.5 text-[11.5px]"
          onClick={() => setOpen(true)}
        >
          <Eye className="h-3.5 w-3.5" aria-hidden />
          Preview NOC template
        </Button>
      ) : null}
      {previewUrl ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] w-[min(96vw,60rem)] max-w-none overflow-hidden p-0 sm:max-w-none">
            <DialogHeader className="border-b border-border px-5 py-4">
              <DialogTitle className="text-[16px]">{def.label}</DialogTitle>
              <DialogDescription>
                Blank template, picked from the ownership answers. Details are filled in later.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[calc(90vh-5.5rem)] overflow-auto bg-muted/30 p-4">
              {open ? (
                <IncorporationDocxPreview
                  downloadUrl={previewUrl}
                  previewLabel={def.label}
                  refreshKey={variant}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
