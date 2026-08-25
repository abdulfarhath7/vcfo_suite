"use client";

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { KnowledgeBankPageView } from '@/views/knowledge-bank/KnowledgeBankPageSections';
import { useApp } from "@/context/AppContext";
import { useRealtimeKnowledgeBank } from "@/lib/supabase/use-realtime-knowledge-bank";
import {
  removeKnowledgeBankStorageObject,
  uploadKnowledgeBankFile,
  validateKnowledgeBankUploadFile,
} from "@/lib/knowledge-bank-storage";
import { KNOWLEDGE_BANK_EXTENSIONS, resolveUploadContentType } from "@/lib/upload-limits";
import { toastError, toastSuccess } from "@/lib/toast-errors";
import { isAdminOrManager } from "@/lib/auth";
import { isUuid } from "@/lib/slug";
import {
  knowledgeBankFileMatchesQuery,
} from "@/lib/knowledge-bank-search";
import {
  isKnowledgeBankFolderEmpty,
  knowledgeBankChildFolders,
  knowledgeBankFilesInFolder,
  knowledgeBankFolderAncestors,
} from "@/lib/knowledge-bank-folders";
import {
  initialKnowledgeBankUiState,
  knowledgeBankUiReducer,
  type KnowledgeBankDeleteTarget,
  type KnowledgeBankFile,
  type KnowledgeBankFolder,
} from '@/views/knowledge-bank/knowledge-bank-ui-state';

interface LibraryResponse {
  ok?: boolean;
  files?: KnowledgeBankFile[];
  folders?: KnowledgeBankFolder[];
  error?: string;
}

function parseKnowledgeBankLibrary(data: unknown): {
  files: KnowledgeBankFile[];
  folders: KnowledgeBankFolder[];
} {
  if (Array.isArray(data)) {
    return { files: data as KnowledgeBankFile[], folders: [] };
  }
  if (!data || typeof data !== 'object') {
    return { files: [], folders: [] };
  }
  const body = data as LibraryResponse;
  return {
    files: Array.isArray(body.files) ? body.files : [],
    folders: Array.isArray(body.folders) ? body.folders : [],
  };
}

async function fetchKnowledgeBankLibrary(): Promise<{
  files: KnowledgeBankFile[];
  folders: KnowledgeBankFolder[];
}> {
  const res = await fetch("/api/knowledge-bank");
  const data: unknown = await res.json();
  const body = data as LibraryResponse;
  if (!res.ok || (body && typeof body === 'object' && !Array.isArray(body) && body.ok === false)) {
    throw new Error(body?.error ?? "fetch_failed");
  }
  return parseKnowledgeBankLibrary(data);
}

function uploaderLabel(file: KnowledgeBankFile): string {
  if (file.uploaderName?.trim()) return file.uploaderName.trim();
  if (file.uploaderEmail?.trim()) return file.uploaderEmail.trim();
  return "Unknown";
}

interface Props {
  basePath: "/app/admin/knowledge-bank" | "/app/manager/knowledge-bank" | "/app/intern/knowledge-bank";
}

export default function KnowledgeBankPage({ basePath }: Props) {
  return (
    <Suspense fallback={null}>
      <KnowledgeBankPageInner basePath={basePath} />
    </Suspense>
  );
}

