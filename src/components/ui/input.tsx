import * as React from "react";

import { cn } from "@/lib/utils";

function Input({
  ref,
  className,
  type,
  ...props
}: React.ComponentProps<"input"> & { ref?: React.Ref<HTMLInputElement> }) {
  return (
    <input
      type={type}
      className={cn(
        "box-border flex h-10 w-full overflow-hidden rounded-md border border-input bg-surface-raised px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-focus-ring/40 disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Input };
