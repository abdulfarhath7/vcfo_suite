import { siteUrl } from '@/lib/site-url';

/**
 * FalconeBiz asks for a `Domain` header beside the key: the domain the call is made from,
 * which is how they tie a key to a licence. It is not a website the firm has to build, and
 * there is nothing to buy for it — the Suite already runs on one.
 *
 * So the value is taken from `FALCON_API_DOMAIN` when it is set, and otherwise from the host
 * the Suite serves itself on (`SITE_URL`, which is `app.sbctrack.in` in production). Setting
 * the variable is only needed when FalconeBiz has a different domain on file than the one the
 * app runs on.
 */
export function falconDomain(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.FALCON_API_DOMAIN?.trim();
  if (explicit) {
    // Tolerate a pasted URL: they want "sbctrack.in", not "https://sbctrack.in/".
    return explicit.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').trim();
  }
  try {
    return new URL(siteUrl()).hostname;
  } catch {
    return '';
  }
}
