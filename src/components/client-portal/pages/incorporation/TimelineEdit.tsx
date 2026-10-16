'use client';

/**
 * Timeline "Edit" (OV-08) on the Incorporation landing: the same live editor as
 * Home (React port of tl-editor.js — drag / resize the phase bars, compare,
 * client "Request a timeline change"), fed by the same Home data.
 */
import { useHome } from '../home/useHome';
import { TimelineEditor } from '../home/TimelineEditor';
import '../../css/home-tle.css';

export function TimelineEdit({ onClose }: { onClose: () => void }) {
  const h = useHome();
  if (!h.timeline || !h.engagementId) return null;
  return (
    <TimelineEditor
      phases={h.timeline}
      today={h.today}
      engagementId={h.engagementId}
      company={h.company}
      manager={h.manager}
      onClose={onClose}
    />
  );
}
