'use client';

import { useState } from 'react';
import { uploadAskAttachment } from '@/hooks/ask/ask-api';

export const ASK_FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.csv,.tsv,.txt';
const MAX_FILES = 5;

/** The files waiting to go with a chat message: the staff composer and the client's chat window share this. */
export function useAskFiles() {
  const [files, setFiles] = useState<Array<{ id: string; fileName: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Takes the chosen files at once, so the caller can clear its file input straight after. */
  const add = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of [...list].slice(0, MAX_FILES - files.length)) {
        const added = await uploadAskAttachment(file);
        setFiles((now) => [...now, added]);
      }
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** Hands over what is attached, as `ask()` takes it, and empties the list. */
  const take = () => {
    const attachmentIds = files.map((file) => file.id);
    setFiles([]);
    setError(null);
    return {
      attachmentIds: attachmentIds.length > 0 ? attachmentIds : undefined,
      label: `Attached ${attachmentIds.length} file${attachmentIds.length === 1 ? '' : 's'}`,
    };
  };

  const remove = (id: string) => setFiles((now) => now.filter((file) => file.id !== id));

  return { files, uploading, error, full: files.length >= MAX_FILES, add, take, remove };
}
