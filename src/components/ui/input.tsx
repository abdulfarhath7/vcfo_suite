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
        "box-border flex h-10 w-full overflow-hidden rounded-[10px] border border-input bg-panel px-3 py-2 text-base file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
}

export { Input };
