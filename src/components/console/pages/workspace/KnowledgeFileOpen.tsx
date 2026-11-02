'use client';

/**
 * /app/<seat>/knowledge-bank/<id> — the old shell's knowledge reader (one file with its preview,
 * Download, Delete). The console's Knowledge bank previews a file in a modal over the library, so
 * this address opens that preview and lands in the file's folder, where Download and Delete
 * (managers) sit on the row. A file that is gone says so and lands on the library.
 */
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import type { KnowledgeBankFile, KnowledgeBankFolder } from '@/views/knowledge-bank/knowledge-bank-ui-state';
import { useConsole, useCrumbs } from '../../runtime';
import { dayLabel, kbUploaderLabel, sizeLabel } from './model';
import { FilePreview, PanelLoading } from './shared';

/** The Knowledge bank page's query key, so coming from the list costs no second load. */
const KB_KEY = ['knowledge-bank'] as const;

type Library = { files: KnowledgeBankFile[]; folders: KnowledgeBankFolder[] };

async function fetchLibrary(): Promise<Library> {
  const res = await fetch('/api/knowledge-bank');
  const data: unknown = await res.json();
  const body = data as { ok?: boolean; files?: KnowledgeBankFile[]; folders?: KnowledgeBankFolder[]; error?: string };
  if (!res.ok || (body && typeof body === 'object' && !Array.isArray(body) && body.ok === false)) throw new Error(body?.error ?? 'fetch_failed');
  if (Array.isArray(data)) return { files: data as KnowledgeBankFile[], folders: [] };
  return { files: Array.isArray(body?.files) ? body.files : [], folders: Array.isArray(body?.folders) ? body.folders : [] };
}

async function downloadUrl(file: KnowledgeBankFile): Promise<string | null> {
  try {
    const res = await fetch(`/api/knowledge-bank/${file.id}/download`);
    const data = (await res.json()) as { ok: boolean; url?: string };
    return res.ok && data.ok && data.url ? data.url : null;
  } catch {
    return null;
  }
}

export function KnowledgeFileOpen({ id }: { id: string }) {
  const { base, openModal, toast } = useConsole();
  const router = useRouter();
  useCrumbs(['Knowledge bank']);
  const lib = useQuery({ queryKey: KB_KEY, queryFn: fetchLibrary, staleTime: 30_000 });
  const done = useRef(false);
  useEffect(() => {
    if (done.current || lib.isPending) return;
    done.current = true;
    const home = `${base}/knowledge-bank`;
    const file = lib.data?.files.find((f) => f.id === id);
    if (!file) {
      toast(lib.isError ? 'The knowledge bank could not load. Try again from the library.' : 'That file is no longer in the knowledge bank.');
      router.replace(home);
      return;
    }
    openModal(
      <FilePreview
        title={file.title}
        fileName={file.fileName}
        contentType={file.mimeType}
        meta={[file.fileName, file.folderPath || 'Knowledge bank', sizeLabel(file.sizeBytes), `${dayLabel(file.createdAt)} · ${kbUploaderLabel(file)}`].filter(Boolean).join(' · ')}
        load={() => downloadUrl(file)}
        openLabel="Download"
      />,
      { cls: 'ws-prevm', label: 'Document preview' },
    );
    router.replace(file.folderId ? `${home}?folder=${encodeURIComponent(file.folderId)}` : home);
  }, [lib.isPending, lib.isError, lib.data, id, base, openModal, toast, router]);
  return <PanelLoading label="Opening the document…" />;
}
