import { cn } from "@/lib/utils";

/** L1 skeleton block (prototype Skeleton): a grey `line-soft` block that pulses, still under reduced motion. */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-line-soft motion-reduce:animate-none", className)}
      {...props}
    />
  );
}

export { Skeleton };
