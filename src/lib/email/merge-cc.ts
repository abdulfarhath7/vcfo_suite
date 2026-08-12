/** Comma-separated default CC for progress-related client emails (server-only). */
function progressCcEnvRaw(): string {
  return (
    process.env.EMAIL_PROGRESS_CC?.trim() ||
    process.env.RESEND_PROGRESS_CC?.trim() ||
    process.env.RESEND_DEFAULT_CC?.trim() ||
    ''
  );
}

function parseCommaSeparatedEmails(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value.split(',').flatMap((part) => {
    const trimmed = part.trim().toLowerCase();
    return trimmed ? [trimmed] : [];
  });
}

/** Default CC from environment (deduped, lowercased). */
export function getDefaultProgressCcFromEnv(): string[] {
  return [...new Set(parseCommaSeparatedEmails(progressCcEnvRaw()))];
}

export function hasDefaultProgressCcConfigured(): boolean {
  return getDefaultProgressCcFromEnv().length > 0;
}

/**
 * Merge env default CC with engagement-specific CCs (deduped, lowercased).
 * Excludes the primary `to` address when provided.
 */
export function getProgressCcRecipients(
  engagementCc: string[] | null | undefined,
  options?: { excludeTo?: string },
): string[] {
  const exclude = options?.excludeTo?.trim().toLowerCase();
  const merged = [
    ...getDefaultProgressCcFromEnv(),
    ...(engagementCc ?? []).flatMap((e) => {
      const trimmed = e.trim().toLowerCase();
      return trimmed ? [trimmed] : [];
    }),
  ];
  const deduped = [...new Set(merged)];
  if (!exclude) return deduped;
  return deduped.filter((e) => e !== exclude);
}
