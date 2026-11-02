import { cva, type VariantProps } from "class-variance-authority";

/* The chip (VCFO Spectrum, rules R-13, R-14): 24px high, 6px corners, 12px/500 text. Status
   chips use a soft ground with a text-safe word and a 7px square dot in the mid colour; the
   word carries the state, never the colour alone. Six status words: Not started, In progress,
   Waiting, Due soon, Overdue, Done. Status and owner chips are 104px wide so columns line up.
   The solid-* names are kept for callers; there are no solid status blocks. */
const DOT = "before:inline-block before:h-[7px] before:w-[7px] before:shrink-0 before:rounded-[2px] before:content-['']";
const W = "min-w-[104px]";
export const badgeVariants = cva(
  "inline-flex h-chip items-center gap-[7px] whitespace-nowrap rounded-md border border-transparent px-[9px] text-[12px] font-medium leading-4 transition-colors focus:outline-none focus:ring-2 focus:ring-focus-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-brand-soft text-brand-text",
        secondary: "bg-surface-sunken text-ink-muted",
        destructive: "bg-danger-soft text-danger",
        outline: "border-1.5 border-line bg-surface-raised text-ink-2",
        success: "bg-positive-soft text-positive",
        warning: "bg-warning-soft text-warning",
        info: "bg-info-soft text-info",
        soft: "bg-brand-soft text-brand-text",
        highlight: "bg-highlight-soft text-highlight",
        upcoming: "bg-upcoming-soft text-upcoming",
        waiting: "bg-waiting-soft text-waiting",
        /* state chips: soft ground, text-safe word, 7px square dot in the mid colour */
        "solid-success": `${W} bg-positive-soft text-positive ${DOT} before:bg-positive-mid`,
        "solid-progress": `${W} bg-brand-soft text-brand-text ${DOT} before:bg-brand`,
        "solid-waiting": `${W} bg-waiting-soft text-waiting ${DOT} before:bg-waiting-mid`,
        "solid-due": `${W} bg-warning-soft text-warning ${DOT} before:bg-warning-mid`,
        "solid-overdue": `${W} bg-danger-soft text-danger ${DOT} before:bg-danger-mid`,
        "solid-upcoming": `${W} bg-upcoming-soft text-upcoming ${DOT} before:bg-upcoming-mid`,
        /* owner chips (R-14): 104px soft tints with a square dot. Client amber, SBC blue, MCA violet. */
        "owner-client": `w-[104px] bg-owner-client-soft text-owner-client ${DOT} before:bg-warning-mid`,
        "owner-sbc": `w-[104px] bg-owner-sbc-soft text-owner-sbc ${DOT} before:bg-current`,
        "owner-mca": `w-[104px] bg-owner-mca-soft text-owner-mca ${DOT} before:bg-current`,
        "owner-manager": `w-[104px] bg-owner-manager-soft text-owner-manager ${DOT} before:bg-waiting-mid`,
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export type BadgeVariantProps = VariantProps<typeof badgeVariants>;
