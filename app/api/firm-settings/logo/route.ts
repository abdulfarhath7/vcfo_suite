import { NextResponse } from 'next/server';
import { requireAdmin, requireAnyRole } from '@/auth/guards';
import {
  FirmSettingsForbiddenError,
  getFirmLogoKey,
  setFirmLogoKey,
} from '@/db/repositories/firm-settings';
import { AVATAR_EXTENSIONS, MAX_AVATAR_BYTES, sniffImageContentType } from '@/lib/account-avatar';
import { resolveUploadExtension } from '@/lib/upload-limits';
import { deleteObject, getObjectBuffer, putObject } from '@/storage/s3';

/** One object per upload, so a cached copy of the old logo never shows the new one. */
function logoObjectKey(): string {
  return `firm/logo-${Date.now()}`;
}

function forbidden(err: unknown) {
  return err instanceof FirmSettingsForbiddenError
    ? NextResponse.json({ error: err.message }, { status: 403 })
    : null;
}

/** GET /api/firm-settings/logo — stream the firm logo to any staff role; 404 when none. */
export async function GET() {
  const guard = await requireAnyRole('admin', 'manager', 'intern');
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const key = await getFirmLogoKey(guard.ctx);
    if (!key) return new NextResponse(null, { status: 404 });
    const bytes = await getObjectBuffer(key);
    if (!bytes) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': sniffImageContentType(bytes) ?? 'image/png',
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    return forbidden(err) ?? NextResponse.json({ error: 'logo_failed' }, { status: 500 });
  }
}

/** POST /api/firm-settings/logo — multipart `file` (PNG, JPEG, WebP or GIF, 2 MB); replaces the logo. */
export async function POST(request: Request) {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  if (!resolveUploadExtension(file, AVATAR_EXTENSIONS)) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > MAX_AVATAR_BYTES) {
    return NextResponse.json({ error: 'file_too_large' }, { status: 400 });
  }
  const contentType = sniffImageContentType(bytes);
  if (!contentType) {
    return NextResponse.json({ error: 'unsupported_type' }, { status: 400 });
  }

  try {
    const key = logoObjectKey();
    await putObject(key, bytes, contentType);
    const { previousKey } = await setFirmLogoKey(guard.ctx, key);
    if (previousKey && previousKey !== key) await deleteObject(previousKey).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return forbidden(err) ?? NextResponse.json({ error: 'upload_failed' }, { status: 500 });
  }
}

/** DELETE /api/firm-settings/logo — admin and super admin remove the logo. */
export async function DELETE() {
  const guard = await requireAdmin();
  if (guard.ok === false) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }
  try {
    const { previousKey } = await setFirmLogoKey(guard.ctx, null);
    if (previousKey) await deleteObject(previousKey).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return forbidden(err) ?? NextResponse.json({ error: 'remove_failed' }, { status: 500 });
  }
}
