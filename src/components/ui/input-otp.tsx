import * as React from "react";
import { OTPInput } from "input-otp";
import { cn } from "@/lib/utils";

import { InputOTPSlot } from "@/components/ui/input-otp-slot";
import { InputOTPSeparator } from "@/components/ui/input-otp-separator";

function InputOTP({ ref, className, containerClassName, ...props }: React.ComponentPropsWithoutRef<typeof OTPInput> & { ref?: React.Ref<React.ElementRef<typeof OTPInput>> }) {
  return (
    <OTPInput
      ref={ref}
      containerClassName={cn("flex items-center gap-2 has-[:disabled]:opacity-50", containerClassName)}
      className={cn("disabled:cursor-not-allowed", className)}
      {...props}
    />
  );
}

function InputOTPGroup({ ref, className, ...props }: React.ComponentPropsWithoutRef<"div"> & { ref?: React.Ref<React.ElementRef<"div">> }) {
  return <div ref={ref} className={cn("flex items-center", className)} {...props} />;
}

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
