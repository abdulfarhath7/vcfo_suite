import 'server-only';

import { downloadIncorpDocx } from '@/lib/incorporation-docs/storage';

/**
 * DIR-2 documents are stored exactly like any other incorporation draft, so
 * this is a thin alias kept for call-site clarity — same as the original,
 * minus the Supabase client argument.
 */
export async function downloadDir2Docx(storagePath: string): Promise<ArrayBuffer | null> {
  return downloadIncorpDocx(storagePath);
}
