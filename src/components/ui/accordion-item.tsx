import * as React from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";

import { cn } from "@/lib/utils";

function AccordionItem({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item> & { ref?: React.Ref<React.ElementRef<typeof AccordionPrimitive.Item>> }) {
  return (
      <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
  );
}

export { AccordionItem };
