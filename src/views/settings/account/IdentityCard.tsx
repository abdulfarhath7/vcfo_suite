import { useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { PageBackButton } from '@/components/shell/PageBackButton';
import { Button } from '@/components/ui/button';
import { UserFace } from '@/components/common/UserFace';
import { compressImageFile } from '@/lib/shell/shell-appearance';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

async function jpegFileFromDataUrl(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

export function IdentityCard({
  name,
  email,
  roleLabel,
  initials,
  avatarUrl,
  loading,
  isStaff,
  outlookConnected,
  onAvatarUrl,
  onAvatarSaved,
}: {
  name: string;
  email: string;
  roleLabel: string;
  initials: string;
  avatarUrl: string | null;
  loading: boolean;
  isStaff: boolean;
  outlookConnected: boolean;
  onAvatarUrl: (url: string | null) => void;
  onAvatarSaved: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'upload' | 'outlook' | 'remove' | null>(null);

  const src = previewUrl || avatarUrl;
  const hasPhoto = Boolean(src);

  async function persistFile(file: File, preview: string | null) {
    if (preview) setPreviewUrl(preview);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/account/avatar', { method: 'POST', body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const code = typeof body.error === 'string' ? body.error : '';
      if (code === 'file_too_large') throw new Error('That image is too large. Try a smaller photo.');
      if (code === 'unsupported_type') throw new Error('Use a JPEG, PNG, WebP, or GIF.');
      throw new Error(errorMessage(body.error, 'Could not save photo.'));
    }
    onAvatarUrl((body.avatarUrl as string | null) ?? null);
    setPreviewUrl(null);
    await onAvatarSaved();
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    setBusy('upload');
    try {
      const dataUrl = await compressImageFile(file, 512, 0.82);
      const jpeg = await jpegFileFromDataUrl(dataUrl);
      await persistFile(jpeg, dataUrl);
      toastSuccess('Photo updated');
    } catch (err) {
      setPreviewUrl(null);
      toastError('Could not update photo', errorMessage(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function applyOutlookPhoto() {
    setBusy('outlook');
    try {
      const res = await fetch('/api/account/avatar/outlook', { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const code = typeof body.error === 'string' ? body.error : '';
        if (code === 'outlook_not_connected') throw new Error('Connect Outlook below, then try again.');
        if (code === 'outlook_photo_missing') throw new Error('No photo on this Microsoft account.');
        throw new Error(errorMessage(body.error, 'Could not fetch Outlook photo.'));
      }
      onAvatarUrl((body.avatarUrl as string | null) ?? null);
      setPreviewUrl(null);
      await onAvatarSaved();
      toastSuccess('Outlook photo added');
    } catch (err) {
      toastError('Could not use Outlook photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function removePhoto() {
    setBusy('remove');
    try {
      const res = await fetch('/api/account/avatar', { method: 'DELETE' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(errorMessage(body.error, 'Could not remove photo.'));
      onAvatarUrl(null);
      setPreviewUrl(null);
      await onAvatarSaved();
      toastSuccess('Photo removed');
    } catch (err) {
      toastError('Could not remove photo', errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface-raised px-5 py-5">
      <div className="flex items-center gap-4 sm:gap-5">
        <UserFace
          src={src}
          initials={loading ? '' : initials}
          alt=""
          className="h-[4.5rem] w-[4.5rem] bg-brand-soft text-[1.05rem] font-semibold tracking-tight text-brand ring-1 ring-brand/20 sm:h-20 sm:w-20 sm:text-[1.15rem]"
        />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <PageBackButton className="-ml-1.5" />
            <h1 className="truncate font-serif text-[1.5rem] leading-none tracking-tight text-ink sm:text-[1.75rem]">
              {name}
            </h1>
          </div>
          <p className="mt-2 truncate font-mono text-[13px] text-ink-muted">{email}</p>
          <span className="mt-3 inline-flex rounded-md bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
            {roleLabel}
          </span>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="sr-only"
        onChange={(e) => void onPickFile(e.target.files?.[0])}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          disabled={loading || busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === 'upload' ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-3.5 w-3.5" aria-hidden />
          )}
          Upload
        </Button>
        {isStaff ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading || busy !== null || !outlookConnected}
            title={
              outlookConnected ? undefined : 'Connect Outlook below to use your Microsoft photo'
            }
            onClick={() => void applyOutlookPhoto()}
          >
            {busy === 'outlook' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : null}
            Use Outlook photo
          </Button>
        ) : null}
        {hasPhoto ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-ink-muted hover:text-ink"
            disabled={loading || busy !== null}
            onClick={() => void removePhoto()}
          >
            {busy === 'remove' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            )}
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
