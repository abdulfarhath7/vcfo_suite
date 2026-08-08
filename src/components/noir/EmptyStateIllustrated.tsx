import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AccentButton } from "./AccentButton";
import { Surface } from "./Surface";

interface EmptyStateIllustratedProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: LucideIcon;
  className?: string;
}

export function EmptyStateIllustrated({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon,
  className,
}: EmptyStateIllustratedProps) {
  return (
    <Surface
      className={cn(
        "flex flex-col items-center border-dashed border-primary/20 bg-primary-light/30 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border role-accent-border role-accent-bg">
        {Icon ? (
          <Icon className="h-7 w-7 text-brand" aria-hidden />
        ) : (
          <div className="h-8 w-8 rounded-md border role-accent-border opacity-60" />
        )}
      </div>
      <h3 className="serif text-xl text-foreground">{title}</h3>
      {description && (
        <p className="prose-narrow mt-2 text-sm text-muted-foreground">{description}</p>
      )}
      {actionLabel && onAction && (
        <AccentButton className="mt-5 min-h-11" onClick={onAction}>
          {actionLabel}
        </AccentButton>
      )}
    </Surface>
  );
}
