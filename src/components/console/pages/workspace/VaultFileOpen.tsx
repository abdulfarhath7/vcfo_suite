'use client';

/**
 * /app/<seat>/vault/view/<id> — the old shell's document viewer (an overlay over the vault). The
 * console's Document vault previews a file in a modal over the explorer, so this address opens
 * that preview (with Open step), remembers the file's client as the vault's picked client and
 * lands on the vault. The documents are read exactly as the vault reads them (checklist uploads
 * plus the documents index, kept to the caller's engagements; a lead sees only their clients'),
 * so a link to a file outside the caller's book says so.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getItem } from '@/data/checklist';
import { useApp } from '@/context/AppContext';
import { internVisibleDocuments } from '@/lib/documents/document-access';
import { engagementIdAliases } from '@/lib/projects/legacy-engagement-ids';
import { getMilestoneDocumentSignedUrl, isMilestoneStoragePath } from '@/lib/documents/milestone-document-storage';
import { stepSlugForItemId } from '@/lib/slug';
import { getIndexedDocumentSignedUrl, useIndexedDocuments } from '@/hooks/use-vault-documents';
import {
  collectIndexedVaultDocuments,
  collectVaultDocuments,
  mergeVaultDocuments,
  scopeVaultDocumentsToEngagements,
  vaultLocationLabel,
  type VaultDocument,
} from '@/lib/documents/vault-documents';
import { useConsole, useCrumbs } from '../../runtime';
import { Btn } from '../../ui';
import { dayLabel } from './model';
import { FilePreview, PanelLoading } from './shared';

/** The vault page's remembered client (its own session key), so it opens on this file's client. */
const CLIENT_KEY = 'vcfo-vault-client';

function signedUrlOf(doc: VaultDocument): Promise<string | null> {
  if (doc.source === 'index' && doc.documentId && !isMilestoneStoragePath(doc.storagePath)) return getIndexedDocumentSignedUrl(doc.documentId);
  if (!doc.storagePath.trim()) return Promise.resolve(null);
  return getMilestoneDocumentSignedUrl(doc.storagePath);
}

export function VaultFileOpen({ id }: { id: string }) {
  const { base, go, openModal, toast } = useConsole();
  const { user, engagements, engagementsLoading, engagementsSettled, getStateForEngagement } = useApp();
  const router = useRouter();
  useCrumbs(['Document vault']);

  const indexed = useIndexedDocuments(Boolean(user) && !engagementsLoading);
  const docs = useMemo(() => {
    const milestoneDocs = collectVaultDocuments(engagements, getStateForEngagement);
    const indexedDocs = collectIndexedVaultDocuments(indexed.data ?? [], engagements);
    const merged = scopeVaultDocumentsToEngagements(mergeVaultDocuments(milestoneDocs, indexedDocs), engagements);
    return user?.role === 'intern' ? internVisibleDocuments(user.internId, merged, engagements) : merged;
  }, [engagements, getStateForEngagement, indexed.data, user?.internId, user?.role]);
  const settled = engagementsSettled && !engagementsLoading && (indexed.data !== undefined || indexed.isError);

  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const home = `${base}/vault`;
    const doc = docs.find((d) => d.id === id);
    if (!doc) {
      if (!settled) return;
      done.current = true;
      toast('That document is not in your vault.');
      router.replace(home);
      return;
    }
    done.current = true;
    const eng = engagements.find((e) => engagementIdAliases(e.id).includes(doc.engagementId));
    try {
      sessionStorage.setItem(CLIENT_KEY, eng?.id ?? doc.engagementId);
    } catch {
      /* storage unavailable */
    }
    const href = getItem(doc.milestoneId) ? `${base}/projects/${eng?.slug ?? doc.engagementId}/step/${stepSlugForItemId(doc.milestoneId)}` : null;
    openModal(
      <FilePreview
        title={doc.fileName}
        fileName={doc.fileName}
        meta={[doc.companyName, vaultLocationLabel(doc), doc.fieldLabel !== doc.fileName ? doc.fieldLabel : '', doc.uploadedAt ? `Uploaded ${dayLabel(doc.uploadedAt)}` : ''].filter(Boolean).join(' · ')}
        load={() => signedUrlOf(doc)}
        extra={
          href ? (
            <Btn ico="step" onClick={() => go(href)}>
              Open step
            </Btn>
          ) : null
        }
      />,
      { cls: 'ws-prevm', label: 'Document preview' },
    );
    router.replace(home);
  }, [docs, settled, id, base, engagements, go, openModal, toast, router]);

  return <PanelLoading label="Opening the document…" />;
}
