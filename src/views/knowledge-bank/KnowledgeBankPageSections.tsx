"use client";

import { useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { m as motion } from 'framer-motion';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageTransition } from '@/components/shell/PageTransition';
import { PageHeader } from '@/components/admin/PageHeader';
import { SEO } from '@/components/SEO';
import { AccentButton, EmptyStateIllustrated, Mono, NoirCard, Surface } from '@/components/noir';
import { TONE_BADGE, type IconChipTone } from '@/components/common/IconChip';
import { formatKnowledgeBankFileSize } from '@/lib/knowledge-bank-storage';
import type {
  KnowledgeBankDeleteTarget,
  KnowledgeBankFile,
  KnowledgeBankFolder,
} from '@/views/knowledge-bank/knowledge-bank-ui-state';
import { maxUploadSizeLabel } from '@/lib/upload-limits';
import { cn } from '@/lib/utils';
import {
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  Folder,
  FolderPlus,
  Loader2,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function uploaderLabel(file: KnowledgeBankFile): string {
  if (file.uploaderName?.trim()) return file.uploaderName.trim();
  if (file.uploaderEmail?.trim()) return file.uploaderEmail.trim();
  return 'Unknown';
}

/** File-type → hue, so the library scans like a colorful folder view. */
function fileTone(fileName: string): { tone: IconChipTone; ext: string } {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return { tone: 'rose', ext };
  if (ext === 'doc' || ext === 'docx') return { tone: 'sky', ext };
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return { tone: 'emerald', ext };
  if (ext === 'pptx' || ext === 'ppt') return { tone: 'orange', ext };
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return { tone: 'violet', ext };
  if (ext === 'txt' || ext === 'md') return { tone: 'teal', ext };
  return { tone: 'neutral', ext };
}

function FolderCard({
  folder,
  index,
  canDelete,
  empty,
  onOpen,
  onDelete,
}: {
  folder: KnowledgeBankFolder;
  index: number;
  canDelete: boolean;
  empty: boolean;
  onOpen: (id: string) => void;
  onDelete: (folder: KnowledgeBankFolder) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index }}
      className="h-full"
    >
      <NoirCard className="flex h-full flex-col p-4 sm:p-5">
        <button
          type="button"
          onClick={() => onOpen(folder.id)}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary-light text-primary">
            <Folder className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-medium text-ink">{folder.name}</h3>
            <p className="mt-0.5 text-[11.5px] text-text-tertiary">Folder</p>
          </div>
        </button>
        {canDelete && empty ? (
          <div className="mt-auto flex items-center border-t border-border pt-3">
            <button
              type="button"
              onClick={() => onDelete(folder)}
              className={cn(
                'inline-flex h-9 min-h-9 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs',
                'text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive',
              )}
              aria-label={`Delete ${folder.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Delete</span>
            </button>
          </div>
        ) : null}
      </NoirCard>
    </motion.div>
  );
}

function DocumentCard({
  file,
  index,
  canDelete,
  downloadingId,
  showFolderPath,
  onDownload,
  onDelete,
}: {
  file: KnowledgeBankFile;
  index: number;
  canDelete: boolean;
  downloadingId: string | null;
  showFolderPath: boolean;
  onDownload: (file: KnowledgeBankFile) => void;
  onDelete: (file: KnowledgeBankFile) => void;
}) {
  const isDownloading = downloadingId === file.id;
  const { tone, ext } = fileTone(file.fileName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.03 * index }}
      className="h-full"
    >
      <NoirCard className="flex h-full flex-col p-4 sm:p-5">
        <div className="mb-3 flex items-start gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-md',
              TONE_BADGE[tone],
            )}
          >
            <FileText className="h-4 w-4" aria-hidden />
            {ext && <span className="mt-0.5 text-[7.5px] font-bold uppercase leading-none">{ext}</span>}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[13.5px] font-medium text-ink">{file.title}</h3>
            <p className="mt-0.5 truncate text-[11.5px] text-text-tertiary">{file.fileName}</p>
            {showFolderPath ? (
              <p className="mt-0.5 truncate text-[11px] text-primary/80">
                {file.folderPath || 'Knowledge Bank'}
              </p>
            ) : null}
          </div>
        </div>

        {file.description?.trim() ? (
          <p className="mb-3 line-clamp-2 flex-1 text-[12px] leading-relaxed text-ink-soft">
            {file.description}
          </p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mb-4 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-tertiary">
          <Mono>{formatKnowledgeBankFileSize(file.sizeBytes)}</Mono>
          <span aria-hidden>·</span>
          <Mono>{formatDate(file.createdAt)}</Mono>
          <span aria-hidden>·</span>
          <span className="truncate">{uploaderLabel(file)}</span>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
          <AccentButton
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9 flex-1"
            disabled={isDownloading}
            onClick={() => onDownload(file)}
          >
            {isDownloading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            Download
          </AccentButton>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(file)}
              className={cn(
                'inline-flex h-9 min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-xs',
                'text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive',
              )}
              aria-label={`Delete ${file.title}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Delete</span>
            </button>
          )}
        </div>
      </NoirCard>
    </motion.div>
  );
}

