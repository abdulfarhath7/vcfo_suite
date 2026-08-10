import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Object storage. Replaces Supabase Storage.
 *
 * The magic here: this SAME code talks to MinIO on your laptop and to real
 * S3 on AWS. The only difference is env vars:
 *
 *   LOCAL (MinIO):  S3_ENDPOINT=http://localhost:9000, S3_FORCE_PATH_STYLE=true
 *   AWS (S3):       no S3_ENDPOINT, S3_REGION=ap-south-1, IAM role or keys
 *
 * That is dev/prod parity: you test the real storage path locally and change
 * nothing but configuration when you deploy.
 *
 * SECURITY: objects are private. Clients get short-lived signed URLs, scoped
 * per request. Never make the bucket public. On AWS, enable "block all public
 * access" and encrypt with KMS (see infra/storage.tf).
 */
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === 'true';

export const s3 = new S3Client({
  region: process.env.S3_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT || undefined, // undefined => real AWS S3
  forcePathStyle,
  credentials:
    process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        }
      : undefined, // undefined => use the App Runner IAM role on AWS
});

const BUCKET = process.env.S3_BUCKET || 'vcfo-documents';

export async function putObject(
  key: string,
  body: Buffer | Uint8Array | string,
  contentType?: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/**
 * Fetch an object's bytes. Returns null when the object is missing rather than
 * throwing — several callers (docx regeneration, previews) treat "not there"
 * as a normal branch and repair it.
 */
export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === 'NoSuchKey' || name === 'NotFound') return null;
    throw error;
  }
}

/** Short-lived download URL (default 5 minutes). */
export async function signedDownloadUrl(
  key: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Short-lived upload URL for direct browser->storage uploads. */
export async function signedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * The original had one Supabase Storage BUCKET per document family
 * ('milestone-documents', 'knowledge-bank', 'engagement-documents'). On S3 we
 * use ONE bucket and turn each of those into a key PREFIX.
 *
 * Object *paths* stored in the database (checklist_state responses,
 * knowledge_bank_files.storage_path, …) stay byte-identical to the originals —
 * the prefix is applied only when we actually talk to S3. That keeps every
 * LIFTed path parser (isMilestoneStoragePath, fileNameFromStoragePath, …)
 * correct and means stored data is portable between the two backends.
 */
export type StorageBucket =
  | 'milestone-documents'
  | 'knowledge-bank'
  | 'engagement-documents';

export function bucketKey(bucket: StorageBucket, storagePath: string): string {
  const clean = storagePath.replace(/^\/+/, '');
  return `${bucket}/${clean}`;
}

/**
 * Build a tenant-scoped object key. ALWAYS namespace by engagement so a bug
 * can't cross tenants and lifecycle rules can target per-engagement prefixes.
 */
export function engagementObjectKey(
  engagementId: string,
  category: string,
  fileName: string,
): string {
  const safe = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `engagements/${engagementId}/${category}/${Date.now()}-${safe}`;
}
