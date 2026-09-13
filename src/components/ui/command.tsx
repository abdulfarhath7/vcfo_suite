import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

function Command({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive>> }) {
  return (
      <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className,
    )}
    {...props}
  />
  );
}

function CommandInput({
  ref,
  className,
  wrapperClassName,
  showIcon = true,
  ...props
}: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
  ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Input>>;
  wrapperClassName?: string;
  showIcon?: boolean;
}) {
  return (
  <div className={cn("flex items-center border-b px-3", wrapperClassName)} data-cmdk-input-wrapper="">
    {showIcon ? <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" /> : null}
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  </div>
);
}

function CommandList({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.List>> }) {
  return (
      <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
  );
}

function CommandEmpty({ ref, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Empty>> }) {
  return <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />;
}

function CommandGroup({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Group>> }) {
  return (
      <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
  );
}

function CommandItem({ ref, className, ...props }: React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> & { ref?: React.Ref<React.ElementRef<typeof CommandPrimitive.Item>> }) {
  return (
      <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-primary-light data-[selected=true]:text-primary data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
  );
}

export {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
};
