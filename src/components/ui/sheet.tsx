import * as SheetPrimitive from "@radix-ui/react-dialog";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { DIALOG_CLOSE } from "@/components/ui/dialog-classes";

/* The sheet (VCFO Spectrum, prototype SidePanel frame): navy scrim, the right panel is 440px
   wide with a 1px edge and the dialog shadow, full width on phones. For a panel with the
   prototype's head (eyebrow, 15px title, chips) and footer, use `SidePanel`
   (`@/components/ui/side-panel`). */

const Sheet = SheetPrimitive.Root;

const SheetPortal = SheetPrimitive.Portal;

function SheetOverlay({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay> & {
  ref?: React.Ref<React.ElementRef<typeof SheetPrimitive.Overlay>>;
}) {
  return (
    <SheetPrimitive.Overlay
      className={cn(
        "discrete-overlay fixed inset-0 z-50 bg-scrim",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      ref={ref}
    />
  );
}

const sheetVariants = cva(
  cn(
    "discrete-panel fixed z-50 gap-4 border-line bg-surface-raised p-5 text-ink shadow-dialog outline-none ease-out",
    "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500",
  ),
  {
    variants: {
      side: {
        top: cn(
          "discrete-sheet-top inset-x-0 top-0 border-b",
          "data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        ),
        bottom: cn(
          "discrete-sheet-bottom inset-x-0 bottom-0 border-t",
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        ),
        left: cn(
          "discrete-sheet-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm",
          "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
        ),
        right: cn(
          "discrete-sheet-right inset-y-0 right-0 h-full w-full border-l sm:max-w-[440px]",
          "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        ),
      },
    },
    defaultVariants: {
      side: "right",
    },
  },
);

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

function SheetContent({
  ref,
  side = "right",
  className,
  children,
  ...props
}: SheetContentProps & { ref?: React.Ref<React.ElementRef<typeof SheetPrimitive.Content>> }) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        {children}
        <SheetPrimitive.Close className={DIALOG_CLOSE}>
          <X size={16} strokeWidth={1.6} aria-hidden />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

function SheetTitle({
  ref,
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title> & {
  ref?: React.Ref<React.ElementRef<typeof SheetPrimitive.Title>>;
}) {
  return (
    <SheetPrimitive.Title ref={ref} className={cn("text-[15px] font-medium leading-snug text-ink", className)} {...props} />
  );
}

export {
  Sheet,
  SheetContent,
  SheetTitle,
};
