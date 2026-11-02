import { useRef, useState } from 'react';
import { Loader2, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UserFace } from '@/components/common/UserFace';
import { compressImageFile } from '@/lib/shell/shell-appearance';
import { toastError, toastSuccess, errorMessage } from '@/lib/toast-errors';

async function jpegFileFromDataUrl(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
}

/** The photo row of Profile › About you: the face, upload, the Outlook photo (staff) and remove. */
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
        if (code === 'outlook_not_connected') throw new Error('Connect Outlook in Email, then try again.');
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
    <div className="flex flex-wrap items-center gap-3">
      <UserFace
        src={src}
        initials={loading ? '' : initials}
        alt={name ? `${name}, ${roleLabel}` : ''}
        className="h-16 w-16 flex-none bg-surface-sunken text-[22px] font-medium text-ink"
      />
      <span className="sr-only">{email}</span>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        className="sr-only"
        aria-label="Photo file"
        onChange={(e) => void onPickFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={loading || busy !== null}
          onClick={() => fileRef.current?.click()}
        >
          {busy === 'upload' ? (
            <Loader2 className="animate-spin" aria-hidden />
          ) : (
            <Upload aria-hidden />
          )}
          Upload photo
        </Button>
        {isStaff ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={loading || busy !== null || !outlookConnected}
            title={outlookConnected ? undefined : 'Connect Outlook in Email to use your Microsoft photo'}
            onClick={() => void applyOutlookPhoto()}
          >
            {busy === 'outlook' ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Use Outlook photo
          </Button>
        ) : null}
        {hasPhoto ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            className="text-danger"
            disabled={loading || busy !== null}
            onClick={() => void removePhoto()}
          >
            {busy === 'remove' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <Trash2 aria-hidden />
            )}
            Remove
          </Button>
        ) : null}
      </div>
    </div>
  );
}
