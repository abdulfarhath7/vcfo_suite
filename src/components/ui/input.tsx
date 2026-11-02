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
        "box-border flex h-10 w-full overflow-hidden rounded-md border-1.5 border-line-strong bg-surface-raised px-3 py-2 text-[14px] file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:border-brand focus-visible:ring-4 focus-visible:ring-focus-ring/25 aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Input };
