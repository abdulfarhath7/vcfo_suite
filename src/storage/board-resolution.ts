import 'server-only';

import {
  boardResolutionStoragePath,
  ENGAGEMENT_DOCUMENTS_BUCKET,
  signedBoardResolutionStoragePath,
} from '@/lib/board-resolution-storage';
import { EXTENSION_TO_MIME } from '@/lib/upload-limits';
import { bucketKey, getObjectBuffer, putObject } from '@/storage/s3';

/**
 * Board-resolution storage — SERVER ONLY byte I/O.
 *
 * Split out of src/lib/board-resolution-storage.ts so that client views and
 * the LIFTed upload-limits test can keep importing the validators and path
 * builders without dragging the S3 client into the browser bundle.
 */

function keyFor(storagePath: string): string {
  return bucketKey(ENGAGEMENT_DOCUMENTS_BUCKET, storagePath);
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  // Copy out of the pooled Buffer backing store — see downloadIncorpDocx.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Write the generated .docx. Overwrites in place — one draft per engagement. */
export async function uploadBoardResolutionDocx(
  appEngagementId: string,
  docx: Buffer,
): Promise<string> {
  const objectPath = boardResolutionStoragePath(appEngagementId);
  await putObject(keyFor(objectPath), docx, EXTENSION_TO_MIME.docx);
  return objectPath;
}

export async function downloadBoardResolutionDocx(
  storagePath: string,
): Promise<ArrayBuffer | null> {
  const trimmed = storagePath.trim();
  if (!trimmed) return null;
  try {
    const buf = await getObjectBuffer(keyFor(trimmed));
    if (!buf) {
      console.warn('[engagement-documents] download failed: not found');
      return null;
    }
    return toArrayBuffer(buf);
  } catch (error) {
    console.warn(
      '[engagement-documents] download failed',
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** Store the client's signed upload. Returns the stored object path. */
export async function putSignedBoardResolution(
  appEngagementId: string,
  bytes: Buffer,
  extension: string,
  contentType: string,
): Promise<string> {
  const objectPath = signedBoardResolutionStoragePath(appEngagementId, extension);
  await putObject(keyFor(objectPath), bytes, contentType);
  return objectPath;
}

export async function downloadSignedBoardResolution(
  storagePath: string,
): Promise<ArrayBuffer | null> {
  return downloadBoardResolutionDocx(storagePath);
}
