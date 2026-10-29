/**
 * The demo account buttons on the sign-in card (prototype `SignInScreen.tsx`, "Demo accounts").
 * They show only when `NEXT_PUBLIC_DEMO_LOGINS` is "on", which is for a local or LAN demo and
 * never for production. A button only fills the work email with a login that `npm run db:seed`
 * creates; the person still types the password. No password is ever shipped in the bundle.
 * The seed creates no developer login, so the prototype's sixth button is left out.
 */
export const DEMO_ACCOUNTS = [
  { label: 'Client', email: 'client@vcfo.local' },
  { label: 'Lead', email: 'intern@vcfo.local' },
  { label: 'Manager', email: 'manager@vcfo.local' },
  { label: 'Admin', email: 'admin@vcfo.local' },
  { label: 'Super admin', email: 'super@vcfo.local' },
] as const;

/** True only when the flag is exactly "on". Next inlines the value at build time. */
export function demoLoginsOn(flag: string | undefined = process.env.NEXT_PUBLIC_DEMO_LOGINS): boolean {
  return flag === 'on';
}
