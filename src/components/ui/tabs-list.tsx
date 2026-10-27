import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function TabsList({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.List>> }) {
  return (
      <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex max-w-full items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-lg bg-surface-sunken p-0.5 text-ink-muted ring-1 ring-inset ring-line",
      className,
    )}
    {...props}
  />
  );
}

export { TabsList };
