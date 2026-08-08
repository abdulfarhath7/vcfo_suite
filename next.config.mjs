import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pin Turbopack root to this repo (avoids wrong root when a parent lockfile exists). */
const projectRoot = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));

/**
 * Allow LAN devices to load `/_next/*` during `next dev`.
 * Without this, phones/tablets hitting http://192.168.x.x:3000 get HTML but
 * blocked JS chunks — login fields never hydrate, toggles do nothing.
 *
 * Extra hosts: ALLOWED_DEV_ORIGINS=192.168.1.50,10.0.0.5 (comma-separated).
 */
function lanAllowedDevOrigins() {
  const privateLan = [
    '127.0.0.1',
    '127.0.0.1:3000',
    'localhost',
    'localhost:3000',
    '192.168.*.*',
    '10.*.*.*',
    '172.16.*.*',
    '172.17.*.*',
    '172.18.*.*',
    '172.19.*.*',
    '172.20.*.*',
    '172.21.*.*',
    '172.22.*.*',
    '172.23.*.*',
    '172.24.*.*',
    '172.25.*.*',
    '172.26.*.*',
    '172.27.*.*',
    '172.28.*.*',
    '172.29.*.*',
    '172.30.*.*',
    '172.31.*.*',
  ];
  const fromEnv = (process.env.ALLOWED_DEV_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .flatMap((entry) => {
      try {
        if (entry.includes('://')) {
          const u = new URL(entry);
          return [u.host, u.hostname];
        }
      } catch {
        /* plain host */
      }
      return [entry];
    });
  return [...new Set([...privateLan, ...fromEnv])];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev-only; ignored by `next start`. Required for office-WiFi / phone testing.
  allowedDevOrigins: lanAllowedDevOrigins(),
  turbopack: {
    root: projectRoot,
  },
  // fs.readFileSync(process.cwd(), 'public/templates/...') is not auto-traced on Vercel.
  outputFileTracingIncludes: {
    '/api/engagements/[id]/board-resolution/generate': [
      './public/templates/boardResolution.docx',
      './public/templates/board-resolution-template.docx',
    ],
    '/api/engagements/[id]/board-resolution/status': [
      './public/templates/boardResolution.docx',
    ],
    '/api/engagements/[id]/incorporation-docs/generate': [
      './public/templates/dir-2.docx',
      './public/templates/dir-8.docx',
      './public/templates/inc-9.docx',
      './public/templates/pan-undertaking.docx',
    ],
    '/api/engagements/[id]/dir-2/generate': ['./public/templates/dir-2.docx'],
  },
};

export default nextConfig;