interface KnowledgeBankPageViewProps {
  basePath: string;
  canDelete: boolean;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  selectedFile: File | null;
  setSelectedFile: (value: File | null) => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  uploading: boolean;
  handleUpload: (e: FormEvent) => Promise<void>;
  folderName: string;
  setFolderName: (value: string) => void;
  creatingFolder: boolean;
  handleCreateFolder: (e: FormEvent) => Promise<void>;
  libraryQuery: UseQueryResult<{ files: KnowledgeBankFile[]; folders: KnowledgeBankFolder[] }, Error>;
  filteredFiles: KnowledgeBankFile[];
  filteredFolders: KnowledgeBankFolder[];
  q: string;
  setQ: (value: string) => void;
  searching: boolean;
  currentFolderId: string | null;
  ancestors: KnowledgeBankFolder[];
  openFolder: (folderId: string | null) => void;
  folderIsEmpty: (folderId: string) => boolean;
  handleDownload: (file: KnowledgeBankFile) => Promise<void>;
  downloadingId: string | null;
  deleteTarget: KnowledgeBankDeleteTarget | null;
  setDeleteTarget: (value: KnowledgeBankDeleteTarget | null) => void;
  confirmDelete: () => Promise<void>;
  deleting: boolean;
}

export function KnowledgeBankPageView(props: KnowledgeBankPageViewProps) {
  const {
    basePath, canDelete, title, setTitle, description, setDescription,
    selectedFile, setSelectedFile, fileInputRef, uploading, handleUpload,
    folderName, setFolderName, creatingFolder, handleCreateFolder,
    libraryQuery, filteredFiles, filteredFolders, q, setQ, searching,
    currentFolderId, ancestors, openFolder, folderIsEmpty, handleDownload,
    downloadingId, deleteTarget, setDeleteTarget, confirmDelete, deleting,
  } = props;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderOpen, setFolderOpen] = useState(false);
  const wasUploadingRef = useRef(false);
  const wasCreatingRef = useRef(false);

  useEffect(() => {
    if (wasUploadingRef.current && !uploading && !title && !selectedFile) {
      setUploadOpen(false);
    }
    wasUploadingRef.current = uploading;
  }, [uploading, title, selectedFile]);

  useEffect(() => {
    if (wasCreatingRef.current && !creatingFolder && !folderName) {
      setFolderOpen(false);
    }
    wasCreatingRef.current = creatingFolder;
  }, [creatingFolder, folderName]);

  function closeUploadDialog() {
    if (uploading) return;
    setUploadOpen(false);
    setTitle('');
    setDescription('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function closeFolderDialog() {
    if (creatingFolder) return;
    setFolderOpen(false);
    setFolderName('');
  }

  const currentName = ancestors.at(-1)?.name;
  const empty = filteredFolders.length === 0 && filteredFiles.length === 0;
  const itemCount = filteredFolders.length + filteredFiles.length;

  return (
    <PageTransition>
      <SEO
        title="Knowledge Bank — VCFO Suite"
        description="Shared reference library for managers and project leads."
        path={basePath}
      />

      <PageHeader
        accent="sky"
        icon={BookOpen}
        title="Knowledge Bank"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setFolderOpen(true)}
            >
              <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
              New folder
            </Button>
            <AccentButton size="sm" className="min-h-11" onClick={() => setUploadOpen(true)}>
              <Upload className="mr-1.5 h-3.5 w-3.5" />
              Upload document
            </AccentButton>
          </div>
        }
      />

      <Surface className="mb-4 overflow-hidden">
        <nav
          aria-label="Folder path"
          className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-2.5 text-[13px]"
        >
          <button
            type="button"
            onClick={() => openFolder(null)}
            className={cn(
              'rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-light',
              !currentFolderId && 'font-medium text-ink',
            )}
          >
            Knowledge Bank
          </button>
          {ancestors.map((folder, index) => (
            <span key={folder.id} className="inline-flex min-w-0 items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
              <button
                type="button"
                onClick={() => openFolder(folder.id)}
                className={cn(
                  'max-w-[12rem] truncate rounded-md px-1.5 py-0.5 text-primary hover:bg-primary-light',
                  index === ancestors.length - 1 && 'font-medium text-ink',
                )}
                aria-current={index === ancestors.length - 1 ? 'page' : undefined}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
        <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-role" aria-hidden />
            <p className="text-[11px] uppercase tracking-[0.14em] text-text-tertiary">
              <span className="tabular-nums text-ink">
                {libraryQuery.isLoading ? '…' : itemCount}
              </span>
              <span className="ml-1.5">{searching ? 'matches' : 'items'}</span>
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files by name…"
              aria-label="Search files by name"
              className="h-9 pl-8"
            />
          </div>
        </div>
      </Surface>

      {libraryQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <NoirCard key={i} className="h-[220px] animate-pulse p-5">
              <div className="mb-3 flex gap-3">
                <div className="h-10 w-10 rounded-md bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded bg-muted" />
                <div className="h-3 w-2/3 rounded bg-muted" />
              </div>
            </NoirCard>
          ))}
        </div>
      ) : libraryQuery.isError ? (
        <EmptyStateIllustrated icon={BookOpen} title="Could not load Knowledge Bank" />
      ) : empty ? (
        <EmptyStateIllustrated
          icon={searching ? FileText : Folder}
          title={searching ? 'No documents match your search' : currentFolderId ? 'This folder is empty' : 'No documents yet'}
          actionLabel={searching ? undefined : 'Upload document'}
          onAction={searching ? undefined : () => setUploadOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFolders.map((folder, index) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              index={index}
              canDelete={canDelete}
              empty={folderIsEmpty(folder.id)}
              onOpen={openFolder}
              onDelete={(value) => setDeleteTarget({ kind: 'folder', folder: value })}
            />
          ))}
          {filteredFiles.map((file, index) => (
            <DocumentCard
              key={file.id}
              file={file}
              index={filteredFolders.length + index}
              canDelete={canDelete}
              downloadingId={downloadingId}
              showFolderPath={searching}
              onDownload={handleDownload}
              onDelete={(value) => setDeleteTarget({ kind: 'file', file: value })}
            />
          ))}
        </div>
      )}

      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          if (open) setUploadOpen(true);
          else closeUploadDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
            <DialogDescription>
              {currentName ? `Into ${currentName}` : 'Into Knowledge Bank'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleUpload(e);
            }}
            className="space-y-4 py-1"
          >
            <div className="space-y-2">
              <Label htmlFor="kb-title">Title</Label>
              <Input
                id="kb-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Board resolution checklist"
                maxLength={200}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-description">Description (optional)</Label>
              <Textarea
                id="kb-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When to use this document…"
                rows={3}
                maxLength={2000}
                disabled={uploading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-file">File</Label>
              <Input
                id="kb-file"
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xlsx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
                disabled={uploading}
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-[11px] text-text-tertiary">
                PDF, Office, text, or image · max {maxUploadSizeLabel()}
              </p>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" disabled={uploading} onClick={closeUploadDialog}>
                Cancel
              </Button>
              <AccentButton type="submit" disabled={uploading}>
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {uploading ? 'Uploading…' : 'Upload to library'}
              </AccentButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={folderOpen}
        onOpenChange={(open) => {
          if (open) setFolderOpen(true);
          else closeFolderDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              {currentName ? `Inside ${currentName}` : 'In Knowledge Bank'}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              void handleCreateFolder(e);
            }}
            className="space-y-4 py-1"
          >
            <div className="space-y-2">
              <Label htmlFor="kb-folder-name">Name</Label>
              <Input
                id="kb-folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="e.g. GST"
                maxLength={80}
                disabled={creatingFolder}
                // eslint-disable-next-line jsx-a11y/no-autofocus -- deliberate: focuses the first field when this form opens
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" disabled={creatingFolder} onClick={closeFolderDialog}>
                Cancel
              </Button>
              <AccentButton type="submit" disabled={creatingFolder || !folderName.trim()}>
                {creatingFolder ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FolderPlus className="h-4 w-4" />
                )}
                {creatingFolder ? 'Creating…' : 'Create folder'}
              </AccentButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.kind === 'folder' ? 'Delete this folder?' : 'Delete this document?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === 'folder'
                ? `"${deleteTarget.folder.name}" will be removed. Only empty folders can be deleted.`
                : deleteTarget?.kind === 'file'
                  ? `"${deleteTarget.file.title}" will be permanently removed from the Knowledge Bank. This cannot be undone.`
                  : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageTransition>
  );
}
