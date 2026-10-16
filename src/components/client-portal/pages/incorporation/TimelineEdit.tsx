'use client';

/**
 * Timeline "Edit" (OV-08). The editor itself (tl-editor.js: drag / resize the
 * phase bars, manager "Save timeline", client "Request a timeline change") is
 * the Home page's. Until it is exported for reuse, Edit opens Home with the
 * editor requested (`#timeline-edit`). QUESTIONS.md › Incorporation.
 */
import { useEffect } from 'react';
import { usePortal } from '../../PortalProvider';
import { portalHref } from '../../routes';

export function TimelineEdit({ onClose }: { onClose: () => void }) {
  const { go, toast } = usePortal();
  useEffect(() => {
    toast('Opening the timeline editor on Home');
    go(`${portalHref('home')}#timeline-edit`);
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