function KnowledgeBankPageInner({ basePath }: Props) {
  const { user } = useApp();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQ = searchParams.get("q") ?? "";

  useRealtimeKnowledgeBank({ user, queryClient });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ui, dispatchUi] = useReducer(
    knowledgeBankUiReducer,
    urlQ,
    (q) => ({ ...initialKnowledgeBankUiState, q }),
  );
  const {
    q,
    title,
    description,
    selectedFile,
    uploading,
    folderName,
    creatingFolder,
    deleteTarget,
    deleting,
    downloadingId,
  } = ui;
  const setQ = (value: string) => dispatchUi({ type: 'patch', patch: { q: value } });
  const setTitle = (value: string) => dispatchUi({ type: 'patch', patch: { title: value } });
  const setDescription = (value: string) => dispatchUi({ type: 'patch', patch: { description: value } });
  const setSelectedFile = (value: File | null) => dispatchUi({ type: 'patch', patch: { selectedFile: value } });
  const setFolderName = (value: string) => dispatchUi({ type: 'patch', patch: { folderName: value } });
  const setDeleteTarget = (value: KnowledgeBankDeleteTarget | null) =>
    dispatchUi({ type: 'set_delete_target', target: value });

  const canDelete = isAdminOrManager(user?.role);

  const libraryQuery = useQuery({
    queryKey: ["knowledge-bank"],
    queryFn: fetchKnowledgeBankLibrary,
    staleTime: 30_000,
  });

  const folders = libraryQuery.data?.folders ?? [];
  const files = libraryQuery.data?.files ?? [];
  const folderParam = searchParams.get("folder");
  const requestedFolderId = folderParam && isUuid(folderParam) ? folderParam : null;
  const currentFolderId =
    requestedFolderId &&
    (libraryQuery.isLoading || folders.some((folder) => folder.id === requestedFolderId))
      ? requestedFolderId
      : null;

  useEffect(() => {
    setQ(urlQ);
  }, [urlQ]);

  const ancestors = useMemo(
    () => knowledgeBankFolderAncestors(currentFolderId, folders),
    [currentFolderId, folders],
  );
  const childFolders = useMemo(
    () => knowledgeBankChildFolders(currentFolderId, folders),
    [currentFolderId, folders],
  );
  const childFiles = useMemo(
    () => knowledgeBankFilesInFolder(currentFolderId, files),
    [currentFolderId, files],
  );

  const searching = q.trim().length > 0;
  const query = q.trim().toLowerCase();

  const filteredFolders = useMemo(() => {
    if (!searching) return childFolders;
    return folders.filter((folder) => folder.name.toLowerCase().includes(query));
  }, [searching, childFolders, folders, query]);

  const filteredFiles = useMemo(() => {
    const pool = searching ? files : childFiles;
    if (!query) return pool;
    return pool.filter(
      (file) =>
        knowledgeBankFileMatchesQuery(file, q) ||
        uploaderLabel(file).toLowerCase().includes(query),
    );
  }, [searching, files, childFiles, query, q]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-bank"] });
  }, [queryClient]);

  const openFolder = useCallback(
    (folderId: string | null) => {
      dispatchUi({ type: 'patch', patch: { q: '' } });
      if (folderId) router.push(`${basePath}?folder=${folderId}`);
      else router.push(basePath);
    },
    [basePath, router],
  );

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toastError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      toastError("Enter a title for this document.");
      return;
    }

    const validationErr = validateKnowledgeBankUploadFile(selectedFile);
    if (validationErr) {
      toastError(validationErr);
      return;
    }

    dispatchUi({ type: 'patch', patch: { uploading: true } });
    try {
      const { path: storagePath, fileId } = await uploadKnowledgeBankFile(selectedFile);

      const res = await fetch("/api/knowledge-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: fileId,
          title: title.trim(),
          description: description.trim() || undefined,
          storagePath,
          fileName: selectedFile.name,
          mimeType: resolveUploadContentType(selectedFile, KNOWLEDGE_BANK_EXTENSIONS),
          sizeBytes: selectedFile.size,
          folderId: currentFolderId,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        await removeKnowledgeBankStorageObject(storagePath);
        toastError(data.error ?? "Upload failed.");
        return;
      }

      toastSuccess("Document added to Knowledge Bank.");
      dispatchUi({ type: 'clear_upload_form' });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed.";
      toastError(message);
    } finally {
      dispatchUi({ type: 'patch', patch: { uploading: false } });
    }
  }

  async function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!folderName.trim()) {
      toastError("Enter a folder name.");
      return;
    }

    dispatchUi({ type: 'patch', patch: { creatingFolder: true } });
    try {
      const res = await fetch("/api/knowledge-bank/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: folderName.trim(),
          parentId: currentFolderId,
        }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "duplicate_folder_name") {
          toastError("A folder with that name already exists here.");
        } else if (data.error === "folder_too_deep") {
          toastError("This folder is nested too deeply.");
        } else {
          toastError(data.error ?? "Could not create folder.");
        }
        return;
      }
      toastSuccess("Folder created.");
      dispatchUi({ type: 'clear_folder_form' });
      await refresh();
    } catch {
      toastError("Could not create folder.");
    } finally {
      dispatchUi({ type: 'patch', patch: { creatingFolder: false } });
    }
  }

  async function handleDownload(file: KnowledgeBankFile) {
    dispatchUi({ type: 'patch', patch: { downloadingId: file.id } });
    try {
      const res = await fetch(`/api/knowledge-bank/${file.id}/download`);
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        toastError(data.error ?? "Download failed.");
        return;
      }
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch {
      toastError("Download failed.");
    } finally {
      dispatchUi({ type: 'patch', patch: { downloadingId: null } });
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    dispatchUi({ type: 'patch', patch: { deleting: true } });
    try {
      if (deleteTarget.kind === "folder") {
        const res = await fetch(`/api/knowledge-bank/folders/${deleteTarget.folder.id}`, {
          method: "DELETE",
        });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          if (data.error === "folder_not_empty") {
            toastError("Remove files and subfolders first.");
          } else {
            toastError(data.error ?? "Delete failed.");
          }
          return;
        }
        toastSuccess("Folder removed.");
        if (currentFolderId === deleteTarget.folder.id) openFolder(deleteTarget.folder.parentId);
      } else {
        const res = await fetch(`/api/knowledge-bank/${deleteTarget.file.id}`, { method: "DELETE" });
        const data = (await res.json()) as { ok: boolean; error?: string };
        if (!res.ok || !data.ok) {
          toastError(data.error ?? "Delete failed.");
          return;
        }
        toastSuccess("Document removed from Knowledge Bank.");
      }
      setDeleteTarget(null);
      await refresh();
    } catch {
      toastError("Delete failed.");
    } finally {
      dispatchUi({ type: 'patch', patch: { deleting: false } });
    }
  }

  const viewProps = {
    basePath,
    canDelete,
    title,
    setTitle,
    description,
    setDescription,
    selectedFile,
    setSelectedFile,
    fileInputRef,
    uploading,
    handleUpload,
    folderName,
    setFolderName,
    creatingFolder,
    handleCreateFolder,
    libraryQuery,
    filteredFiles,
    filteredFolders,
    q,
    setQ,
    searching,
    currentFolderId,
    ancestors,
    openFolder,
    folderIsEmpty: (folderId: string) => isKnowledgeBankFolderEmpty(folderId, folders, files),
    handleDownload,
    downloadingId,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    deleting,
  };
  return <KnowledgeBankPageView {...viewProps} />;
}
