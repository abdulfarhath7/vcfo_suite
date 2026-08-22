/** Own-avatar object key + public src. Bytes live in S3; the client only sees `/api/account/avatar`. */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export const AVATAR_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

export function profileAvatarObjectKey(userId: string): string {
  const id = userId.replace(/[^a-zA-Z0-9-]/g, '');
  return `avatars/${id}/photo`;
}

export function ownAvatarSrc(version?: number | string | Date | null): string {
  const raw = version instanceof Date ? version.getTime() : version;
  const q = raw != null && String(raw) !== '' ? `?v=${encodeURIComponent(String(raw))}` : '';
  return `/api/account/avatar${q}`;
}

/** Content-Type from magic bytes. Returns null when the payload is not a raster image. */
export function sniffImageContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}
