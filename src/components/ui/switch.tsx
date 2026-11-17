import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

/* Switch (prototype): 44 x 24 track with 6px corners, blurple when on; an 18px white thumb with
   4px corners and the control shadow; a 4px blurple glow on focus. `size="sm"` is a 32 x 18 track
   with a 14px thumb, for a switch that sits beside 12–13px text in a dense row. */

function Switch({
  ref,
  className,
  size = "md",
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> & { ref?: React.Ref<React.ElementRef<typeof SwitchPrimitives.Root>>; size?: "sm" | "md" }) {
  return (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-md transition-colors data-[state=checked]:bg-brand data-[state=unchecked]:bg-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:cursor-not-allowed disabled:opacity-50",
      size === "sm" ? "h-[18px] w-8 p-[2px]" : "h-6 w-11 p-[3px]",
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-mark bg-white shadow-control ring-0 transition-transform data-[state=unchecked]:translate-x-0",
        size === "sm" ? "h-[14px] w-[14px] data-[state=checked]:translate-x-[14px]" : "h-[18px] w-[18px] data-[state=checked]:translate-x-5",
      )}
    />
  </SwitchPrimitives.Root>
);
}

export { Switch };
