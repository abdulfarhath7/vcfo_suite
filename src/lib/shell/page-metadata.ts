import type { Metadata } from 'next';

const SITE = 'VCFO Suite';

/** Consistent metadata for authenticated app routes. */
export function pageMetadata(title: string, description?: string): Metadata {
  const fullTitle = `${title} | ${SITE}`;
  return {
    title: fullTitle,
    description: description ?? `${title} — ${SITE} compliance cockpit`,
    openGraph: {
      title: fullTitle,
      description: description ?? `${title} — ${SITE} compliance cockpit`,
    },
  };
}
