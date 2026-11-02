/**
 * The console's stylesheets, in cascade order: the prototype's base sheets
 * (shared with the client portal, already scoped under `.cpx`), then the
 * console sheet (manager / admin / super admin / developer + Graphite), then
 * the bridge. Regenerate with `node scripts/portal-css.mjs`.
 */
import '@/components/portal/css/00-head.css';
import '@/components/portal/css/10-v4.css';
import '@/components/portal/css/20-account.css';
import '@/components/portal/css/90-bridge.css';
import './css/30-console.css';
import './css/91-console-bridge.css';
