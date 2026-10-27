import { cva, type VariantProps } from "class-variance-authority";

/* Buttons (docs/design/TOKENS.md, "Controls and chips"): 36px default and 30px
   small, one minimum width so a row or column of buttons shares one size,
   labels never wrap, 8px corners, weight 600. The main button is navy with a
   navy-hover state; use one main button per card. */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold ring-offset-surface transition-[color,background-color,border-color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px motion-reduce:active:translate-y-0 [&_svg]:pointer-events-none [&_svg]:size-icon-md [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-navy text-on-navy hover:bg-navy-hover",
        destructive: "bg-danger text-white hover:bg-danger/90",
        success: "bg-positive text-on-brand hover:bg-positive/90",
        outline: "border border-line bg-surface-raised text-ink shadow-card hover:bg-surface-sunken",
        secondary: "border border-line bg-surface-raised text-ink shadow-card hover:bg-surface-sunken",
        ghost: "bg-transparent text-ink-muted hover:bg-surface-sunken hover:text-ink",
        link: "text-brand underline-offset-4 hover:text-brand-strong hover:underline",
      },
      size: {
        default: "h-control-md min-w-control px-3 text-[13px]",
        sm: "h-control-sm min-w-control px-2.5 text-[12px]",
        lg: "h-control-lg min-w-control px-4 text-[14px]",
        icon: "h-control-md w-control-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
