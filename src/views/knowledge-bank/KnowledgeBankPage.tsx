"use client";

import { useCallback, useMemo, useReducer, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KnowledgeBankPageView } from '@/views/knowledge-bank/KnowledgeBankPageSections';
import { m as motion } from "framer-motion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageTransition } from "@/components/shell/PageTransition";
import { PageHeader } from "@/components/admin/PageHeader";
import { SEO } from "@/components/SEO";
import { AccentButton, NoirCard, Surface } from "@/components/noir";
import { useApp } from "@/context/AppContext";
import { useRealtimeKnowledgeBank } from "@/lib/supabase/use-realtime-knowledge-bank";
import {
  formatKnowledgeBankFileSize,
  removeKnowledgeBankStorageObject,
  uploadKnowledgeBankFile,
  validateKnowledgeBankUploadFile,
} from "@/lib/knowledge-bank-storage";
import { maxUploadSizeLabel, KNOWLEDGE_BANK_EXTENSIONS, resolveUploadContentType } from "@/lib/upload-limits";
import { toastError, toastSuccess } from "@/lib/toast-errors";
import {
  BookOpen,
  Download,
  FileText,
  Loader2,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { isAdminOrManager } from "@/lib/auth";
import {
  initialKnowledgeBankUiState,
  knowledgeBankUiReducer,
  type KnowledgeBankFile,
} from '@/views/knowledge-bank/knowledge-bank-ui-state';

interface ListResponse {
  ok: boolean;
  files?: KnowledgeBankFile[];
  error?: string;
}

async function fetchKnowledgeBankFiles(): Promise<KnowledgeBankFile[]> {
  const res = await fetch("/api/knowledge-bank");
  const data = (await res.json()) as ListResponse;
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "fetch_failed");
  }
  return data.files ?? [];
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
  const { user } = useApp();
  const queryClient = useQueryClient();

  useRealtimeKnowledgeBank({ user, queryClient });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [ui, dispatchUi] = useReducer(knowledgeBankUiReducer, initialKnowledgeBankUiState);
  const { q, title, description, selectedFile, uploading, deleteTarget, deleting, downloadingId } = ui;
  const setQ = (value: string) => dispatchUi({ type: 'patch', patch: { q: value } });
  const setTitle = (value: string) => dispatchUi({ type: 'patch', patch: { title: value } });
  const setDescription = (value: string) => dispatchUi({ type: 'patch', patch: { description: value } });
  const setSelectedFile = (value: File | null) => dispatchUi({ type: 'patch', patch: { selectedFile: value } });
  const setDeleteTarget = (value: KnowledgeBankFile | null) =>
    dispatchUi({ type: 'set_delete_target', file: value });

  const canDelete = isAdminOrManager(user?.role);

  const filesQuery = useQuery({
    queryKey: ["knowledge-bank"],
    queryFn: fetchKnowledgeBankFiles,
    staleTime: 30_000,
  });

  const filteredFiles = useMemo(() => {
    const files = filesQuery.data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return files;
    return files.filter(
      (file) =>
        file.title.toLowerCase().includes(query) ||
        file.fileName.toLowerCase().includes(query) ||
        (file.description?.toLowerCase().includes(query) ?? false) ||
        uploaderLabel(file).toLowerCase().includes(query),
    );
  }, [filesQuery.data, q]);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["knowledge-bank"] });
  }, [queryClient]);

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
      const res = await fetch(`/api/knowledge-bank/${deleteTarget.id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        toastError(data.error ?? "Delete failed.");
        return;
      }
      toastSuccess("Document removed from Knowledge Bank.");
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
    filesQuery,
    filteredFiles,
    q,
    setQ,
    handleDownload,
    downloadingId,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    deleting,
  };
  return <KnowledgeBankPageView {...viewProps} />;
}
