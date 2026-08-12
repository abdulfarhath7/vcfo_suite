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
        "box-border flex h-10 w-full overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-orange-500/80 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-orange-500/25 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Input };
