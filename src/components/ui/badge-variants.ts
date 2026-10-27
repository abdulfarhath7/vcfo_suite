import { cva, type VariantProps } from "class-variance-authority";

/* The chip (docs/design/TOKENS.md, "Controls and chips"): 22px high, 8px side
   padding, 6px corners, 11px/600 text. Status variants use a soft ground with a
   text-safe colour; the word carries the state, never the colour alone. */
export const badgeVariants = cva(
  "inline-flex h-chip items-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-2 text-[11px] font-semibold leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2",
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
        /* solid state chips: the word and the fill carry the state */
        "solid-success": "bg-positive text-on-status",
        "solid-progress": "bg-brand text-on-status",
        "solid-waiting": "bg-warning text-on-status",
        "solid-overdue": "bg-danger text-on-status",
        "solid-upcoming": "bg-upcoming text-on-status",
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
