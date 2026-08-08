import * as React from "react";
import * as TogglePrimitive from "@radix-ui/react-toggle";

import { cn } from "@/lib/utils";
import { toggleVariants, type ToggleVariantProps } from "@/components/ui/toggle-variants";

function Toggle({ ref, className, variant, size, ...props }: React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root> & ToggleVariantProps & { ref?: React.Ref<React.ElementRef<typeof TogglePrimitive.Root>> }) {
  return (
      <TogglePrimitive.Root ref={ref} className={cn(toggleVariants({ variant, size, className }))} {...props} />
  );
}

export { Toggle };
