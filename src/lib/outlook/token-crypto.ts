/**
 * Outlook tokens are sealed by the shared integrations helper (src/lib/integrations/token-crypto.ts),
 * so a blob written before the move still opens: the format and key derivation are the same.
 */
export { decryptSecret, encryptSecret } from '@/lib/integrations/token-crypto';
