import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & { ref?: React.Ref<React.ElementRef<typeof CheckboxPrimitive.Root>> }) {
  return (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-[18px] w-[18px] shrink-0 rounded-mark border-1.5 border-line-strong data-[state=checked]:border-brand ring-offset-background data-[state=checked]:bg-brand data-[state=checked]:text-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <Check className="h-3.5 w-3.5" strokeWidth={2.4} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
);
}

export { Checkbox };
