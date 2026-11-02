import { MarketingFooter } from './MarketingFooter';
import { MarketingNav } from './MarketingNav';

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-lockup-theme min-h-screen bg-surface text-ink" data-role="admin">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}
