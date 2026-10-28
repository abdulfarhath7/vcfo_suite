import { cva, type VariantProps } from "class-variance-authority";

/* Buttons (VCFO Spectrum, rule R-12): the main button is blurple with a faint top shine and
   white text; hover is the deeper blurple. 36px default, 30px small, 42px large, 6px corners,
   weight 500. Kinds: default (primary), strong (navy), secondary/outline (white, 1.5px edge),
   ghost (6% ink), soft (blurple tint), destructive (danger), link. Icon-only buttons are 6px
   squares, never circles. One main button per card. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-[7px] whitespace-nowrap rounded-md font-medium ring-offset-surface transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus-ring/25 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-icon-md [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-brand text-on-brand shadow-shine hover:bg-brand-strong",
        strong: "bg-navy text-on-navy shadow-shine hover:bg-navy-hover",
        destructive: "bg-danger-fill text-white shadow-shine hover:bg-danger-fill/90",
        success: "bg-positive text-on-brand shadow-shine hover:bg-positive/90",
        outline: "border-1.5 border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
        secondary: "border-1.5 border-line-strong bg-surface-raised text-ink hover:bg-surface-sunken",
        ghost: "bg-ink/[.06] text-ink hover:bg-ink/10",
        quiet: "bg-transparent text-ink-2 hover:bg-ink/[.06]",
        soft: "bg-brand-soft text-brand-text hover:bg-brand-line/60",
        link: "h-auto min-w-0 px-0 text-brand-text underline-offset-4 hover:underline",
      },
      size: {
        default: "h-control-md min-w-control px-3.5 text-[14px]",
        sm: "h-control-sm min-w-control px-2.5 text-[13px]",
        lg: "h-control-lg min-w-control px-[18px] text-[15px]",
        icon: "h-control-md w-control-md p-0",
      },
    },
    compoundVariants: [{ variant: "link", className: "h-auto min-w-0 px-0" }],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
