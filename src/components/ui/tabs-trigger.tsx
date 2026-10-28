import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function TabsTrigger({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>> }) {
  return (
      <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex h-7 shrink-0 items-center justify-center whitespace-nowrap rounded-mark px-3 text-[13px] font-medium text-ink-2 ring-offset-background transition-colors hover:text-ink data-[state=active]:bg-brand data-[state=active]:text-on-brand data-[state=active]:shadow-shine focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
      className,
    )}
    {...props}
  />
  );
}

export { TabsTrigger };
