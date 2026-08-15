import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

function TabsTrigger({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & { ref?: React.Ref<React.ElementRef<typeof TabsPrimitive.Trigger>> }) {
  return (
      <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-[10px] px-3 py-1.5 text-sm font-medium ring-offset-background transition-all data-[state=active]:bg-primary-light data-[state=active]:text-primary data-[state=active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40",
      className,
    )}
    {...props}
  />
  );
}

export { TabsTrigger };
