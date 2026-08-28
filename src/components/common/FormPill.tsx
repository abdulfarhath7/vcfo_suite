export function FormPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md bg-raised px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
