import { cva, type VariantProps } from "class-variance-authority";

/* The chip (docs/design/TOKENS.md, "Controls and chips"): 22px high, 8px side
   padding, 5px corners, 11px/600 text. Status variants use a soft ground with a
   text-safe colour; the word carries the state, never the colour alone. The
   solid-* names are kept for callers but render as soft chips with a 6px dot
   (K-04, rule R-13); there are no solid status blocks. */
const DOT = "before:inline-block before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:content-['']";
export const badgeVariants = cva(
  "inline-flex h-chip items-center gap-1.5 whitespace-nowrap rounded-sm border border-transparent px-2 text-[11px] font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-brand text-on-brand",
        secondary: "bg-surface-sunken text-ink-muted",
        destructive: "bg-danger-soft text-danger",
        outline: "border-line text-ink",
        success: "bg-positive-soft text-positive",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        soft: "bg-brand-soft text-brand",
        highlight: "bg-highlight-soft text-highlight",
        upcoming: "bg-upcoming-soft text-upcoming",
        /* state chips: soft ground, text-safe word, 6px dot in the mid colour */
        "solid-success": `bg-positive-soft text-positive ${DOT} before:bg-positive-mid`,
        "solid-progress": `bg-brand-soft text-brand ${DOT} before:bg-brand`,
        "solid-waiting": `bg-warning-soft text-warning ${DOT} before:bg-warning-mid`,
        "solid-overdue": `bg-danger-soft text-danger ${DOT} before:bg-danger-mid`,
        "solid-upcoming": `bg-upcoming-soft text-upcoming ${DOT} before:bg-upcoming`,
        /* owner chips: soft tints, never solid */
        "owner-client": "bg-owner-client-soft text-owner-client",
        "owner-sbc": "bg-owner-sbc-soft text-owner-sbc",
        "owner-mca": "bg-owner-mca-soft text-owner-mca",
        "owner-manager": "bg-owner-manager-soft text-owner-manager",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
