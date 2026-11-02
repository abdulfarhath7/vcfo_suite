import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * R-57: the one checkbox look. A 16px square with a 1.5px line-strong edge and a small radius;
 * empty when not done, brand fill with a white tick when done. Native checkboxes get the same look
 * from app/globals.css. Never draw a checkbox with a dotted or dashed edge.
 */
function Checkbox({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { ref?: React.Ref<React.ElementRef<typeof CheckboxPrimitive.Root>> }) {
  return (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer grid h-4 w-4 shrink-0 place-items-center rounded-mark border-1.5 border-line-strong bg-surface-raised data-[state=checked]:border-brand ring-offset-background data-[state=checked]:bg-brand data-[state=checked]:text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3 w-3" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
}

export { Checkbox };
