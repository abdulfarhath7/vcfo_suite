import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

export { AvatarImage } from "@/components/ui/avatar-image";
export { AvatarFallback } from "@/components/ui/avatar-fallback";

function Avatar({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & { ref?: React.Ref<React.ElementRef<typeof AvatarPrimitive.Root>> }) {
  return (
      <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
  );
}

export { Avatar };
