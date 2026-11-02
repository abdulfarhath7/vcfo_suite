import DocumentVaultPage from '@/views/vault/DocumentVaultPage';

/**
 * Super admin documents (prototype /super/documents): the same Vault as the firm staff, scoped
 * firm-wide by the vault repositories. It renders from the layout so `vault/view/<id>` opens the
 * document viewer over the explorer.
 */
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocumentVaultPage />
      {children}
    </>
  );
}
