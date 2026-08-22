'use client';

import { useQuery } from '@tanstack/react-query';
import type { IndexedDocumentRow } from '@/lib/vault-documents';

interface DocumentsListResponse {
  ok?: boolean;
  error?: string;
  documents?: IndexedDocumentRow[];
}

export function useIndexedDocuments(enabled: boolean) {
  return useQuery({
    queryKey: ['documents', 'vault'],
    enabled,
    queryFn: async (): Promise<IndexedDocumentRow[]> => {
      const res = await fetch('/api/documents');
      const data = (await res.json()) as DocumentsListResponse;
      if (!res.ok || data.ok === false) {
        throw new Error(data.error ?? 'fetch_failed');
      }
      return data.documents ?? [];
    },
  });
}

export async function getIndexedDocumentSignedUrl(id: string): Promise<string | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;
  try {
    const res = await fetch(`/api/documents/${encodeURIComponent(trimmed)}/signed-url`);
    if (!res.ok) return null;
    const data = (await res.json()) as { url?: string };
    return data.url ?? null;
  } catch {
    return null;
  }
}
