/**
 * Sign-in device words (C-787, C-851).
 *
 * The sign-in city from the edge's geo headers (C-851). Only a CDN in front of the app sets these:
 * CloudFront (`CloudFront-Viewer-City`, when the origin request policy forwards it), Vercel
 * (`X-Vercel-IP-City`, URL-encoded) or Cloudflare (`CF-IPCity`, with the location headers
 * transform on). App Runner alone sends none, so the answer is often null and the device row then
 * shows no city. The value is never guessed from the IP.
 */
const CITY_HEADERS = ['cloudfront-viewer-city', 'x-vercel-ip-city', 'cf-ipcity'] as const;

export function cityFromHeaders(headers: Headers | null | undefined): string | null {
  if (!headers) return null;
  for (const name of CITY_HEADERS) {
    const raw = headers.get(name)?.trim();
    if (!raw) continue;
    let v = raw;
    try {
      v = decodeURIComponent(raw);
    } catch {
      /* keep the raw value */
    }
    v = v.replace(/[^\p{L}\p{M}\s.'-]/gu, '').replace(/\s+/g, ' ').trim();
    if (v) return v.slice(0, 80);
  }
  return null;
}

/** "Chrome on Windows" from a user agent; the same words the Settings "This device" row uses. */
export function deviceLabel(ua: string | null | undefined): string {
  const s = ua ?? '';
  if (!s) return 'Unknown device';
  const b = /Edg\//.test(s) ? 'Edge' : /OPR\//.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const o = /Windows/.test(s) ? 'Windows' : /Android/.test(s) ? 'Android' : /iPhone|iPad|iPod/.test(s) ? 'iOS' : /Mac OS X/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : 'this device';
  return `${b} on ${o}`;
}
