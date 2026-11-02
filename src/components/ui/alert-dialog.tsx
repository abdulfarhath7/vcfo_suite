import * as React from "react";
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button-variants";
import { DIALOG_CONTENT, DIALOG_DESCRIPTION, DIALOG_OVERLAY, DIALOG_TITLE } from "@/components/ui/dialog-classes";

/* Confirm dialogs share the Dialog frame: navy scrim, 420px box, bottom sheet on phones. */

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

function AlertDialogOverlay({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Overlay>> }) {
  return (
      <AlertDialogPrimitive.Overlay
    className={cn(DIALOG_OVERLAY, className)}
    {...props}
    ref={ref}
  />
  );
}

function AlertDialogContent({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Content>> }) {
  return (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogPrimitive.Content
      ref={ref}
      className={cn(DIALOG_CONTENT, "max-w-[420px]", className)}
      {...props}
    />
  </AlertDialogPortal>
);
}

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);
AlertDialogHeader.displayName = "AlertDialogHeader";

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-wrap items-center justify-end gap-2", className)} {...props} />
);
AlertDialogFooter.displayName = "AlertDialogFooter";

function AlertDialogTitle({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Title>> }) {
  return (
      <AlertDialogPrimitive.Title ref={ref} className={cn(DIALOG_TITLE, className)} {...props} />
  );
}

function AlertDialogDescription({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Description>> }) {
  return (
    <AlertDialogPrimitive.Description ref={ref} className={cn(DIALOG_DESCRIPTION, "text-[13.5px] text-ink-2", className)} {...props} />
  );
}

function AlertDialogAction({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Action>> }) {
  return (
      <AlertDialogPrimitive.Action ref={ref} className={cn(buttonVariants(), className)} {...props} />
  );
}

function AlertDialogCancel({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel> & { ref?: React.Ref<React.ElementRef<typeof AlertDialogPrimitive.Cancel>> }) {
  return (
      <AlertDialogPrimitive.Cancel
    ref={ref}
    className={cn(buttonVariants({ variant: "outline" }), "mt-2 sm:mt-0", className)}
    {...props}
  />
  );
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
