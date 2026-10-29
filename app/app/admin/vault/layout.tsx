import DocumentVaultPage from '@/views/vault/DocumentVaultPage';

/**
 * The Vault renders from the layout, so `vault/view/<id>` opens the document viewer over the
 * same explorer without loading it again (prototype DocViewerScreen). The pages render nothing.
 */
export default function VaultLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DocumentVaultPage />
      {children}
    </>
  );
}
