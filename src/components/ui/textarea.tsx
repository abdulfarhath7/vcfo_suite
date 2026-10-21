import * as React from "react";

import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function Textarea({ ref, className, ...props }: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(
        "box-border flex min-h-[80px] w-full overflow-hidden rounded-md border border-input bg-surface-raised px-3 py-2 text-sm placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Textarea };
