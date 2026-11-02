import { NextResponse } from 'next/server';
import { signIn } from '@/auth/config';
import { devDirectEmails, devDirectPick, safeNextPath } from '@/auth/dev-direct';
import { listDevDirectAccounts } from '@/db/repositories/dev-direct-accounts';

/**
 * GET /dev-direct[?as=<email>][&next=/app/...] — LOCAL DIRECT SIGN-IN.
 *
 * Development only: signs in as an account listed in DEV_DIRECT_LOGIN_EMAIL and
 * lands on `next` (an /app path) or that role's home. With one listed account it
 * signs straight in; with several and no `as`, it shows an "Open as" page.
 * `as` is honoured only when it is on the list. In production, or with the
 * variable unset, this route is a plain 404. See src/auth/dev-direct.ts.
 */
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  manager: 'Manager',
  intern: 'Project lead',
  client: 'Client',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function GET(request: Request) {
  const list = devDirectEmails();
  if (!list.length) return new NextResponse('Not found', { status: 404 });
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'));
  const requested = url.searchParams.get('as');
  const email = devDirectPick(requested);

  if (email) {
    // signIn sets the session cookie and redirects (it throws Next's redirect signal).
    await signIn('dev-direct', { as: email, redirectTo: next ?? '/' });
    return new NextResponse(null, { status: 204 });
  }

  const accounts = await listDevDirectAccounts(list);
  const byEmail = new Map(accounts.map((a) => [a.email, a]));
  const rows = list
    .map((e) => {
      const a = byEmail.get(e);
      const label = a ? `${esc(a.name ?? e)} <small>${esc(ROLE_LABEL[a.role] ?? a.role)}${a.active ? '' : ' · inactive'}</small>` : `${esc(e)} <small>not in this database</small>`;
      const href = `/dev-direct?as=${encodeURIComponent(e)}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
      return a?.active ? `<a href="${esc(href)}">${label}<span>${esc(e)}</span></a>` : `<div class="off">${label}<span>${esc(e)}</span></div>`;
    })
    .join('');
  const note = requested ? `<p class="warn">${esc(requested)} is not on the local list.</p>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open as · localhost</title>
<style>
:root{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d1117;color:#e6edf3;font:15px/1.4 system-ui,sans-serif}
main{width:min(440px,calc(100vw - 32px))}h1{font-size:20px;margin:0 0 4px}p{margin:0 0 18px;color:#8b949e;font-size:13.5px}
a,.off{display:block;padding:12px 14px;margin:0 0 8px;border:1px solid #30363d;border-radius:12px;background:#161b22;color:inherit;text-decoration:none}
a:hover,a:focus-visible{border-color:#2dd4bf;outline:none}small{color:#2dd4bf;font-size:12px;margin-left:6px}span{display:block;color:#8b949e;font-size:12.5px;margin-top:2px}
.off{opacity:.55}.warn{color:#f0b84b}
</style></head><body><main><h1>Open as</h1><p>Localhost only. These are the accounts listed in .env.local; pick one to open its portal.</p>${note}${rows}</main></body></html>`;
  return new NextResponse(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
