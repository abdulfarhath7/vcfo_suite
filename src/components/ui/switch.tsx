import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/* Switch (prototype): 44 x 24 track with 6px corners, blurple when on; an 18px white thumb with
   4px corners and the control shadow; a 4px blurple glow on focus. */

function Switch({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { ref?: React.Ref<React.ElementRef<typeof SwitchPrimitives.Root>> }) {
  return (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-md p-[3px] transition-colors data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block h-[18px] w-[18px] rounded-mark bg-white shadow-control ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
      )}
    />
  </SwitchPrimitives.Root>
);
}

export { Switch };
