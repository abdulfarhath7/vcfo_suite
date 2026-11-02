import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-ink",
  {
    variants: {
      variant: {
        default: "bg-background text-ink",
        destructive: "border-danger/50 text-danger dark:border-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Alert({ ref, className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { ref?: React.Ref<HTMLDivElement> }) {
  return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  );
}

export { Alert };
