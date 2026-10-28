import * as React from "react";

import { cn } from "@/lib/utils";

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

function Textarea({ ref, className, ...props }: TextareaProps & { ref?: React.Ref<HTMLTextAreaElement> }) {
  return (
    <textarea
      className={cn(
        "box-border flex min-h-[80px] w-full overflow-hidden rounded-md border-1.5 border-line-strong bg-surface-raised px-3 py-2 text-[14px] placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Textarea };
