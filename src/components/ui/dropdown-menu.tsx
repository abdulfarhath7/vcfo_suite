import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

function DropdownMenuSubTrigger({ ref, className, inset, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  } & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>> }) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      ref={ref}
      className={cn(
        "flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[state=open]:bg-accent focus:bg-accent",
        inset && "pl-8",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto h-4 w-4" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

function DropdownMenuSubContent({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.SubContent>> }) {
  return (
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-float data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Letter keys (VCFO Spectrum B-11, D1): while a menu is open, a single key runs the item whose
 * `shortcut` matches it. Only items that opt in with `shortcut` take part, so Radix typeahead
 * keeps working for every other letter.
 */
function runItemShortcut(e: React.KeyboardEvent<HTMLDivElement>) {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
  const key = e.key.toLowerCase();
  if (!/^[a-z0-9]$/.test(key)) return;
  const item = e.currentTarget.querySelector<HTMLElement>(`[data-shortcut="${key}"]:not([data-disabled])`);
  if (!item) return;
  e.preventDefault();
  e.stopPropagation();
  item.click();
}

function DropdownMenuContent({ ref, className, sideOffset = 4, onKeyDown, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Content>> }) {
  return (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        runItemShortcut(e);
      }}
      className={cn(
        "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-float data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
);
}

function DropdownMenuItem({ ref, className, inset, shortcut, children, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    /** One letter or digit that runs this item while the menu is open, shown as a key cap at the right. */
    shortcut?: string;
  } & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Item>> }) {
  const key = shortcut?.trim().toLowerCase() || undefined;
  return (
      <DropdownMenuPrimitive.Item
    ref={ref}
    data-shortcut={key}
    aria-keyshortcuts={key?.toUpperCase()}
    className={cn(
      "relative flex min-h-[34px] cursor-default select-none items-center rounded-mark px-2.5 py-1.5 text-[14px] outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
    {key ? (
      <span className="ml-auto flex-none pl-3">
        <Kbd>{key.toUpperCase()}</Kbd>
      </span>
    ) : null}
  </DropdownMenuPrimitive.Item>
  );
}

function DropdownMenuLabel({ ref, className, inset, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  } & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Label>> }) {
  return (
      <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-sm font-semibold", inset && "pl-8", className)}
    {...props}
  />
  );
}

function DropdownMenuSeparator({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> & { ref?: React.Ref<React.ElementRef<typeof DropdownMenuPrimitive.Separator>> }) {
  return (
      <DropdownMenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-surface-sunken", className)} {...props} />
  );
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
};
