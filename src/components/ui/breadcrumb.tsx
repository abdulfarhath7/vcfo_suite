import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ChevronRight, MoreHorizontal } from "lucide-react";

import { cn } from "@/lib/utils";

function Breadcrumb({ ref, ...props }: React.ComponentPropsWithoutRef<"nav"> & {
    separator?: React.ReactNode;
  } & { ref?: React.Ref<HTMLElement> }) {
  return <nav ref={ref} aria-label="breadcrumb" {...props} />;
}

function BreadcrumbList({ ref, className, ...props }: React.ComponentPropsWithoutRef<"ol"> & { ref?: React.Ref<HTMLOListElement> }) {
  return (
    <ol
      ref={ref}
      className={cn(
        "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
        className,
      )}
      {...props}
    />
  );
}

function BreadcrumbItem({ ref, className, ...props }: React.ComponentPropsWithoutRef<"li"> & { ref?: React.Ref<HTMLLIElement> }) {
  return (
    <li ref={ref} className={cn("inline-flex items-center gap-1.5", className)} {...props} />
  );
}

function BreadcrumbLink({ ref, asChild, className, ...props }: React.ComponentPropsWithoutRef<"a"> & {
    asChild?: boolean;
  } & { ref?: React.Ref<HTMLAnchorElement> }) {
  const Comp = asChild ? Slot : "a";

  return <Comp ref={ref} className={cn("transition-colors hover:text-foreground", className)} {...props} />;
}

function BreadcrumbPage({ ref, className, ...props }: React.ComponentPropsWithoutRef<"a"> & { ref?: React.Ref<HTMLAnchorElement> }) {
  return (
    <a
      ref={ref}
      aria-disabled="true"
      aria-current="page"
      tabIndex={-1}
      className={cn("font-normal text-foreground pointer-events-none no-underline", className)}
      {...props}
    >
      {props.children ?? <span className="sr-only">Current page</span>}
    </a>
  );
}

const BreadcrumbSeparator = ({ children, className, ...props }: React.ComponentProps<"li">) => (
  <li role="presentation" aria-hidden="true" className={cn("[&>svg]:size-3.5", className)} {...props}>
    {children ?? <ChevronRight />}
  </li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

const BreadcrumbEllipsis = ({ className, ...props }: React.ComponentProps<"span">) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
);
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis";

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
};
