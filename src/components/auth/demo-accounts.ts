/**
 * The demo account buttons on the sign-in card (prototype `SignInScreen.tsx`, "Demo accounts").
 * They show only when `NEXT_PUBLIC_DEMO_LOGINS` is "on", which is for a local or LAN demo and
 * never for production. A button only fills the work email with a login that `npm run db:seed`
 * creates; the person still types the password. No password is ever shipped in the bundle.
 * The seed creates no developer login, so the prototype's sixth button is left out.
 */
export const DEMO_ACCOUNTS = [
  { label: 'Client', email: 'client@vcfo.local', title: 'Client portal', home: '/app/client/overview' },
  { label: 'Lead', email: 'intern@vcfo.local', title: 'Project lead', home: '/app/intern/today' },
  { label: 'Manager', email: 'manager@vcfo.local', title: 'Manager', home: '/app/manager/dashboard' },
  { label: 'Admin', email: 'admin@vcfo.local', title: 'Admin', home: '/app/admin/dashboard' },
  { label: 'Super admin', email: 'super@vcfo.local', title: 'Super admin', home: '/app/super/dashboard' },
] as const;

/**
 * The mono hint on the sign-in page and the portal chooser (P-454, P-470). It shows only in demo
 * mode, where the logins and the firms come from the demo seed, so the words are true.
 */
export const DEMO_HINT = 'Demo mode, sample data';

/** True only when the flag is exactly "on". Next inlines the value at build time. */
export function demoLoginsOn(flag: string | undefined = process.env.NEXT_PUBLIC_DEMO_LOGINS): boolean {
  return flag === 'on';
}
