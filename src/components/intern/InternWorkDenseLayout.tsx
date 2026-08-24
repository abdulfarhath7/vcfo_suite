import type { ReactNode } from 'react';

/** Presentational stack: title, optional subtitle, status + age, then CTA on its own row. */
export function InternWorkDenseLayout({
  leading,
  title,
  subtitle,
  status,
  age,
  action,
}: {
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  status: ReactNode;
  age?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="intern-work-dense">
      <div className="intern-work-dense-main">
        {leading}
        <div className="intern-work-dense-copy">
          <div className="intern-work-dense-title text-[12.5px] font-semibold leading-snug text-ink">{title}</div>
          {subtitle ? <div className="intern-work-dense-sub text-[11px] text-muted-foreground">{subtitle}</div> : null}
        </div>
      </div>
      <div className="intern-work-dense-meta">
        <div className="intern-work-dense-status">{status}</div>
        {age ? <div className="intern-work-dense-age">{age}</div> : null}
        {action ? <div className="intern-work-dense-cta">{action}</div> : null}
      </div>
    </div>
  );
}
