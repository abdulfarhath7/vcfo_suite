import 'server-only';
import { after } from 'next/server';
import type { AuthContext } from '@/auth/guards';
import { createNotificationsForUsers } from '@/db/repositories/notifications';
import { recordExport, type ExportKind } from '@/lib/exports/record-export';

/**
 * GL-06 / PR-02: make a file after the response, so the screen stays usable, keep it under
 * `exports/` for 30 days, and tell the person in the bell with a link that downloads it. The
 * notice body starts with the file name, so a page that started the export can also show a
 * toast when it arrives (`useExportReadyToast`). App Runner has no Inngest keys, so `after` runs the job, as the
 * outbound email does (`src/lib/email/send-after-response.ts`).
 */
export function exportInBackground(
  ctx: AuthContext,
  input: {
    kind: ExportKind;
    format: 'zip' | 'xlsx';
    fileName: string;
    /** What the file is, for the notice: "the project ZIP", "the Excel file". */
    label: string;
    engagementId?: string;
    companyName?: string;
    maxCopyBytes?: number;
    build: () => Promise<Uint8Array>;
  },
): void {
  after(async () => {
    const base = { userId: ctx.userId, engagementId: input.engagementId ?? '', companyName: input.companyName ?? '' };
    try {
      const body = await input.build();
      const id = await recordExport(ctx, { kind: input.kind, format: input.format, fileName: input.fileName, body, maxCopyBytes: input.maxCopyBytes });
      if (!id) throw new Error('export_not_kept');
      await createNotificationsForUsers([
        { ...base, kind: 'docs.share', title: `${capitalise(input.label)} is ready`, body: `${input.fileName} is ready to download.`, href: `/api/exports/${id}` },
      ]);
    } catch (err) {
      console.error('[exports] background export failed', err);
      await createNotificationsForUsers([
        { ...base, kind: 'docs.share', title: `${capitalise(input.label)} did not finish`, body: `${input.fileName} did not finish. Try again in a few minutes. If it fails again, tell your admin.`, href: '#' },
      ]).catch(() => []);
    }
  });
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
